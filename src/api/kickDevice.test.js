jest.mock('./broadcastAction', () => ({
  broadcastAction: jest.fn()
}))

jest.mock('./listDevices', () => ({
  listDevices: jest.fn()
}))

jest.mock('../actions', () => ({
  ACTION_TYPES: { KICK_DEVICE: 'kick-device' }
}))

import { broadcastAction } from './broadcastAction'
import { kickDevice } from './kickDevice'
import { listDevices } from './listDevices'
import { pearpassVaultClient } from '../instances'

describe('kickDevice', () => {
  beforeEach(() => {
    broadcastAction.mockReset()
    broadcastAction.mockResolvedValue({ results: [], failures: [] })
    listDevices.mockReset()
    pearpassVaultClient.activeVaultGetWriterKey.mockReset()
    pearpassVaultClient.activeVaultGetWriterKey.mockResolvedValue('w-self')
    pearpassVaultClient.activeVaultRemoveWriter.mockReset()
    pearpassVaultClient.activeVaultRemoveWriter.mockResolvedValue(undefined)
    pearpassVaultClient.activeVaultRemove.mockReset()
    pearpassVaultClient.activeVaultRemove.mockResolvedValue(undefined)
  })

  it('rejects when vaultId is missing', async () => {
    await expect(kickDevice({ targetDeviceId: 'B' })).rejects.toThrow(
      'vaultId is required'
    )
  })

  it('rejects when targetDeviceId is missing', async () => {
    await expect(kickDevice({ vaultId: 'v1' })).rejects.toThrow(
      'targetDeviceId is required'
    )
  })

  it('rejects when own writer key cannot be resolved', async () => {
    pearpassVaultClient.activeVaultGetWriterKey.mockResolvedValue(null)
    await expect(
      kickDevice({ vaultId: 'v1', targetDeviceId: 'B' })
    ).rejects.toThrow('cannot resolve own writer key')
  })

  it('rejects when target shares our writer key (self)', async () => {
    listDevices.mockResolvedValue([{ id: 'SELF', writerKey: 'w-self' }])
    await expect(
      kickDevice({ vaultId: 'v1', targetDeviceId: 'SELF' })
    ).rejects.toThrow('cannot kick self')
    expect(pearpassVaultClient.activeVaultRemoveWriter).not.toHaveBeenCalled()
  })

  it('rejects when target device is not in the vault', async () => {
    listDevices.mockResolvedValue([{ id: 'SELF', writerKey: 'w-self' }])
    await expect(
      kickDevice({ vaultId: 'v1', targetDeviceId: 'B' })
    ).rejects.toThrow('target device not found')
    expect(pearpassVaultClient.activeVaultRemoveWriter).not.toHaveBeenCalled()
  })

  it('broadcasts before removing writer/entry so the envelope still finds the target', async () => {
    listDevices.mockResolvedValue([
      { id: 'SELF', writerKey: 'w-self' },
      { id: 'B', writerKey: 'w-b' }
    ])

    const callOrder = []
    broadcastAction.mockImplementation(async () => {
      callOrder.push('broadcast')
      return { results: [], failures: [] }
    })
    pearpassVaultClient.activeVaultRemoveWriter.mockImplementation(async () => {
      callOrder.push('removeWriter')
    })
    pearpassVaultClient.activeVaultRemove.mockImplementation(async () => {
      callOrder.push('removeEntry')
    })

    await kickDevice({ vaultId: 'v1', targetDeviceId: 'B' })

    expect(pearpassVaultClient.activeVaultRemoveWriter).toHaveBeenCalledWith(
      'w-b'
    )
    expect(pearpassVaultClient.activeVaultRemove).toHaveBeenCalledWith(
      'device/B'
    )
    expect(callOrder).toEqual(['broadcast', 'removeWriter', 'removeEntry'])
    expect(broadcastAction).toHaveBeenCalledWith({
      type: 'kick-device',
      payload: { vaultId: 'v1', targetDeviceId: 'B', targetWriterKey: 'w-b' },
      targets: ['B']
    })
  })

  it('skips removeWriter when target has no writerKey but still removes entry and broadcasts', async () => {
    listDevices.mockResolvedValue([
      { id: 'SELF', writerKey: 'w-self' },
      { id: 'B' }
    ])

    await kickDevice({ vaultId: 'v1', targetDeviceId: 'B' })

    expect(pearpassVaultClient.activeVaultRemoveWriter).not.toHaveBeenCalled()
    expect(pearpassVaultClient.activeVaultRemove).toHaveBeenCalledWith(
      'device/B'
    )
    expect(broadcastAction).toHaveBeenCalledWith({
      type: 'kick-device',
      payload: { vaultId: 'v1', targetDeviceId: 'B', targetWriterKey: null },
      targets: ['B']
    })
  })

  it('forwards broadcastAction result to the caller', async () => {
    listDevices.mockResolvedValue([
      { id: 'SELF', writerKey: 'w-self' },
      { id: 'B', writerKey: 'w-b' }
    ])
    broadcastAction.mockResolvedValue({
      results: [],
      failures: [{ targetDeviceId: 'B', error: new Error('boom') }]
    })

    const result = await kickDevice({ vaultId: 'v1', targetDeviceId: 'B' })

    expect(result.failures).toHaveLength(1)
  })

  it('treats a broadcastAction throw as a partial-delivery failure but still completes the autobase ops', async () => {
    listDevices.mockResolvedValue([
      { id: 'SELF', writerKey: 'w-self' },
      { id: 'B', writerKey: 'w-b' }
    ])
    const boom = new Error('cannot resolve own device id')
    broadcastAction.mockRejectedValue(boom)

    const result = await kickDevice({ vaultId: 'v1', targetDeviceId: 'B' })

    expect(pearpassVaultClient.activeVaultRemoveWriter).toHaveBeenCalledWith(
      'w-b'
    )
    expect(pearpassVaultClient.activeVaultRemove).toHaveBeenCalledWith(
      'device/B'
    )
    expect(result.results).toEqual([])
    expect(result.failures).toEqual([{ targetDeviceId: 'B', error: boom }])
  })

  it('removes every device entry mapped to the same writerKey so duplicate rows for the same peer are not stranded', async () => {
    listDevices.mockResolvedValue([
      { id: 'SELF', writerKey: 'w-self' },
      { id: 'B1', writerKey: 'w-b' },
      { id: 'B2', writerKey: 'w-b' }
    ])

    await kickDevice({ vaultId: 'v1', targetDeviceId: 'B1' })

    expect(pearpassVaultClient.activeVaultRemoveWriter).toHaveBeenCalledTimes(1)
    expect(pearpassVaultClient.activeVaultRemoveWriter).toHaveBeenCalledWith(
      'w-b'
    )
    expect(pearpassVaultClient.activeVaultRemove).toHaveBeenCalledWith(
      'device/B1'
    )
    expect(pearpassVaultClient.activeVaultRemove).toHaveBeenCalledWith(
      'device/B2'
    )
    expect(pearpassVaultClient.activeVaultRemove).toHaveBeenCalledTimes(2)
  })

  it('treats an autobase removal throw as a partial-delivery failure without throwing', async () => {
    listDevices.mockResolvedValue([
      { id: 'SELF', writerKey: 'w-self' },
      { id: 'B', writerKey: 'w-b' }
    ])
    const boom = new Error('autobase removal failed')
    pearpassVaultClient.activeVaultRemove.mockRejectedValue(boom)

    const result = await kickDevice({ vaultId: 'v1', targetDeviceId: 'B' })

    expect(broadcastAction).toHaveBeenCalled()
    expect(pearpassVaultClient.activeVaultRemoveWriter).toHaveBeenCalledWith(
      'w-b'
    )
    expect(result.failures).toEqual([{ targetDeviceId: 'B', error: boom }])
  })
})
