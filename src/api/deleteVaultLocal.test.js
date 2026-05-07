import { pearpassVaultClient } from '../instances'
import { deleteVaultLocal } from './deleteVaultLocal'
import { listVaults } from './listVaults'

jest.mock('./listVaults', () => ({
  listVaults: jest.fn()
}))

describe('deleteVaultLocal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('throws when vaultId is missing', async () => {
    await expect(deleteVaultLocal()).rejects.toThrow('vaultId is required')
    expect(pearpassVaultClient.removeVault).not.toHaveBeenCalled()
  })

  it('calls removeVault and returns the remaining vaults', async () => {
    const remaining = [{ id: 'v2' }]
    listVaults.mockResolvedValueOnce(remaining)

    const result = await deleteVaultLocal('v1')

    expect(pearpassVaultClient.removeVault).toHaveBeenCalledWith('v1')
    expect(listVaults).toHaveBeenCalledTimes(1)
    expect(result).toBe(remaining)
  })

  it('does not call listVaults if removeVault fails', async () => {
    pearpassVaultClient.removeVault.mockRejectedValueOnce(new Error('boom'))

    await expect(deleteVaultLocal('v1')).rejects.toThrow('boom')
    expect(listVaults).not.toHaveBeenCalled()
  })
})
