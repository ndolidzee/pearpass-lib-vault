export let pearpassVaultClient

let currentDeviceNameValue = null
let envelopeSubscription = null
let newListenerSubscription = null

/**
 * @param {object} instance
 * @param {{ currentDeviceName: string }} options
 */
export const setPearpassVaultClient = (
  instance,
  { currentDeviceName } = {}
) => {
  detachEnvelopeListener()
  detachNewListenerHook()

  pearpassVaultClient = instance
  currentDeviceNameValue = currentDeviceName ?? null

  attachEnvelopeListener()
  attachNewListenerHook()
}

/**
 * @returns {string | null}
 */
export const getCurrentDeviceName = () => currentDeviceNameValue

/**
 * @param {string} path
 */
export const setStoragePath = async (path) => {
  await pearpassVaultClient.setStoragePath(path)
}

// Dynamic imports avoid a load-time cycle (inbox + actionRunner read
// pearpassVaultClient from this module).
const attachEnvelopeListener = () => {
  if (!pearpassVaultClient?.on) return
  if (envelopeSubscription) return

  envelopeSubscription = async (message) => {
    try {
      const { acceptInboundEnvelope } = await import('../api/inbox.js')
      await acceptInboundEnvelope(message)
      const { runActionScan } = await import('../api/actionRunner.js')
      runActionScan().catch(() => {})
    } catch {}
  }
  pearpassVaultClient.on('personal-swarm-envelope', envelopeSubscription)
}

const detachEnvelopeListener = () => {
  if (!pearpassVaultClient?.off || !envelopeSubscription) return
  pearpassVaultClient.off('personal-swarm-envelope', envelopeSubscription)
  envelopeSubscription = null
}

// Re-run processInbox when a consumer subscribes to an event our handlers
// emit, so envelopes that arrived before the listener mounted can still be
// delivered.
const attachNewListenerHook = () => {
  if (!pearpassVaultClient?.on) return
  if (newListenerSubscription) return

  newListenerSubscription = async (event) => {
    if (event !== 'vault-access-revoked') return
    try {
      const { runActionScan } = await import('../api/actionRunner.js')
      runActionScan().catch(() => {})
    } catch {}
  }
  pearpassVaultClient.on('newListener', newListenerSubscription)
}

const detachNewListenerHook = () => {
  if (!pearpassVaultClient?.off || !newListenerSubscription) return
  pearpassVaultClient.off('newListener', newListenerSubscription)
  newListenerSubscription = null
}
