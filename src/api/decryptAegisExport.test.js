import { decryptAegisExport } from './decryptAegisExport'
import { pearpassVaultClient } from '../instances'

const VALID_PARAMS = {
  slots: [{ type: 1 }],
  params: { nonce: 'aabb', tag: 'ccdd' },
  db: 'base64ciphertext',
  password: 'test'
}

describe('decryptAegisExport', () => {
  it('calls pearpassVaultClient.decryptAegisExport with params', async () => {
    const mockResult = '{"entries":[]}'
    pearpassVaultClient.decryptAegisExport.mockResolvedValueOnce(mockResult)

    const result = await decryptAegisExport(VALID_PARAMS)

    expect(pearpassVaultClient.decryptAegisExport).toHaveBeenCalledTimes(1)
    expect(pearpassVaultClient.decryptAegisExport).toHaveBeenCalledWith(
      VALID_PARAMS
    )
    expect(result).toBe(mockResult)
  })

  it('throws when password is missing', async () => {
    await expect(
      decryptAegisExport({ ...VALID_PARAMS, password: '' })
    ).rejects.toThrow('Password is required')

    await expect(
      decryptAegisExport({ ...VALID_PARAMS, password: null })
    ).rejects.toThrow('Password is required')
  })

  it('throws when slots are missing', async () => {
    await expect(
      decryptAegisExport({ ...VALID_PARAMS, slots: undefined })
    ).rejects.toThrow('Export data is required')
  })

  it('throws when db is missing', async () => {
    await expect(
      decryptAegisExport({ ...VALID_PARAMS, db: '' })
    ).rejects.toThrow('Export data is required')
  })

  it('throws when params is null', async () => {
    await expect(decryptAegisExport(null)).rejects.toThrow(
      'Password is required'
    )
  })

  it('propagates errors from the client', async () => {
    const error = new Error('Incorrect password')
    pearpassVaultClient.decryptAegisExport.mockRejectedValueOnce(error)

    await expect(decryptAegisExport(VALID_PARAMS)).rejects.toThrow(
      'Incorrect password'
    )
  })
})
