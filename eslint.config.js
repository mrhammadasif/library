// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
  expoConfig,
  {
    // The API (server/) has its own toolchain.
    ignores: ['dist/*', 'server/**'],
  },
  {
    rules: {
      // Friendly copy is full of apostrophes ("can't", "it's"); they're harmless in React Native <Text>.
      'react/no-unescaped-entities': ['error', { forbid: ['>', '}'] }],
    },
  },
])
