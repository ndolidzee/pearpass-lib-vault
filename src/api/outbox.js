import { generateUniqueId } from '@tetherto/pear-apps-utils-generate-unique-id'

import { pearpassVaultClient } from '../instances'
import { encodeEnvelope, decodeEnvelope } from './broadcastAction'

const OUTBOX_PREFIX = 'actions/outbox/'
const MAX_ATTEMPTS = 50
const GRACE_MS = 7 * 24 * 60 * 60 * 1000

/**
 * @param {{ targetDeviceId: string, targetTopic: string, envelopeBase: Object }} entry
 */
export const outboxAppend = async ({
  targetDeviceId,
  targetTopic,
  envelopeBase
}) => {
  if (!targetDeviceId) {
    throw new Error('outboxAppend: targetDeviceId is required')
  }

  const id = generateUniqueId()
  const key = `${OUTBOX_PREFIX}${targetDeviceId}/${id}`
  const record = {
    id,
    targetDeviceId,
    targetTopic: targetTopic ?? null,
    envelope: encodeEnvelope(envelopeBase),
    firstTry: Date.now(),
    attempts: 0,
    nextRetry: Date.now()
  }

  await pearpassVaultClient.vaultsAdd(key, record)
  return record
}

/**
 * @returns {Promise<{ drained: number, retried: number, dropped: number }>}
 */
export const processOutbox = async () => {
  if (typeof pearpassVaultClient?.vaultsFind !== 'function') {
    return { drained: 0, retried: 0, dropped: 0 }
  }

  let entries
  try {
    entries =
      (await pearpassVaultClient.vaultsFind({
        gte: { key: OUTBOX_PREFIX },
        lt: { key: nextPrefix(OUTBOX_PREFIX) }
      })) ?? []
  } catch (err) {
    if (/not initialised/i.test(err?.message ?? '')) {
      return { drained: 0, retried: 0, dropped: 0 }
    }
    throw err
  }

  const now = Date.now()
  let drained = 0
  let retried = 0
  let dropped = 0

  for (const entry of entries) {
    const record = entry?.value
    if (!record) continue

    if (
      record.attempts >= MAX_ATTEMPTS ||
      now - (record.firstTry ?? now) > GRACE_MS
    ) {
      await pearpassVaultClient.vaultsRemove(entry.key)
      dropped += 1
      continue
    }

    if (record.nextRetry && record.nextRetry > now) continue

    if (!record.targetTopic) {
      await bumpEntry(entry.key, record, now)
      retried += 1
      continue
    }

    const result = await pearpassVaultClient
      .personalSwarmSend(record.targetTopic, record.envelope)
      .catch((err) => ({ ok: false, reason: `threw:${err?.message ?? err}` }))

    if (result?.ok) {
      await pearpassVaultClient.vaultsRemove(entry.key)
      drained += 1
    } else {
      await bumpEntry(entry.key, record, now)
      retried += 1
    }
  }

  return { drained, retried, dropped }
}

const FIRST_RETRY_MS = 3_000
const FIRST_RETRY_JITTER_MS = 2_000

const bumpEntry = async (key, record, now) => {
  const attempts = (record.attempts ?? 0) + 1
  const nextRetry =
    attempts === 1
      ? now + FIRST_RETRY_MS + Math.floor(Math.random() * FIRST_RETRY_JITTER_MS)
      : now + backoffMs(attempts - 1)
  const next = { ...record, attempts, nextRetry }
  await pearpassVaultClient.vaultsAdd(key, next)
}

const backoffMs = (attempts) => {
  const base = 60 * 1000
  const max = 60 * 60 * 1000
  return Math.min(base * 2 ** attempts, max)
}

const nextPrefix = (prefix) => {
  const last = prefix.charCodeAt(prefix.length - 1)
  return prefix.slice(0, -1) + String.fromCharCode(last + 1)
}

/**
 * @returns {Promise<Array<{ key: string, record: Object, envelope: Object | null }>>}
 */
export const listOutbox = async () => {
  if (typeof pearpassVaultClient?.vaultsFind !== 'function') return []
  const entries =
    (await pearpassVaultClient.vaultsFind({
      gte: { key: OUTBOX_PREFIX },
      lt: { key: nextPrefix(OUTBOX_PREFIX) }
    })) ?? []
  return entries.map((entry) => ({
    key: entry.key,
    record: entry.value,
    envelope: decodeEnvelope(entry.value?.envelope ?? '')
  }))
}

export { OUTBOX_PREFIX }
