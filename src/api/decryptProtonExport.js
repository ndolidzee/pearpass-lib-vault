import { pearpassVaultClient } from '../instances'

/**
 * @param {{ version: number, salt: string, content: string, password: string }} params
 * @returns {Promise<string>} Decrypted UTF-8 plaintext
 */
export const decryptProtonExport = async (params) => {
  if (!params?.password) {
    throw new Error('Password is required')
  }

  if (!params?.salt || !params?.content) {
    throw new Error('Export data is required')
  }

  return pearpassVaultClient.decryptProtonExport(params)
}
