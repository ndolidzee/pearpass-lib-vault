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

  const decoded = decodeEnvelope(envelope)
  if (!decoded || !decoded.type) {
    logger.error('inbox: dropped malformed envelope', { peerInfo })
    return
  }

  if (!(await isActorTrusted(decoded.actor))) {
    logger.error('inbox: dropped envelope from untrusted actor', {
      actor: decoded.actor,
      type: decoded.type
    })
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

const isActorTrusted = async (actor) => {
  if (!actor) return false
  try {
    const peer = await pearpassVaultClient?.vaultsGet?.(`peer/${actor}`)
    if (peer) return true
    const myDevices = (await listDevices()) ?? []
    return myDevices.some((d) => d?.id === actor)
  } catch (err) {
    logger.error('inbox: failed to list devices for trust check', { err })
    return false
  }
}

export const PEER_PREFIX = 'peer/'

export const registerPeer = async (device) => {
  if (!device?.id) return
  try {
    await pearpassVaultClient?.vaultsAdd?.(`${PEER_PREFIX}${device.id}`, {
      id: device.id,
      name: device.name ?? null,
      lastSeenAt: Date.now()
    })
  } catch (err) {
    logger.error('inbox: registerPeer failed', { err })
  }
}

export { INBOX_PREFIX }
