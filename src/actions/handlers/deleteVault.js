import { pearpassVaultClient } from '../../instances'

// Defer until the app attaches a 'vault-access-revoked' listener so
// boot-time delivery doesn't burn inbox attempts.
export const deleteVaultActionHandler = {
  execute: async (action) => {
    const vaultId = action?.payload?.vaultId
    if (!vaultId) {
      throw new Error('delete-vault action: payload.vaultId is required')
    }
    if (pearpassVaultClient.listenerCount?.('vault-access-revoked') === 0) {
      return { status: 'deferred', reason: 'no-listener' }
    }
    pearpassVaultClient.emit('vault-access-revoked', {
      vaultId,
      actor: action?.actor
    })
  }
}
