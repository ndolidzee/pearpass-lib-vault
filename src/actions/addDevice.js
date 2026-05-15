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
      (device) => device.writerKey === writerKey
    )

    if (existingDevice) {
      logger.log('Device already added to vault')
      return existingDevice
    }

    const device = addDeviceFactory(deviceName, vaultId, writerKey)

    await addDeviceApi(device)

    return device
  }
)
