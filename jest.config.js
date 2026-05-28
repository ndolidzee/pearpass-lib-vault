export default {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest'
  },
  testPathIgnorePatterns: ['/node_modules/', '/.yalc/'],
  transformIgnorePatterns: [
    'node_modules/(?!(pear-apps-utils-validator|pear-apps-utils-pattern-search)/)'
  ],
  setupFilesAfterEnv: ['./jest.setup.js'],
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons']
  },
  moduleNameMapper: {
    '^@tetherto/pear-apps-utils-generate-unique-id$':
      '/Users/giorgi/Desktop/forks/pear-apps-utils-generate-unique-id/src/index.js',
    '^@tetherto/pear-apps-utils-validator$':
      '/Users/giorgi/Desktop/forks/pear-apps-utils-validator/src/index.js',
    '^@tetherto/pear-apps-utils-pattern-search$':
      '/Users/giorgi/Desktop/forks/pear-apps-utils-pattern-search/src/index.js',
    '^@tetherto/pearpass-lib-constants$':
      '/Users/giorgi/Desktop/forks/pearpass-lib-constants/src/index.js'
  }
}
