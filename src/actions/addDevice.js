import { createAsyncThunk } from '@reduxjs/toolkit'

import { addDevice as addDeviceApi } from '../api/addDevice'
import { getCurrentDeviceName, pearpassVaultClient } from '../instances'
import { addDeviceFactory } from '../utils/addDeviceFactory'
import { logger } from '../utils/logger'

export const addDevice = createAsyncThunk(
  'vault/addDevice',
  async (_, { getState }) => {
    const state = getState()
    const vaultState = state.vault
    const vaultId = vaultState.data.id
    const existingDevices = vaultState.data?.devices ?? []

    const deviceName = getCurrentDeviceName()
    const writerKey = await pearpassVaultClient.activeVaultGetWriterKey()

    const existingDevice = existingDevices.find(
      (device) => device.name === deviceName
    )

    if (existingDevice && existingDevice.writerKey === writerKey) {
      logger.log('Device already added to vault')
      return existingDevice
    }

    // Either no entry, or the existing entry has a stale writerKey (typically
    // a reinstall on the same device — the local Corestore keypair was
    // regenerated, so autopass now writes under a new writerKey). Reuse the
    // existing id when present so we overwrite device/<id> in place rather
    // than leaving a duplicate-by-name entry that getMyDeviceId can't match
    // by writerKey.
    const device = existingDevice
      ? { ...existingDevice, writerKey, createdAt: Date.now() }
      : addDeviceFactory(deviceName, vaultId, writerKey)

    await addDeviceApi(device)

    return device
  }
)
