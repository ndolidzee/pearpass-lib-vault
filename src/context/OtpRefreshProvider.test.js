import { createElement } from 'react'

import { configureStore } from '@reduxjs/toolkit'
import { renderHook, act, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'

import { OtpRefreshProvider } from './OtpRefreshProvider'
import { useOtpRefresh } from '../hooks/useOtpRefresh'
import otpReducer from '../slices/otpSlice'

const mockGenerateOtpCodesByIds = jest.fn()

jest.mock('../api/generateOtpCodesByIds', () => ({
  generateOtpCodesByIds: (...args) => mockGenerateOtpCodesByIds(...args)
}))

jest.mock('../utils/createAlignedInterval', () => ({
  createAlignedInterval: (callback) => {
    const id = setInterval(callback, 1000)
    return () => clearInterval(id)
  }
}))

jest.useFakeTimers()

const createTestStore = (records = []) =>
  configureStore({
    reducer: {
      vault: () => ({ data: { records } }),
      otp: otpReducer
    }
  })

const createWrapper =
  (store) =>
  ({ children }) =>
    createElement(
      Provider,
      { store },
      createElement(OtpRefreshProvider, null, children)
    )

describe('OtpRefreshProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('polls codes for records with otpPublic', async () => {
    const records = [
      { id: 'rec-1', otpPublic: { type: 'TOTP', period: 30 } },
      { id: 'rec-2', otpPublic: { type: 'TOTP', period: 30 } }
    ]

    mockGenerateOtpCodesByIds.mockResolvedValue([
      { recordId: 'rec-1', code: '123456', timeRemaining: 20 },
      { recordId: 'rec-2', code: '654321', timeRemaining: 20 }
    ])

    const store = createTestStore(records)
    renderHook(() => null, { wrapper: createWrapper(store) })

    await waitFor(() => {
      expect(mockGenerateOtpCodesByIds).toHaveBeenCalledWith(['rec-1', 'rec-2'])
    })
  })

  test('dispatches results to otp slice', async () => {
    const records = [{ id: 'rec-1', otpPublic: { type: 'TOTP', period: 30 } }]

    mockGenerateOtpCodesByIds.mockResolvedValue([
      { recordId: 'rec-1', code: '123456', timeRemaining: 20 }
    ])

    const store = createTestStore(records)
    renderHook(() => null, { wrapper: createWrapper(store) })

    await waitFor(() => {
      const state = store.getState()
      expect(state.otp.codes['rec-1']).toEqual({
        code: '123456',
        timeRemaining: 20
      })
    })
  })

  test('does not poll when no records have otpPublic', () => {
    const records = [{ id: 'rec-1' }, { id: 'rec-2' }]

    const store = createTestStore(records)
    renderHook(() => null, { wrapper: createWrapper(store) })

    expect(mockGenerateOtpCodesByIds).not.toHaveBeenCalled()
  })

  test('only polls for records that have otpPublic', async () => {
    const records = [
      { id: 'rec-1', otpPublic: { type: 'TOTP', period: 30 } },
      { id: 'rec-2' },
      { id: 'rec-3', otpPublic: { type: 'TOTP', period: 30 } }
    ]

    mockGenerateOtpCodesByIds.mockResolvedValue([])

    const store = createTestStore(records)
    renderHook(() => null, { wrapper: createWrapper(store) })

    await waitFor(() => {
      expect(mockGenerateOtpCodesByIds).toHaveBeenCalledWith(['rec-1', 'rec-3'])
    })
  })

  test('refreshes codes on interval tick', async () => {
    const records = [{ id: 'rec-1', otpPublic: { type: 'TOTP', period: 30 } }]

    mockGenerateOtpCodesByIds.mockResolvedValue([
      { recordId: 'rec-1', code: '111111', timeRemaining: 25 }
    ])

    const store = createTestStore(records)
    renderHook(() => null, { wrapper: createWrapper(store) })

    await waitFor(() => {
      expect(mockGenerateOtpCodesByIds).toHaveBeenCalledTimes(1)
    })

    await act(async () => {
      jest.advanceTimersByTime(2000)
    })

    await waitFor(() => {
      expect(mockGenerateOtpCodesByIds).toHaveBeenCalledTimes(3)
    })
  })

  test('cleans up interval on unmount', async () => {
    const records = [{ id: 'rec-1', otpPublic: { type: 'TOTP', period: 30 } }]

    mockGenerateOtpCodesByIds.mockResolvedValue([
      { recordId: 'rec-1', code: '111111', timeRemaining: 20 }
    ])

    const store = createTestStore(records)
    const { unmount } = renderHook(() => null, {
      wrapper: createWrapper(store)
    })

    await waitFor(() => {
      expect(mockGenerateOtpCodesByIds).toHaveBeenCalledTimes(1)
    })

    unmount()
    mockGenerateOtpCodesByIds.mockClear()

    await act(async () => {
      jest.advanceTimersByTime(3000)
    })

    expect(mockGenerateOtpCodesByIds).not.toHaveBeenCalled()
  })

  test('handles API errors gracefully', async () => {
    const records = [{ id: 'rec-1', otpPublic: { type: 'TOTP', period: 30 } }]

    mockGenerateOtpCodesByIds.mockRejectedValue(new Error('Network error'))

    const store = createTestStore(records)
    renderHook(() => null, { wrapper: createWrapper(store) })

    await act(async () => {
      await Promise.resolve()
    })

    expect(store.getState().otp.codes).toEqual({})
  })

  test('useOtpRefresh triggers an immediate refresh', async () => {
    const records = [{ id: 'rec-1', otpPublic: { type: 'TOTP', period: 30 } }]

    mockGenerateOtpCodesByIds.mockResolvedValue([
      { recordId: 'rec-1', code: '111111', timeRemaining: 25 }
    ])

    const store = createTestStore(records)
    const { result } = renderHook(() => useOtpRefresh(), {
      wrapper: createWrapper(store)
    })

    await waitFor(() => {
      expect(mockGenerateOtpCodesByIds).toHaveBeenCalledTimes(1)
    })

    mockGenerateOtpCodesByIds.mockResolvedValue([
      { recordId: 'rec-1', code: '222222', timeRemaining: 30 }
    ])

    await act(async () => {
      result.current()
    })

    await waitFor(() => {
      expect(store.getState().otp.codes['rec-1']).toEqual({
        code: '222222',
        timeRemaining: 30
      })
    })
  })
})
