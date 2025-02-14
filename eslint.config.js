import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: true,
  unocss: true,
  vue: true,
  rules: {
    'no-undef': 'off',
    'no-unused-vars': 'off',
    'unused-imports/no-unused-vars': 'warn',
  },
})
