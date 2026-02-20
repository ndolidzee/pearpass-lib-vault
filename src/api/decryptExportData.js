import { pearpassVaultClient } from '../instances'

/**
 * @param {Object} encryptedData
 * @param {string} encryptedData.version
 * @param {boolean} encryptedData.encrypted
 * @param {string} encryptedData.algorithm
 * @param {string} encryptedData.kdf
 * @param {string} encryptedData.salt
 * @param {string} encryptedData.nonce
 * @param {string} encryptedData.ciphertext
 * @param {string} password
 * @returns {Promise<string>}
 */
export const decryptExportData = async (encryptedData, password) => {
  if (!encryptedData.encrypted) {
    throw new Error('Data is not encrypted')
  }

  if (!password) {
    throw new Error('Password is required for decryption')
  }

  return pearpassVaultClient.decryptExportData(encryptedData, password)
}
