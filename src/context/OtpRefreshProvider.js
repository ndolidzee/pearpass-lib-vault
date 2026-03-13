import { createElement, useCallback, useEffect, useRef } from 'react'

import { useDispatch, useSelector } from 'react-redux'
import { shallowEqual } from 'react-redux'

import { OtpRefreshContext } from './OtpRefreshContext'
import { generateOtpCodesByIds } from '../api/generateOtpCodesByIds'
import { updateOtpCodes } from '../slices/otpSlice'
import { createAlignedInterval } from '../utils/createAlignedInterval'

/**
 * Centralized OTP poller component.
 * Reads OTP record IDs from Redux, polls codes every second,
 * and dispatches results to the otp slice.
 */
const OtpPoller = ({ refreshRef }) => {
  const dispatch = useDispatch()

  const otpRecordIds = useSelector(
    (state) =>
      state.vault.data?.records?.filter((r) => r.otpPublic).map((r) => r.id) ??
      [],
    shallowEqual
  )

  const otpRecordIdsRef = useRef(otpRecordIds)
  otpRecordIdsRef.current = otpRecordIds

  const refresh = useCallback(async () => {
    const ids = otpRecordIdsRef.current
    if (!ids.length) return

    try {
      const results = await generateOtpCodesByIds(ids)
      dispatch(updateOtpCodes(results))
    } catch {
      // Will retry on next tick
    }
  }, [dispatch])

  useEffect(() => {
    if (refreshRef) refreshRef.current = refresh
    return () => {
      if (refreshRef) refreshRef.current = null
    }
  }, [refreshRef, refresh])

  useEffect(() => {
    if (!otpRecordIds.length) return

    refresh()
    return createAlignedInterval(refresh)
  }, [otpRecordIds.length, refresh])

  return null
}

/**
 * Provider that manages centralized OTP polling.
 * Place above all components that consume OTP data via useRecords/useRecordById.
 */
export const OtpRefreshProvider = ({ children }) => {
  const refreshRef = useRef(null)
  return createElement(
    OtpRefreshContext.Provider,
    { value: refreshRef },
    createElement(OtpPoller, { refreshRef }),
    children
  )
}
