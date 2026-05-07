import { pearpassVaultClient } from '../instances'
import { listVaults } from './listVaults'

/**
 * Removes a vault from this device only. Does not leave the autopass writer
 * set; other devices still see this device as paired until the action-bus
 * propagates the removal.
 *
 * @param {string} vaultId
 * @returns {Promise<Array<any>>} the remaining vaults after deletion.
 */
export const deleteVaultLocal = async (vaultId) => {
  if (!vaultId) {
    throw new Error('vaultId is required')
  }

  await pearpassVaultClient.removeVault(vaultId)

  return listVaults()
}
