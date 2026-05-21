import { pearpassVaultClient } from '../instances'

/**
 * @returns {Promise<Array<{
 *   id: string,
 *   type: string,
 *   data: { title?: string, username?: string, otp: object }
 * }>>}
 */
export const exportOtpRecords = async () =>
  pearpassVaultClient.exportOtpRecords()
