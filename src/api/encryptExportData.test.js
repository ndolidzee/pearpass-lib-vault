import { pearpassVaultClient } from '../instances'
import { encryptExportData } from './encryptExportData'

jest.mock('../instances', () => ({
  pearpassVaultClient: {
    encryptExportData: jest.fn()
  }
}))

describe('encryptExportData', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should encrypt data with password', async () => {
    const mockEncryptedData = {
      version: '1.0',
      encrypted: true,
      algorithm: 'XSalsa20-Poly1305',
      kdf: 'Argon2id',
      salt: 'mockSalt',
      nonce: 'mockNonce',
      ciphertext: 'mockCiphertext'
    }

    pearpassVaultClient.encryptExportData.mockResolvedValue(mockEncryptedData)

    const result = await encryptExportData('test data', 'password123')

    expect(pearpassVaultClient.encryptExportData).toHaveBeenCalledWith(
      'test data',
      'password123'
    )
    expect(result).toEqual(mockEncryptedData)
  })

  it('should throw error if password is not provided', async () => {
    await expect(encryptExportData('data', '')).rejects.toThrow(
      'Password is required for encryption'
    )

    expect(pearpassVaultClient.encryptExportData).not.toHaveBeenCalled()
  })

  it('should throw error if password is null', async () => {
    await expect(encryptExportData('data', null)).rejects.toThrow(
      'Password is required for encryption'
    )

    expect(pearpassVaultClient.encryptExportData).not.toHaveBeenCalled()
  })
})
