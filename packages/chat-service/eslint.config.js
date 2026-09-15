import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ['src/**/*.ts', 'server.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    rules: {
      'no-unused-vars': 'off',
      'no-console': 'off'
    }
  },
  {
    ignores: ['dist/**', 'node_modules/**']
  }
];
