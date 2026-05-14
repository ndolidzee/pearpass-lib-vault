import { listDevices } from '../api/listDevices'
import { getCurrentDeviceName, pearpassVaultClient } from '../instances'

/**
 * @returns {Promise<string | null>}
 */
export const getMyDeviceId = async () => {
  const writerKey = await pearpassVaultClient.activeVaultGetWriterKey()
  if (!writerKey) return null

  const devices = (await listDevices()) ?? []

  const byWriterKey = devices.find((device) => device?.writerKey === writerKey)
  if (byWriterKey) return byWriterKey.id ?? null

  const deviceName = getCurrentDeviceName()
  if (!deviceName) return null

  // byName fallback covers two cases that the byWriterKey lookup misses:
  // (1) legacy entries that pre-date the writerKey field, and (2) entries
  // whose writerKey is stale because this device's local Corestore keypair
  // was regenerated (e.g. a reinstall) and the vault record hasn't been
  // healed by addDevice yet. We deliberately accept entries that already
  // carry a writerKey so the stale-entry case is recoverable. When multiple
  // entries share a name we pick the most-recently-created — addDevice
  // refreshes createdAt on every heal, so the current install's entry rises
  // to the top of the sort.
  const byName = devices
    .filter((device) => device?.name === deviceName)
    .sort((a, b) => (b?.createdAt ?? 0) - (a?.createdAt ?? 0))[0]

  return byName?.id ?? null
}
