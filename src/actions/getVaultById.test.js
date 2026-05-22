import { getVaultById } from './getVaultById'
import { getVaultById as getVaultByIdApi } from '../api/getVaultById'
import { listDevices } from '../api/listDevices'
import { listRecords } from '../api/listRecords'
import { setCurrentDeviceName } from '../instances'

jest.mock('../api/getVaultById', () => ({
  getVaultById: jest.fn()
}))

jest.mock('../api/listRecords', () => ({
  listRecords: jest.fn()
}))

jest.mock('../api/listDevices', () => ({
  listDevices: jest.fn()
}))

jest.mock('../utils/addDeviceFactory', () => ({
  addDeviceFactory: (deviceName, vaultId, writerKey, masterTopic) => ({
    id: 'new-device-id',
    vaultId,
    name: deviceName,
    writerKey,
    createdAt: 1700000000000,
    ...(masterTopic ? { masterTopic } : {})
  })
}))

jest.mock('../api/inbox', () => ({
  registerPeer: jest.fn().mockResolvedValue(undefined)
}))

describe('getVaultById', () => {
  const mockVaultId = 'vault-123'
  const mockParams = { password: 'password123' }
  const mockArguments = { vaultId: mockVaultId, params: mockParams }
  const mockVault = { id: mockVaultId, name: 'Test Vault' }
  const mockRecords = [{ id: 'record-1' }, { id: 'record-2' }]
  const mockDevices = []

  let dispatch
  let getState

  beforeEach(() => {
    jest.clearAllMocks()
    dispatch = jest.fn()
    getState = jest.fn()
    getVaultByIdApi.mockResolvedValue(mockVault)
    listRecords.mockResolvedValue(mockRecords)
    listDevices.mockResolvedValue(mockDevices)
    setCurrentDeviceName(null)
  })

  afterEach(() => {
    setCurrentDeviceName(null)
  })

  it('should call getVaultByIdApi with correct vaultId and params', async () => {
    const thunk = getVaultById(mockArguments)
    await thunk(dispatch, getState)

    expect(getVaultByIdApi).toHaveBeenCalledWith(mockVaultId, mockParams)
  })

  it('should call listRecords with vault id', async () => {
    const thunk = getVaultById(mockArguments)
    await thunk(dispatch, getState)

    expect(listRecords).toHaveBeenCalledWith(mockVaultId)
  })

  it('should call listDevices with vault id', async () => {
    const thunk = getVaultById(mockArguments)
    await thunk(dispatch, getState)

    expect(listDevices).toHaveBeenCalledWith(mockVaultId)
  })

  it('should return vault with records and devices', async () => {
    const thunk = getVaultById(mockArguments)
    const result = await thunk(dispatch, getState)

    expect(result.payload).toEqual({
      ...mockVault,
      records: mockRecords,
      devices: mockDevices
    })
  })

  it('should handle empty records array', async () => {
    listRecords.mockResolvedValue(null)

    const thunk = getVaultById(mockArguments)
    const result = await thunk(dispatch, getState)

    expect(result.payload).toEqual({
      ...mockVault,
      records: [],
      devices: mockDevices
    })
  })

  it('should handle empty devices array', async () => {
    listDevices.mockResolvedValue(null)

    const thunk = getVaultById(mockArguments)
    const result = await thunk(dispatch, getState)

    expect(result.payload).toEqual({
      ...mockVault,
      records: mockRecords,
      devices: []
    })
  })

  it('should throw error when vaultId is not provided', async () => {
    const thunk = getVaultById()
    const result = await thunk(dispatch, getState).catch((e) => e)

    expect(result.type).toBe(getVaultById.rejected.type)
    expect(result.error.message).toContain('Vault ID is required')
  })

  it('should throw error when vault is not found', async () => {
    getVaultByIdApi.mockResolvedValue(null)

    const thunk = getVaultById(mockArguments)
    const result = await thunk(dispatch, getState).catch((e) => e)

    expect(result.type).toBe(getVaultById.rejected.type)
    expect(result.error.message).toContain('Vault not found')
  })

  it('should handle rejection when API call fails', async () => {
    const errorMessage = 'Failed to get vault'
    getVaultByIdApi.mockRejectedValue(new Error(errorMessage))

    const thunk = getVaultById(mockArguments)
    const result = await thunk(dispatch, getState).catch((e) => e)

    expect(result.type).toBe(getVaultById.rejected.type)
    expect(result.error.message).toContain(errorMessage)
  })

  describe('healLocalDeviceEntry', () => {
    const { pearpassVaultClient } = require('../instances')

    it('patches a name-matched entry when our writerKey is stale', async () => {
      setCurrentDeviceName('desktop-1 darwin 23.0')
      pearpassVaultClient.activeVaultGetWriterKey.mockResolvedValueOnce(
        'new-writer'
      )
      pearpassVaultClient.personalSwarmGetTopic = jest
        .fn()
        .mockResolvedValueOnce('topic-1')
      const stale = {
        id: 'D1',
        vaultId: mockVaultId,
        name: 'desktop-1 darwin 23.0',
        writerKey: 'old-writer',
        masterTopic: 'topic-1',
        createdAt: 1000
      }
      listDevices.mockResolvedValue([stale])

      const result = await getVaultById(mockArguments)(dispatch, getState)

      expect(pearpassVaultClient.activeVaultAdd).toHaveBeenCalledWith(
        'device/D1',
        expect.objectContaining({
          id: 'D1',
          writerKey: 'new-writer',
          masterTopic: 'topic-1'
        })
      )
      expect(result.payload.devices[0].writerKey).toBe('new-writer')
    })

    it('fresh-creates an entry when neither writerKey nor name matches so getMyDeviceId resolves', async () => {
      setCurrentDeviceName('desktop-1 darwin 23.4')
      pearpassVaultClient.activeVaultGetWriterKey.mockResolvedValueOnce(
        'new-writer'
      )
      pearpassVaultClient.personalSwarmGetTopic = jest
        .fn()
        .mockResolvedValueOnce(null)
      const orphan = {
        id: 'D0',
        vaultId: mockVaultId,
        name: 'desktop-1 darwin 23.0',
        writerKey: 'old-writer',
        createdAt: 1000
      }
      listDevices.mockResolvedValue([orphan])

      const result = await getVaultById(mockArguments)(dispatch, getState)

      expect(pearpassVaultClient.activeVaultAdd).toHaveBeenCalledWith(
        'device/new-device-id',
        expect.objectContaining({
          id: 'new-device-id',
          name: 'desktop-1 darwin 23.4',
          writerKey: 'new-writer',
          vaultId: mockVaultId
        })
      )
      expect(result.payload.devices).toHaveLength(2)
      expect(result.payload.devices[1].id).toBe('new-device-id')
    })

    it('swallows "Not writable" heal errors without logging (kicked-peer transient state)', async () => {
      setCurrentDeviceName('desktop-1 darwin 23.0')
      pearpassVaultClient.activeVaultGetWriterKey.mockResolvedValueOnce(
        'new-writer'
      )
      pearpassVaultClient.personalSwarmGetTopic = jest
        .fn()
        .mockResolvedValueOnce(null)
      pearpassVaultClient.activeVaultAdd.mockRejectedValueOnce(
        new Error('Not writable')
      )
      const stale = {
        id: 'D0',
        vaultId: mockVaultId,
        name: 'desktop-1 darwin 23.0',
        writerKey: 'old-writer',
        createdAt: 1000
      }
      listDevices.mockResolvedValue([stale])

      const result = await getVaultById(mockArguments)(dispatch, getState)

      expect(result.payload.devices).toEqual([stale])
    })

    it('serialises concurrent heal invocations so two parallel callers do not both fresh-create', async () => {
      setCurrentDeviceName('desktop-1 darwin 23.0')
      pearpassVaultClient.activeVaultGetWriterKey.mockResolvedValue(
        'new-writer'
      )
      pearpassVaultClient.personalSwarmGetTopic = jest
        .fn()
        .mockResolvedValue(null)
      // First listDevices snapshot is empty (forces fresh-create). After the
      // first heal writes, subsequent listDevices reads include the entry so
      // the parallel caller short-circuits on byWriterKey.
      const fresh = {
        id: 'new-device-id',
        vaultId: mockVaultId,
        name: 'desktop-1 darwin 23.0',
        writerKey: 'new-writer',
        createdAt: 1700000000000
      }
      let activeVaultAddCalls = 0
      pearpassVaultClient.activeVaultAdd.mockImplementation(async () => {
        activeVaultAddCalls += 1
      })
      let listDevicesCalls = 0
      listDevices.mockImplementation(async () => {
        listDevicesCalls += 1
        return activeVaultAddCalls > 0 ? [fresh] : []
      })

      const [a, b] = await Promise.all([
        getVaultById(mockArguments)(dispatch, getState),
        getVaultById(mockArguments)(dispatch, getState)
      ])

      expect(activeVaultAddCalls).toBe(1)
      expect(a.payload.devices).toEqual([fresh])
      expect(b.payload.devices).toEqual([fresh])
      expect(listDevicesCalls).toBeGreaterThan(1)
    })

    it('leaves devices unchanged when device name is unknown and writerKey has no match', async () => {
      setCurrentDeviceName(null)
      pearpassVaultClient.activeVaultGetWriterKey.mockResolvedValueOnce(
        'new-writer'
      )
      const orphan = {
        id: 'D0',
        vaultId: mockVaultId,
        name: 'someone-else',
        writerKey: 'other-writer'
      }
      listDevices.mockResolvedValue([orphan])

      const result = await getVaultById(mockArguments)(dispatch, getState)

      expect(pearpassVaultClient.activeVaultAdd).not.toHaveBeenCalled()
      expect(result.payload.devices).toEqual([orphan])
    })
  })
})
