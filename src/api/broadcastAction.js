import { ACTION_TYPES } from '../actions'
import { pearpassVaultClient } from '../instances'
import { listDevices } from './listDevices'
import { outboxAppend } from './outbox'
import { getMyDeviceId } from '../utils/getMyDeviceId'
import { logger } from '../utils/logger'

/**
 * @param {{ type: string, payload?: any }} action
 * @returns {Promise<{
 *   results: Array<{ targetDeviceId: string, channel: 'direct' | 'outbox' }>,
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
  let queuedAny = false

  for (const target of others) {
    try {
      const channel = await deliverToTarget(target, envelopeBase)
      if (channel === 'outbox') queuedAny = true
      results.push({ targetDeviceId: target.id, channel })
    } catch (error) {
      failures.push({ targetDeviceId: target.id, error })
    }
  }

  if (queuedAny) {
    import('./actionRunner')
      .then(({ runActionScan }) => runActionScan())
      .catch(() => {})
  }

  if (failures.length) {
    logger.error('broadcastAction: partial failures', { type, failures })
  }

  return { results, failures }
}

const deliverToTarget = async (target, envelopeBase) => {
  if (target.masterTopic && supportsPersonalSwarm()) {
    const send = await tryDirectSend(target.masterTopic, envelopeBase)
    if (send.ok) return 'direct'
  }

  await outboxAppend({
    targetDeviceId: target.id,
    targetTopic: target.masterTopic ?? null,
    envelopeBase
  })
  return 'outbox'
}

const supportsPersonalSwarm = () =>
  typeof pearpassVaultClient?.personalSwarmSend === 'function'

const tryDirectSend = async (targetTopic, envelopeBase) => {
  try {
    const envelope = encodeEnvelope(envelopeBase)
    const result = await pearpassVaultClient.personalSwarmSend(
      targetTopic,
      envelope
    )
    return result ?? { ok: false, reason: 'no-result' }
  } catch (err) {
    logger.error('broadcastAction: direct send threw', { err })
    return { ok: false, reason: 'threw' }
  }
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
