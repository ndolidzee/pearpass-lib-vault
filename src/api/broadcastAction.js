import { ACTION_TYPES } from '../actions'
import { listDevices } from './listDevices'
import { outboxAppend } from './outbox'
import { getMyDeviceId } from '../utils/getMyDeviceId'
import { logger } from '../utils/logger'

/**
 * Persist one outbox envelope per peer and kick the action runner. The actual
 * swarm delivery happens asynchronously in processOutbox, so callers never
 * block on transport.
 *
 * @param {{ type: string, payload?: any }} action
 * @returns {Promise<{
 *   results: Array<{ targetDeviceId: string, channel: 'outbox' }>,
 *   failures: Array<{ targetDeviceId: string, error: Error }>
 * }>}
 */
export const broadcastAction = async ({ type, payload } = {}) => {
  if (!type) {
    throw new Error('broadcastAction: type is required')
  }

  if (!Object.values(ACTION_TYPES).includes(type)) {
    throw new Error('broadcastAction: unknown action type: ' + type)
  }

  const myDeviceId = await getMyDeviceId()
  if (!myDeviceId) {
    throw new Error('broadcastAction: cannot resolve own device id')
  }

  const devices = (await listDevices()) ?? []
  const others = devices.filter((d) => d?.id && d.id !== myDeviceId)

  const envelopeBase = {
    type,
    payload,
    actor: myDeviceId,
    sentAt: new Date().toISOString()
  }

  const results = []
  const failures = []

  for (const target of others) {
    try {
      await outboxAppend({
        targetDeviceId: target.id,
        targetTopic: target.masterTopic ?? null,
        envelopeBase
      })
      results.push({ targetDeviceId: target.id, channel: 'outbox' })
    } catch (error) {
      failures.push({ targetDeviceId: target.id, error })
    }
  }

  if (results.length) {
    import('./actionRunner')
      .then(({ runActionScan }) => runActionScan())
      .catch(() => {})
  }

  if (failures.length) {
    logger.error('broadcastAction: partial failures', { type, failures })
  }

  return { results, failures }
}

export const encodeEnvelope = (envelopeBase) => {
  const json = JSON.stringify(envelopeBase)
  return Buffer.from(json, 'utf8').toString('hex')
}

export const decodeEnvelope = (envelopeHex) => {
  try {
    const json = Buffer.from(envelopeHex, 'hex').toString('utf8')
    return JSON.parse(json)
  } catch (err) {
    logger.error('broadcastAction: failed to decode envelope', { err })
    return null
  }
}
