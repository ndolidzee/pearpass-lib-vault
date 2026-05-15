import { generateUniqueId } from '@tetherto/pear-apps-utils-generate-unique-id'

import { ACTIONS } from '../actions'
import { pearpassVaultClient } from '../instances'
import { decodeEnvelope } from './broadcastAction'
import { listDevices } from './listDevices'
import { getMyDeviceId } from '../utils/getMyDeviceId'
import { logger } from '../utils/logger'

const INBOX_PREFIX = 'actions/inbox/'

/**
 * @param {{ envelope: string }} message
 * @returns {Promise<void>}
 */
export const acceptInboundEnvelope = async ({ envelope } = {}) => {
  if (!envelope) return

  const decoded = await decodeEnvelope(envelope, { verify: true })
  if (!decoded || !decoded.type) {
    logger.error('inbox: dropped malformed or unsigned envelope')
    return
  }

  const myDeviceId = await getMyDeviceId().catch(() => null)
  if (myDeviceId && decoded.actor === myDeviceId) {
    return
  }

  const id = generateUniqueId()
  const ts = Date.now()
  const key = `${INBOX_PREFIX}${ts}_${id}`
  const record = { id, receivedAt: ts, envelope: decoded }

  try {
    await pearpassVaultClient.vaultsAdd(key, record)
  } catch (err) {
    logger.error('inbox: failed to persist envelope', { err })
  }
}

const INBOX_MAX_ATTEMPTS = 5
const INBOX_QUARANTINE_PREFIX = 'actions/inbox-quarantine/'

/**
 * @returns {Promise<{ processed: number, skipped: number, deferred: number, failed: number, quarantined: number }>}
 */
export const processInbox = async () => {
  if (typeof pearpassVaultClient?.vaultsFind !== 'function') {
    return { processed: 0, skipped: 0, deferred: 0, failed: 0, quarantined: 0 }
  }

  let entries
  try {
    entries =
      (await pearpassVaultClient.vaultsFind({
        gte: { key: INBOX_PREFIX },
        lt: { key: nextPrefix(INBOX_PREFIX) }
      })) ?? []
  } catch (err) {
    if (/not initialised/i.test(err?.message ?? '')) {
      return {
        processed: 0,
        skipped: 0,
        deferred: 0,
        failed: 0,
        quarantined: 0
      }
    }
    throw err
  }

  let processed = 0
  let skipped = 0
  let deferred = 0
  let failed = 0
  let quarantined = 0

  for (const entry of entries) {
    const record = entry?.value
    const envelope = record?.envelope
    const handler = envelope ? ACTIONS[envelope.type] : null
    if (!handler) {
      skipped += 1
      continue
    }

    try {
      const result = await handler.execute(envelope)
      if (result?.status === 'deferred') {
        deferred += 1
        continue
      }
      await pearpassVaultClient.vaultsRemove(entry.key)
      processed += 1
    } catch (err) {
      const attempts = (record.attempts ?? 0) + 1
      logger.error('inbox: handler threw', {
        err,
        type: envelope?.type,
        attempts
      })
      if (attempts >= INBOX_MAX_ATTEMPTS) {
        await quarantineEntry(entry.key, record, err)
        quarantined += 1
      } else {
        await pearpassVaultClient.vaultsAdd(entry.key, {
          ...record,
          attempts,
          lastError: err?.message ?? String(err)
        })
        failed += 1
      }
    }
  }

  return { processed, skipped, deferred, failed, quarantined }
}

const quarantineEntry = async (key, record, err) => {
  const suffix = key.slice(INBOX_PREFIX.length)
  const quarantineKey = `${INBOX_QUARANTINE_PREFIX}${suffix}`
  try {
    await pearpassVaultClient.vaultsAdd(quarantineKey, {
      ...record,
      quarantinedAt: Date.now(),
      lastError: err?.message ?? String(err)
    })
    await pearpassVaultClient.vaultsRemove(key)
  } catch (e) {
    logger.error('inbox: quarantine failed', { e })
  }
}

const nextPrefix = (prefix) => {
  const last = prefix.charCodeAt(prefix.length - 1)
  return prefix.slice(0, -1) + String.fromCharCode(last + 1)
}

export const lookupPeerMasterTopic = async (actor) => {
  if (!actor) return null
  try {
    const peer = await pearpassVaultClient?.vaultsGet?.(`peer/${actor}`)
    if (peer?.masterTopic) return peer.masterTopic
    const myDevices = (await listDevices()) ?? []
    return myDevices.find((d) => d?.id === actor)?.masterTopic ?? null
  } catch (err) {
    logger.error('inbox: lookup peer masterTopic failed', { err })
    return null
  }
}

export const PEER_PREFIX = 'peer/'

export const registerPeer = async (device) => {
  if (!device?.id) return
  try {
    await pearpassVaultClient?.vaultsAdd?.(`${PEER_PREFIX}${device.id}`, {
      id: device.id,
      name: device.name ?? null,
      writerKey: device.writerKey ?? null,
      masterTopic: device.masterTopic ?? null,
      lastSeenAt: Date.now()
    })
  } catch (err) {
    logger.error('inbox: registerPeer failed', { err })
  }
}

export { INBOX_PREFIX, INBOX_QUARANTINE_PREFIX, INBOX_MAX_ATTEMPTS }
