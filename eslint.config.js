import pluginJs from '@eslint/js';
import configPrettier from 'eslint-config-prettier';
import pluginNoOnlyTests from 'eslint-plugin-no-only-tests';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginTypescript from 'typescript-eslint';

for (const config of pluginTypescript.configs.recommendedTypeChecked) {
    config.files = ['**/*.{ts,tsx,mts,cts}']; // ensure config only targets TypeScript files
}

/** @type {import('eslint').Linter.Config[]} */
export default [
    { ignores: ['**/dist/', '**/dist-engine/', 'packages/engineer/gui-feature.d.ts'] },
    pluginJs.configs.recommended,
    pluginReact.configs.flat.recommended,
    { settings: { react: { version: 'detect' } } },
    { plugins: { 'react-hooks': pluginReactHooks, 'no-only-tests': pluginNoOnlyTests } },
    {
        rules: {
            'no-only-tests/no-only-tests': 'error',
            'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'react/prop-types': 'off',
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'error',
        },
    },
    ...pluginTypescript.configs.recommendedTypeChecked,
    { languageOptions: { parserOptions: { projectService: true } } },
    {
        files: ['**/*.{ts,tsx,mts,cts}'],
        rules: {
            '@typescript-eslint/unbound-method': 'off',
        },
    },
    configPrettier,
];
