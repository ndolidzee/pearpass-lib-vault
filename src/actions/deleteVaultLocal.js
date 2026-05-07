import { createAsyncThunk } from '@reduxjs/toolkit'

import { deleteVaultLocal as deleteVaultLocalApi } from '../api/deleteVaultLocal'

export const deleteVaultLocal = createAsyncThunk(
  'vault/deleteVaultLocal',
  async ({ vaultId }) => {
    const remainingVaults = await deleteVaultLocalApi(vaultId)
    return { vaultId, remainingVaults }
  }
)
