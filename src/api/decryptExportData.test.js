import { pearpassVaultClient } from '../instances'
import { decryptExportData } from './decryptExportData'

jest.mock('../instances', () => ({
  pearpassVaultClient: {
    decryptExportData: jest.fn()
  }
}))

describe('decryptExportData', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should decrypt encrypted data with password', async () => {
    const encryptedData = {
      version: '1.0',
      encrypted: true,
      algorithm: 'XSalsa20-Poly1305',
      kdf: 'Argon2id',
      salt: 'mockSalt',
      nonce: 'mockNonce',
      ciphertext: 'mockCiphertext'
    }

    const mockDecryptedData = 'decrypted data'

    pearpassVaultClient.decryptExportData.mockResolvedValue(mockDecryptedData)

    const result = await decryptExportData(encryptedData, 'password123')

    expect(pearpassVaultClient.decryptExportData).toHaveBeenCalledWith(
      encryptedData,
      'password123'
    )
    expect(result).toBe(mockDecryptedData)
  })

  it('should throw error if data is not encrypted', async () => {
    const plainData = {
      encrypted: false,
      data: 'some data'
    }

    await expect(decryptExportData(plainData, 'password')).rejects.toThrow(
      'Data is not encrypted'
    )

    expect(pearpassVaultClient.decryptExportData).not.toHaveBeenCalled()
  })

  it('should throw error if password is not provided', async () => {
    const encryptedData = {
      encrypted: true,
      salt: 'salt',
      nonce: 'nonce',
      ciphertext: 'cipher'
    }

    await expect(decryptExportData(encryptedData, '')).rejects.toThrow(
      'Password is required for decryption'
    )

    expect(pearpassVaultClient.decryptExportData).not.toHaveBeenCalled()
  })

  it('should throw error if password is null', async () => {
    const encryptedData = {
      encrypted: true,
      salt: 'salt',
      nonce: 'nonce',
      ciphertext: 'cipher'
    }

    await expect(decryptExportData(encryptedData, null)).rejects.toThrow(
      'Password is required for decryption'
    )

    expect(pearpassVaultClient.decryptExportData).not.toHaveBeenCalled()
  })
})
