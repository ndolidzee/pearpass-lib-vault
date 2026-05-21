import { decryptProtonExport } from './decryptProtonExport'
import { pearpassVaultClient } from '../instances'

const VALID_PARAMS = {
  version: 1,
  salt: 'cHJvdG9udGVzdHNh',
  content: 'cHJvdG9ubm9uY2Ux',
  password: 'test'
}

describe('decryptProtonExport', () => {
  it('calls pearpassVaultClient.decryptProtonExport with params', async () => {
    const mockResult = '{"entries":[]}'
    pearpassVaultClient.decryptProtonExport.mockResolvedValueOnce(mockResult)

    const result = await decryptProtonExport(VALID_PARAMS)

    expect(pearpassVaultClient.decryptProtonExport).toHaveBeenCalledTimes(1)
    expect(pearpassVaultClient.decryptProtonExport).toHaveBeenCalledWith(
      VALID_PARAMS
    )
    expect(result).toBe(mockResult)
  })

  it('throws when password is missing', async () => {
    await expect(
      decryptProtonExport({ ...VALID_PARAMS, password: '' })
    ).rejects.toThrow('Password is required')

    await expect(
      decryptProtonExport({ ...VALID_PARAMS, password: null })
    ).rejects.toThrow('Password is required')
  })

  it('throws when salt is missing', async () => {
    await expect(
      decryptProtonExport({ ...VALID_PARAMS, salt: '' })
    ).rejects.toThrow('Export data is required')
  })

  it('throws when content is missing', async () => {
    await expect(
      decryptProtonExport({ ...VALID_PARAMS, content: '' })
    ).rejects.toThrow('Export data is required')
  })

  it('throws when params is null', async () => {
    await expect(decryptProtonExport(null)).rejects.toThrow(
      'Password is required'
    )
  })

  it('propagates errors from the client', async () => {
    const error = new Error('Incorrect password')
    pearpassVaultClient.decryptProtonExport.mockRejectedValueOnce(error)

    await expect(decryptProtonExport(VALID_PARAMS)).rejects.toThrow(
      'Incorrect password'
    )
  })
})
