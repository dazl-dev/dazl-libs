import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { libInjectCss } from 'vite-plugin-lib-inject-css';

export default defineConfig({
    plugins: [
        libInjectCss(),
        dts({
            tsconfigPath: './tsconfig.json',
            include: ['src/**/*.ts', 'src/**/*.tsx'],
            exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
            entryRoot: 'src',
        }),
    ],
    build: {
        lib: {
            entry: {
                index: resolve(__dirname, 'src/index.ts'),
                'route/index': resolve(__dirname, 'src/route/index.ts'),
            },
            formats: ['es'],
        },
        rollupOptions: {
            external: ['react', 'react-dom', 'react/jsx-runtime', 'react-router', 'zod'],
            output: {
                assetFileNames: 'assets/[name][extname]',
                chunkFileNames: '[name].js',
            },
        },
    },
});
