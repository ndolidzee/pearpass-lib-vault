import { pearpassVaultClient } from '../instances'

/**
 * @param {{ slots: Object[], params: { nonce: string, tag: string }, db: string, password: string }} params
 * @returns {Promise<string>} Decrypted `db` as a UTF-8 JSON string
 */
export const decryptAegisExport = async (params) => {
  if (!params?.password) {
    throw new Error('Password is required')
  }

  if (!params?.slots || !params?.db) {
    throw new Error('Export data is required')
  }

  return pearpassVaultClient.decryptAegisExport(params)
}
