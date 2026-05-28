import { renderHook, act } from '@testing-library/react'

const mockDispatch = jest.fn()
const mockGenerateHotpNext = jest.fn()

jest.mock('react-redux', () => ({
  useDispatch: jest.fn(() => mockDispatch)
}))

jest.mock('../api/generateHotpNext', () => ({
  generateHotpNext: (...args) => mockGenerateHotpNext(...args)
}))

jest.mock('./useOtpRefresh', () => ({
  useOtpRefresh: jest.fn(() => null)
}))

const { useOtp } = require('./useOtp')

describe('useOtp', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDispatch.mockResolvedValue({})
  })

  test('returns null values when otpPublic is undefined', () => {
    const { result } = renderHook(() =>
      useOtp({ recordId: 'rec-1', otpPublic: undefined })
    )

    expect(result.current.code).toBeNull()
    expect(result.current.timeRemaining).toBeNull()
    expect(result.current.type).toBeNull()
    expect(result.current.period).toBeNull()
    expect(result.current.generateNext).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  test('TOTP reads code and timeRemaining from otpPublic', () => {
    const otpPublic = {
      type: 'TOTP',
      digits: 6,
      period: 30,
      currentCode: '123456',
      timeRemaining: 20
    }

    const { result } = renderHook(() =>
      useOtp({ recordId: 'rec-1', otpPublic })
    )

    expect(result.current.code).toBe('123456')
    expect(result.current.timeRemaining).toBe(20)
    expect(result.current.type).toBe('TOTP')
    expect(result.current.period).toBe(30)
    expect(result.current.generateNext).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  test('TOTP reflects updated otpPublic when props change', () => {
    let otpPublic = {
      type: 'TOTP',
      digits: 6,
      period: 30,
      currentCode: '123456',
      timeRemaining: 20
    }

    const { result, rerender } = renderHook(
      ({ op }) => useOtp({ recordId: 'rec-1', otpPublic: op }),
      { initialProps: { op: otpPublic } }
    )

    expect(result.current.code).toBe('123456')

    otpPublic = { ...otpPublic, currentCode: '999888', timeRemaining: 25 }
    rerender({ op: otpPublic })

    expect(result.current.code).toBe('999888')
    expect(result.current.timeRemaining).toBe(25)
  })

  test('TOTP updates code when otpPublic prop updates', () => {
    let otpPublic = {
      type: 'TOTP',
      digits: 6,
      period: 30,
      currentCode: '123456',
      timeRemaining: 2
    }

    const { result, rerender } = renderHook(
      ({ op }) => useOtp({ recordId: 'rec-1', otpPublic: op }),
      { initialProps: { op: otpPublic } }
    )

    otpPublic = { ...otpPublic, currentCode: '222222', timeRemaining: 30 }
    rerender({ op: otpPublic })

    expect(result.current.code).toBe('222222')
    expect(result.current.timeRemaining).toBe(30)
  })

  test('HOTP initializes with currentCode and exposes generateNext', () => {
    const otpPublic = {
      type: 'HOTP',
      digits: 6,
      currentCode: '111222'
    }

    const { result } = renderHook(() =>
      useOtp({ recordId: 'rec-1', otpPublic })
    )

    expect(result.current.code).toBe('111222')
    expect(result.current.type).toBe('HOTP')
    expect(result.current.timeRemaining).toBeNull()
    expect(result.current.generateNext).toBeInstanceOf(Function)
  })

  test('HOTP generateNext calls generateHotpNext and dispatches result', async () => {
    const otpPublic = {
      type: 'HOTP',
      digits: 6,
      currentCode: '111222'
    }

    mockGenerateHotpNext.mockResolvedValue({ code: '333444', counter: 1 })

    const { result } = renderHook(() =>
      useOtp({ recordId: 'rec-1', otpPublic })
    )

    await act(async () => {
      await result.current.generateNext()
    })

    expect(mockGenerateHotpNext).toHaveBeenCalledWith('rec-1')
    expect(mockDispatch).toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
  })
})
