import { deleteVaultActionHandler } from './handlers/deleteVault'
import { leaveVaultActionHandler } from './handlers/leaveVault'
import { ACTION_TYPES } from './types'

export { ACTION_TYPES }

// Handlers may return { status: 'deferred', reason? } to retry later
// without counting as a poison attempt. Throw to flag a poisoned
// envelope; processInbox bumps attempts and quarantines past the cap.
export const ACTIONS = {
  [ACTION_TYPES.DELETE_VAULT]: deleteVaultActionHandler,
  [ACTION_TYPES.LEAVE_VAULT]: leaveVaultActionHandler
}
