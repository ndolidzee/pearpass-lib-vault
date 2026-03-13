import { createElement } from 'react'

import { configureStore } from '@reduxjs/toolkit'
import { renderHook } from '@testing-library/react'
import { Provider } from 'react-redux'

import { useOtpRefresh } from './useOtpRefresh'
import { OtpRefreshProvider } from '../context/OtpRefreshProvider'

jest.mock('../api/generateOtpCodesByIds', () => ({
  generateOtpCodesByIds: jest.fn().mockResolvedValue([])
}))

jest.mock('../utils/createAlignedInterval', () => ({
  createAlignedInterval: () => () => {}
}))

const createTestStore = (records = []) =>
  configureStore({
    reducer: {
      vault: () => ({ data: { records } }),
      otp: () => ({ codes: {} })
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

describe('useOtpRefresh', () => {
  test('returns null when not wrapped in OtpRefreshProvider', () => {
    const { result } = renderHook(() => useOtpRefresh())

    expect(result.current).toBeNull()
  })

  test('returns a function when wrapped in OtpRefreshProvider', () => {
    const store = createTestStore()
    const { result } = renderHook(() => useOtpRefresh(), {
      wrapper: createWrapper(store)
    })

    expect(result.current).toBeInstanceOf(Function)
  })
})
