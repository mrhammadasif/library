import antfu from '@antfu/eslint-config'

const __dirname = new URL('.', import.meta.url).pathname
export default antfu({
  vue: true,
  typescript: true,
  jsonc: true,
  yaml: true,
  markdown: true,
  regexp: false,
  ignores: [
    'e2e',
    'dist',
    'node_modules',
    'public',
  ],
  rules: {
    'vue/require-v-for-key': 'warn',
    'ts/ban-types': 'off',
    'vue/no-parsing-error': 'off',
    'vue/html-self-closing': 'off',
    'no-unused-vars': 'off',
    'perfectionist/sort-imports': 'warn',
    'unused-imports/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
    'vue/dot-location': ['error', 'property'],
    'vue/no-unused-vars': 'warn',
    // 'vue/space-unary-ops': 'off',
    // 'vue/space-infix-ops': 'off',
    'no-console': ['off'],
    'curly': ['error', 'all'],
    'brace-style': [
      'error',
      'stroustrup',
      { allowSingleLine: false },
    ],
    'sort-vars': [
      'error',
      { ignoreCase: true },
    ],
    'vue/no-multiple-template-root': ['error'],
    'vue/component-definition-name-casing': ['error', 'PascalCase'],
    'vue/component-api-style': [
      'error',
      ['script-setup', 'options'],
    ],
    'vue/padding-line-between-blocks': ['error'],
    'vue/next-tick-style': ['error', 'promise'],
    'vue/no-useless-v-bind': ['error'],
    'vue/component-name-in-template-casing': [
      'error',
      'PascalCase',
      { registeredComponentsOnly: true },
    ],
    'vue/block-order': [
      'error',
      {
        order: [
          'route',
          'script',
          'template',
          'style',
        ],
      },
    ],
    // 'padded-blocks': ['error', { blocks: 'always' }],
    // .eslint.js
    'padding-line-between-statements': [
      'error',
      {
        blankLine: 'always',
        prev: [
          'multiline-const',
          'multiline-let',
          'block-like',
          'function',
          'multiline-var',
          'multiline-block-like',
          'multiline-expression',
          'import',
        ],
        next: '*',
      },
      {
        blankLine: 'never',
        prev: [
          'singleline-const',
          'singleline-let',
          'singleline-var',
        ],
        next: [
          'singleline-const',
          'singleline-let',
          'singleline-var',
        ],
      },
      {
        blankLine: 'always',
        prev: [
          'singleline-const',
          'singleline-let',
          'singleline-var',
        ],
        next: [
          'multiline-const',
          'multiline-let',
          'block-like',
          'function',
          'multiline-var',
          'multiline-block-like',
          'multiline-expression',
          'import',
        ],
      },
      {
        blankLine: 'never',
        prev: ['import'],
        next: ['import'],
      },
    ],
    'camelcase': 'warn',
    'function-paren-newline': ['error', 'multiline'],
    'array-element-newline': ['error', 'consistent'],
    'array-bracket-newline': [
      'error',
      {
        multiline: true,
        minItems: 3,
      },
    ],
    'vue/max-attributes-per-line': [
      'error',
      {
        singleline: { max: 1 },
        multiline: { max: 1 },
      },
    ],
    'object-curly-spacing': ['error', 'always'],
    'object-property-newline': [
      'error',
      { allowAllPropertiesOnSameLine: true },
    ],
    'vue/multiline-html-element-content-newline': [
      'error',
      {
        ignoreWhenEmpty: true,
        allowEmptyLines: false,
      },
    ],
    'vue/html-closing-bracket-newline': [
      'error',
      {
        singleline: 'never',
        multiline: 'never',
      },
    ],
    'prefer-template': 'error',
    'vue/object-property-newline': ['error'],
    'vue/object-curly-newline': 'off',
    'object-curly-newline': [
      'error',
      {
        ImportDeclaration: {
          multiline: true,
          minProperties: 2,
        },
        ObjectExpression: {
          multiline: true,
          minProperties: 2,
        },
      },
    ],
  },
})
