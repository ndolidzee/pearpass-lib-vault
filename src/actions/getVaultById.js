import { createAsyncThunk } from '@reduxjs/toolkit'

import { addDevice as addDeviceApi } from '../api/addDevice'
import { getVaultById as getVaultByIdApi } from '../api/getVaultById'
import { registerPeer } from '../api/inbox'
import { listDevices } from '../api/listDevices'
import { listRecords } from '../api/listRecords'
import { getCurrentDeviceName, pearpassVaultClient } from '../instances'
import { addDeviceFactory } from '../utils/addDeviceFactory'
import { logger } from '../utils/logger'

export const getVaultById = createAsyncThunk(
  'vault/getVault',
  async ({ vaultId, params } = {}) => {
    if (!vaultId) {
      throw new Error('Vault ID is required')
    }

    const vault = await getVaultByIdApi(vaultId, params)

    if (!vault) {
      throw new Error('Vault not found ' + vaultId)
    }

    const records = (await listRecords(vault.id)) ?? []
    const devices = (await listDevices(vault.id)) ?? []

    const healedDevices = await healLocalDeviceEntry(vault.id, devices)
    await Promise.all(healedDevices.map(registerPeer))

    return {
      ...vault,
      records: records ?? [],
      devices: healedDevices
    }
  }
)

const safeGetPersonalSwarmTopic = async () => {
  if (typeof pearpassVaultClient?.personalSwarmGetTopic !== 'function') {
    return null
  }
  try {
    return (await pearpassVaultClient.personalSwarmGetTopic()) || null
  } catch (err) {
    logger.error('getVaultById: personalSwarmGetTopic failed', {
      err: err?.message ?? String(err)
    })
    return null
  }
}

// Number of times to re-read listDevices before deciding the entry truly
// doesn't exist. Each retry costs HEAL_RETRY_DELAY_MS and only runs in the
// rare case where no byWriterKey match is found; the byWriterKey fast path
// returns immediately on the very first read.
const HEAL_RETRY_COUNT = 3
const HEAL_RETRY_DELAY_MS = 200

// Single-flight gate per vault. During pair, the autobase 'update' listener
// (installed by usePair) can fire while refetchVault's getVaultById is also
// running, so two heal invocations race. With both starting before either
// fresh-create completes, byWriterKey misses on both, byName misses on both
// (fresh pair, no prior same-name entry), and they both append a device
// row - producing two entries with identical writerKey for the same peer.
// Serialising heal by vaultId lets the second caller observe the first
// caller's write and short-circuit on byWriterKey.
const inflightHeals = new Map()

// Keep the local device entry discoverable by getMyDeviceId. Cases:
//   1. writerKey matches an existing entry - refresh masterTopic/createdAt
//      if the swarm topic changed.
//   2. writerKey is stale (Corestore was regenerated) but the OS-derived
//      device name still matches an entry - patch that entry's writerKey
//      so future writerKey lookups succeed.
//   3. Neither matches - create a fresh entry so getMyDeviceId resolves.
//
// Only the byWriterKey lookup gates the retry loop. addDevice (dispatched
// from the pair acceptance flow) writes a fresh entry to autobase with our
// current writerKey, and the local view updates asynchronously. If we let
// a byName match short-circuit the retries we would latch onto a stale
// same-name entry from a prior pairing, patch its writerKey, and then
// addDevice's own entry would still land - leaving two records for the
// same physical device with identical writerKey. byName is therefore a
// last-resort fallback applied only after the retries are exhausted.
const healLocalDeviceEntry = async (vaultId, devices) => {
  const existing = inflightHeals.get(vaultId)
  if (existing) {
    await existing.catch(() => {})
    return (await listDevices(vaultId)) ?? devices
  }
  const promise = healLocalDeviceEntryInner(vaultId, devices)
  inflightHeals.set(vaultId, promise)
  try {
    return await promise
  } finally {
    inflightHeals.delete(vaultId)
  }
}

const healLocalDeviceEntryInner = async (vaultId, devices) => {
  try {
    const writerKey =
      (await pearpassVaultClient?.activeVaultGetWriterKey?.()) ?? null
    if (!writerKey) return devices

    const masterTopic = await safeGetPersonalSwarmTopic()
    const deviceName = getCurrentDeviceName()

    const findByWriterKey = (list) =>
      list.find((d) => d?.writerKey === writerKey)
    const findByName = (list) => {
      if (!deviceName) return null
      return (
        list
          .filter((d) => d?.name === deviceName)
          .sort((a, b) => (b?.createdAt ?? 0) - (a?.createdAt ?? 0))[0] ?? null
      )
    }

    let snapshot = devices
    let byWriterKey = findByWriterKey(snapshot)
    for (let i = 0; !byWriterKey && i < HEAL_RETRY_COUNT; i++) {
      await new Promise((r) => setTimeout(r, HEAL_RETRY_DELAY_MS))
      snapshot = (await listDevices(vaultId)) ?? []
      byWriterKey = findByWriterKey(snapshot)
    }

    let found
    if (byWriterKey) {
      found = { match: byWriterKey, patchWriterKey: false }
    } else {
      const byName = findByName(snapshot)
      found = byName
        ? { match: byName, patchWriterKey: true }
        : { match: null, patchWriterKey: false }
    }

    if (found.match) {
      const existing = found.match
      if (
        !found.patchWriterKey &&
        (existing.masterTopic ?? null) === masterTopic
      ) {
        return snapshot
      }
      const healed = {
        ...existing,
        ...(found.patchWriterKey ? { writerKey } : {}),
        createdAt: Date.now()
      }
      if (masterTopic) healed.masterTopic = masterTopic
      else delete healed.masterTopic
      await addDeviceApi(healed)
      return snapshot.map((d) => (d.id === healed.id ? healed : d))
    }

    if (!deviceName) return snapshot
    const fresh = addDeviceFactory(deviceName, vaultId, writerKey, masterTopic)
    await addDeviceApi(fresh)
    return [...snapshot, fresh]
  } catch (err) {
    // "Not writable" is expected on a peer that was just kicked, between
    // writer-removal replication and the local vault wipe firing. Don't
    // pollute logs with it.
    const msg = err?.message ?? String(err)
    if (msg.includes('Not writable')) return devices
    logger.error('getVaultById: device heal failed', { err: msg })
    return devices
  }
}
