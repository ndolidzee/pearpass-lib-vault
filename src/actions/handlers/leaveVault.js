import { getCurrentVault } from '../../api/getCurrentVault'
import { listDevices } from '../../api/listDevices'
import { pearpassVaultClient } from '../../instances'

// Defer when the target vault isn't active; we can only write to the
// active vault.
export const leaveVaultActionHandler = {
  execute: async (action) => {
    const vaultId = action?.payload?.vaultId
    const actorId = action?.actor
    if (!vaultId || !actorId) {
      throw new Error('leave-vault action: vaultId and actor are required')
    }

    const currentVault = await getCurrentVault()
    if (currentVault?.id !== vaultId) {
      return { status: 'deferred', reason: 'vault-not-active' }
    }

    const devices = (await listDevices()) ?? []
    const actorDevice = devices.find((d) => d?.id === actorId)
    if (!actorDevice) return

    await pearpassVaultClient.activeVaultRemove(`device/${actorId}`)
  }
}
