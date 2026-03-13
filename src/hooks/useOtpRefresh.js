import { useContext } from 'react'

import { OtpRefreshContext } from '../context/OtpRefreshContext'

/**
 * Returns a function that triggers an immediate OTP codes refresh.
 * Call this after HOTP counter increments.
 * @returns {(() => void) | null}
 */
export const useOtpRefresh = () => {
  const ref = useContext(OtpRefreshContext)
  return ref ? () => ref.current?.() : null
}
