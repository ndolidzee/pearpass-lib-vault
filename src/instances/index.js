export let pearpassVaultClient

let currentDeviceNameValue = null

/**
 * @param {object} instance
 * @param {{ currentDeviceName: string }} options
 */
export const setPearpassVaultClient = (
  instance,
  { currentDeviceName } = {}
) => {
  pearpassVaultClient = instance
  currentDeviceNameValue = currentDeviceName ?? null
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
