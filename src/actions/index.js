import { pearpassVaultClient } from '../instances'
import { ACTION_TYPES } from './types'

export { ACTION_TYPES }

/**
 * Built-in receive-side handlers. Each handler runs from
 * processPendingActions when an entry matching its key lands in this
 * device's actions queue.
 *
 * delete-vault: another paired device removed our access. Emit
 * 'vault-access-revoked' so the app layer can run the local data wipe
 * via its existing useVault.deleteVaultLocal flow (which keeps Redux in
 * sync) and show the access-removed UI. Doing the wipe here directly
 * would bypass the slice reducers and leave activeVault stale.
 */
export const ACTIONS = {
  [ACTION_TYPES.DELETE_VAULT]: {
    execute: async (action) => {
      const vaultId = action?.payload?.vaultId
      if (!vaultId) {
        throw new Error('delete-vault action: payload.vaultId is required')
      }
      pearpassVaultClient.emit('vault-access-revoked', {
        vaultId,
        actor: action?.actor
      })
    }
  }
}
