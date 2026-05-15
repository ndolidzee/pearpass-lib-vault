import { generateUniqueId } from '@tetherto/pear-apps-utils-generate-unique-id'

import { ACTIONS } from '../actions'
import { pearpassVaultClient } from '../instances'
import { decodeEnvelope } from './broadcastAction'
import { listDevices } from './listDevices'
import { logger } from '../utils/logger'

const INBOX_PREFIX = 'actions/inbox/'

/**
 * @param {{ envelope: string, peerInfo?: { remotePublicKey: string } }} message
 * @returns {Promise<void>}
 */
export const acceptInboundEnvelope = async ({ envelope, peerInfo } = {}) => {
  if (!envelope) return

  const decoded = await decodeEnvelope(envelope, { verify: true })
  if (!decoded || !decoded.type) {
    logger.error('inbox: dropped malformed or unsigned envelope', { peerInfo })
    return
  }

  const id = generateUniqueId()
  const ts = Date.now()
  const key = `${INBOX_PREFIX}${ts}_${id}`
  const record = { id, receivedAt: ts, envelope: decoded, peerInfo }

  try {
    await pearpassVaultClient.vaultsAdd(key, record)
  } catch (err) {
    logger.error('inbox: failed to persist envelope', { err })
  }
}

/**
 * @returns {Promise<{ processed: number, skipped: number, failed: number }>}
 */
export const processInbox = async () => {
  if (typeof pearpassVaultClient?.vaultsFind !== 'function') {
    return { processed: 0, skipped: 0, failed: 0 }
  }

  let entries
  try {
    entries =
      (await pearpassVaultClient.vaultsFind({
        gte: { key: INBOX_PREFIX },
        lt: { key: nextPrefix(INBOX_PREFIX) }
      })) ?? []
  } catch (err) {
    if (/not initialised/i.test(err?.message ?? '')) {
      return { processed: 0, skipped: 0, failed: 0 }
    }
    throw err
  }

  let processed = 0
  let skipped = 0
  let failed = 0

  for (const entry of entries) {
    const record = entry?.value
    const envelope = record?.envelope
    const handler = envelope ? ACTIONS[envelope.type] : null
    if (!handler) {
      skipped += 1
      continue
    }

    try {
      await handler.execute(envelope)
      await pearpassVaultClient.vaultsRemove(entry.key)
      processed += 1
    } catch (err) {
      logger.error('inbox: handler failed', { err, type: envelope?.type })
      failed += 1
    }
  }

  return { processed, skipped, failed }
}

const nextPrefix = (prefix) => {
  const last = prefix.charCodeAt(prefix.length - 1)
  return prefix.slice(0, -1) + String.fromCharCode(last + 1)
}

export const lookupPeerMasterTopic = async (actor) => {
  if (!actor) return null
  try {
    const peer = await pearpassVaultClient?.vaultsGet?.(`peer/${actor}`)
    if (peer?.masterTopic) return peer.masterTopic
    const myDevices = (await listDevices()) ?? []
    return myDevices.find((d) => d?.id === actor)?.masterTopic ?? null
  } catch (err) {
    logger.error('inbox: lookup peer masterTopic failed', { err })
    return null
  }
}

export const PEER_PREFIX = 'peer/'

export const registerPeer = async (device) => {
  if (!device?.id) return
  try {
    await pearpassVaultClient?.vaultsAdd?.(`${PEER_PREFIX}${device.id}`, {
      id: device.id,
      name: device.name ?? null,
      writerKey: device.writerKey ?? null,
      masterTopic: device.masterTopic ?? null,
      lastSeenAt: Date.now()
    })
  } catch (err) {
    logger.error('inbox: registerPeer failed', { err })
  }
}

export { INBOX_PREFIX }
