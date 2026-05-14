import { deleteVaultLocal } from './deleteVaultLocal'
import { deleteVaultLocal as deleteVaultLocalApi } from '../api/deleteVaultLocal'

jest.mock('../api/deleteVaultLocal', () => ({
  deleteVaultLocal: jest.fn()
}))

describe('deleteVaultLocal action', () => {
  let dispatch
  let getState

  beforeEach(() => {
    jest.clearAllMocks()
    dispatch = jest.fn()
    getState = jest.fn()
  })

  it('forwards the vaultId to the api and returns vaultId + remaining vaults', async () => {
    const remaining = [{ id: 'v2' }]
    deleteVaultLocalApi.mockResolvedValueOnce(remaining)

    const thunk = deleteVaultLocal({ vaultId: 'v1' })
    const result = await thunk(dispatch, getState)

    expect(deleteVaultLocalApi).toHaveBeenCalledWith('v1')
    expect(result.type).toBe(deleteVaultLocal.fulfilled.type)
    expect(result.payload).toEqual({
      vaultId: 'v1',
      remainingVaults: remaining
    })
  })

  it('rejects when the api throws', async () => {
    deleteVaultLocalApi.mockRejectedValueOnce(new Error('boom'))

    const thunk = deleteVaultLocal({ vaultId: 'v1' })
    const result = await thunk(dispatch, getState)

    expect(result.type).toBe(deleteVaultLocal.rejected.type)
    expect(result.error.message).toContain('boom')
  })
})
