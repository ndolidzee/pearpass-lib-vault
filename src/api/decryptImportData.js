import { pearpassVaultClient } from '../instances'

/**
 * Decrypts an encrypted import file in the vault worklet.
 *
 * Supported formats:
 * - 'keepass'   — KDBX binary (pass the raw ArrayBuffer or Uint8Array; serialized to base64 automatically)
 * - 'bitwarden' — Bitwarden password-protected JSON export (JSON string)
 * - 'pearpass'  — PearPass encrypted JSON export (JSON string or parsed object)
 *
 * If format is omitted the function attempts auto-detection:
 * - ArrayBuffer / TypedArray input  → 'keepass'
 * - JSON with `passwordProtected: true` → 'bitwarden'
 * - JSON with `algorithm: 'XSalsa20-Poly1305'` → 'pearpass'
 *
 * @param {ArrayBuffer|Uint8Array|string|object} data
 * @param {string} password
 * @param {'keepass'|'bitwarden'|'pearpass'} [format]
 * @returns {Promise<object|Array>}
 */
export const decryptImportData = async (data, password, format) => {
  if (!password) {
    throw new Error('Password is required for decryption')
  }

  // Auto-detect format when not provided
  if (!format) {
    if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
      format = 'keepass'
    } else {
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data
        if (parsed.passwordProtected === true) {
          format = 'bitwarden'
        } else if (parsed.algorithm === 'XSalsa20-Poly1305') {
          format = 'pearpass'
        }
      } catch {
        // could not parse — format remains undefined
      }
    }

    if (!format) {
      throw new Error(
        'Cannot detect import format. Please pass format as the third argument: "keepass", "bitwarden", or "pearpass".'
      )
    }
  }

  // Serialize ArrayBuffer / TypedArray to base64 for RPC transport
  let serializedData = data
  if (format === 'keepass' && (data instanceof ArrayBuffer || ArrayBuffer.isView(data))) {
    const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    serializedData = Buffer.from(bytes).toString('base64')
  } else if (format === 'pearpass' && typeof data === 'object' && data !== null) {
    serializedData = JSON.stringify(data)
  }

  return pearpassVaultClient.decryptImportData(serializedData, password, format)
}
