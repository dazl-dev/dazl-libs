import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        cssCodeSplit: false,
        lib: {
            entry: {
                index: resolve(__dirname, 'src/index.ts'),
                'route/index': resolve(__dirname, 'src/route/index.ts'),
            },
            formats: ['es'],
        },
        rollupOptions: {
            external: (id) => /^[@a-z]/.test(id),
            output: {
                assetFileNames: 'assets/[name][extname]',
                chunkFileNames: '[name].js',
            },
        },
    },
});
