import { getMyDeviceId } from './getMyDeviceId'
import { pearpassVaultClient, setPearpassVaultClient } from '../instances'

describe('getMyDeviceId', () => {
  beforeEach(() => {
    setPearpassVaultClient(pearpassVaultClient, { currentDeviceName: null })
    pearpassVaultClient.activeVaultGetWriterKey.mockReset()
    pearpassVaultClient.activeVaultList.mockReset()
  })

  describe('primary path (writerKey match)', () => {
    it('returns the deviceId whose writerKey matches mine', async () => {
      pearpassVaultClient.activeVaultGetWriterKey.mockResolvedValue('w-bbb')
      pearpassVaultClient.activeVaultList.mockResolvedValue([
        { id: 'AAA', name: 'macos 15.0', writerKey: 'w-aaa' },
        { id: 'BBB', name: 'ios 18.0', writerKey: 'w-bbb' }
      ])
      expect(await getMyDeviceId()).toBe('BBB')
    })

    it('writerKey match wins even if a different name-only record matches the singleton', async () => {
      setPearpassVaultClient(pearpassVaultClient, {
        currentDeviceName: 'ios 18.0'
      })
      pearpassVaultClient.activeVaultGetWriterKey.mockResolvedValue('w-bbb')
      pearpassVaultClient.activeVaultList.mockResolvedValue([
        { id: 'OLD', name: 'ios 18.0' },
        { id: 'BBB', name: 'ios 18.0', writerKey: 'w-bbb' }
      ])
      expect(await getMyDeviceId()).toBe('BBB')
    })
  })

  describe('legacy fallback (name match via singleton)', () => {
    it('returns the legacy record id when writerKey does not match and singleton name does', async () => {
      setPearpassVaultClient(pearpassVaultClient, {
        currentDeviceName: 'ios 18.0'
      })
      pearpassVaultClient.activeVaultGetWriterKey.mockResolvedValue('w-bbb')
      pearpassVaultClient.activeVaultList.mockResolvedValue([
        { id: 'OLD', name: 'ios 18.0' }
      ])
      expect(await getMyDeviceId()).toBe('OLD')
    })

    it('matches by name even when the record has a stale writerKey', async () => {
      // Covers reinstall drift: this device used to be writerKey 'w-other',
      // wrote that into the vault, then reinstalled and now its local
      // autopass is 'w-bbb'. The vault record is stale until addDevice
      // self-heals it. byName fallback must still resolve to that record so
      // the device can identify itself in the meantime.
      setPearpassVaultClient(pearpassVaultClient, {
        currentDeviceName: 'ios 18.0'
      })
      pearpassVaultClient.activeVaultGetWriterKey.mockResolvedValue('w-bbb')
      pearpassVaultClient.activeVaultList.mockResolvedValue([
        { id: 'STALE', name: 'ios 18.0', writerKey: 'w-other' }
      ])
      expect(await getMyDeviceId()).toBe('STALE')
    })

    it('prefers the most-recently-created record when multiple share a name', async () => {
      setPearpassVaultClient(pearpassVaultClient, {
        currentDeviceName: 'ios 18.0'
      })
      pearpassVaultClient.activeVaultGetWriterKey.mockResolvedValue('w-bbb')
      pearpassVaultClient.activeVaultList.mockResolvedValue([
        { id: 'OLDER', name: 'ios 18.0', createdAt: 100 },
        { id: 'NEWER', name: 'ios 18.0', writerKey: 'w-other', createdAt: 200 }
      ])
      expect(await getMyDeviceId()).toBe('NEWER')
    })

    it('returns null when no singleton deviceName is set', async () => {
      pearpassVaultClient.activeVaultGetWriterKey.mockResolvedValue('w-bbb')
      pearpassVaultClient.activeVaultList.mockResolvedValue([
        { id: 'OLD', name: 'ios 18.0' }
      ])
      expect(await getMyDeviceId()).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('returns null when no writerKey is available', async () => {
      pearpassVaultClient.activeVaultGetWriterKey.mockResolvedValue(null)
      expect(await getMyDeviceId()).toBeNull()
    })

    it('handles a missing device list gracefully', async () => {
      pearpassVaultClient.activeVaultGetWriterKey.mockResolvedValue('w-bbb')
      pearpassVaultClient.activeVaultList.mockResolvedValue(null)
      expect(await getMyDeviceId()).toBeNull()
    })
  })
})
