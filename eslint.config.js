// @ts-check

import pluginJs from '@eslint/js';
import configPrettier from 'eslint-config-prettier';
import pluginNoOnlyTests from 'eslint-plugin-no-only-tests';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import pluginTypescript from 'typescript-eslint';

export default defineConfig([
    globalIgnores(['**/dist/', 'packages/color-scheme/playwright.config.ts']),
    pluginJs.configs.recommended,
    pluginReactHooks.configs.flat.recommended,
    { plugins: { 'no-only-tests': pluginNoOnlyTests } },
    {
        rules: {
            'no-only-tests/no-only-tests': 'error',
            'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'react-hooks/exhaustive-deps': 'error',
        },
    },
    ...pluginTypescript.configs.recommendedTypeChecked.map((config) => ({
        ...config,
        files: ['**/*.{ts,tsx,mts,cts}'],
    })),
    {
        languageOptions: {
            parserOptions: {
                projectService: {
                    allowDefaultProject: ['packages/*/vite.config.ts'],
                },
            },
        },
    },
    {
        files: ['**/*.{ts,tsx,mts,cts}'],
        rules: {
            '@typescript-eslint/unbound-method': 'off',
        },
    },
    configPrettier,
]);
