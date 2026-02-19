import { pearpassVaultClient } from '../instances'

/**
 * @param {string} data
 * @param {string} password
 * @returns {Promise<{
 *   version: string,
 *   encrypted: boolean,
 *   algorithm: string,
 *   kdf: string,
 *   salt: string,
 *   nonce: string,
 *   ciphertext: string
 * }>}
 */
export const encryptExportData = async (data, password) => {
  if (!password) {
    throw new Error('Password is required for encryption')
  }

  return pearpassVaultClient.encryptExportData(data, password)
}
