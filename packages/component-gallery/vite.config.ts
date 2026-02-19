import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        // Preserve declaration files emitted by `tsc`.
        emptyOutDir: false,
        // Emit a single, predictable CSS file.
        cssCodeSplit: false,
        // Don't minify component names so they appear nicely in Dazl.
        minify: false,
        lib: {
            entry: {
                index: resolve(__dirname, 'src/index.ts'),
                'route/index': resolve(__dirname, 'src/route/index.ts'),
            },
            formats: ['es'],
        },
        rollupOptions: {
            // Treat bare package imports as external.
            external: (id) => /^[@a-z]/.test(id),
            output: {
                assetFileNames: 'styles.css',
            },
        },
    },
    css: {
        modules: {
            // Don't mangle CSS class names so they appear nicely in Dazl.
            // This requires all names to be manually namespaced or scoped.
            generateScopedName: '[local]',
        },
    },
});
