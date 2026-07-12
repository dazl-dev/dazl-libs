import type { Helpers, Root } from 'postcss';
import type {
    DazlPostcssPlugin,
    DazlPostcssPluginFactory,
    DazlPostcssPluginModule,
    DazlPostcssPluginValue,
} from './dazl-plugin-types.js';

function isDazlPostcssPluginFactory(value: DazlPostcssPluginValue): value is DazlPostcssPluginFactory {
    return typeof value === 'function';
}

/**
 * A minimal PostCSS plugin that performs no transformation.
 *
 * Used as a stand-in when no plugin specifier is available, so callers always
 * receive a valid plugin and never have to filter out `undefined`.
 */
const noopDazlPostcssPlugin: DazlPostcssPlugin = {
    postcssPlugin: 'dazl-postcss-plugin-noop',
};

/**
 * Resolves the configured plugin specifier and imports the actual CSS transformer.
 *
 * This is the shared resolve-and-import path used by both the ESM loader (below)
 * and the CJS loader. Returning the real transformer directly avoids nesting an
 * extra loader plugin (and an extra postcss `.process()` pass) on the CJS path.
 *
 * Returns a no-op plugin when no plugin specifier is available.
 */
export async function resolveDazlPostcssPlugin(): Promise<DazlPostcssPlugin> {
    const pluginSpecifier = process.env.DAZL_POSTCSS_PLUGIN_SPECIFIER;
    if (!pluginSpecifier) {
        return noopDazlPostcssPlugin;
    }

    const module = (await import(pluginSpecifier)) as DazlPostcssPluginModule;

    const pluginOrFactory = module.dazlPostcssPlugin;

    if (!pluginOrFactory) {
        throw new Error(`Module "${pluginSpecifier}" does not expose a CSS transformer for PostCSS. ` + 'Expected ');
    }

    if (isDazlPostcssPluginFactory(pluginOrFactory)) {
        return pluginOrFactory({});
    }

    return pluginOrFactory;
}

async function runDazlPostcssPlugin(root: Root, helpers: Helpers, plugin: DazlPostcssPlugin): Promise<void> {
    const delegatedResult = await helpers.postcss([plugin]).process(root, helpers.result.opts);
    helpers.result.messages.push(...delegatedResult.messages);
}

/**
 * Loads Dazl's CSS transformer as a PostCSS plugin for non-Vite users.
 *
 * Always returns a plugin; when no plugin specifier is available the transformer
 * resolves to a no-op. The plugin registration itself is synchronous so it can
 * be used in configs that do not support async plugin registration; only the
 * transformation path is async.
 */
export function dazlPostcssPlugin(): DazlPostcssPlugin {
    let pluginPromise: Promise<DazlPostcssPlugin> | undefined;

    return {
        postcssPlugin: 'dazl-postcss-plugin-loader',
        async Once(root: Root, helpers: Helpers) {
            pluginPromise ||= resolveDazlPostcssPlugin();
            const plugin = await pluginPromise;
            await runDazlPostcssPlugin(root, helpers, plugin);
        },
    };
}
