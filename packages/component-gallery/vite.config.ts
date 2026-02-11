import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { libInjectCss } from 'vite-plugin-lib-inject-css';

export default defineConfig({
    plugins: [libInjectCss()],
    build: {
        lib: {
            entry: {
                index: resolve(__dirname, 'src/index.ts'),
                'route/index': resolve(__dirname, 'src/route/index.ts'),
            },
            formats: ['es'],
        },
        rollupOptions: {
            external: ['react', 'react-dom', 'react/jsx-runtime', 'zod'],
            output: {
                assetFileNames: 'assets/[name][extname]',
                chunkFileNames: '[name].js',
            },
        },
    },
});
