export let pearpassVaultClient

let _currentDeviceName = null

/**
 * @param {{
 *   activeVaultGetWriterKey: () => Promise<string | null>,
 *   activeVaultFind: (range: { gte: { key: string }, lt: { key: string } }) => Promise<Array<{ key: string, value: unknown }> | null>,
 *   activeVaultRemove: (key: string) => Promise<void>
 * }} instance
 */
export const setPearpassVaultClient = (instance) => {
  pearpassVaultClient = instance
}

/**
 * @param {string} name
 */
export const setCurrentDeviceName = (name) => {
  _currentDeviceName = name
}

/**
 * @returns {string | null}
 */
export const getCurrentDeviceName = () => _currentDeviceName

export const clearCurrentDeviceName = () => {
  _currentDeviceName = null
}

/**
 * @param {string} path
 */
export const setStoragePath = async (path) => {
  await pearpassVaultClient.setStoragePath(path)
}
