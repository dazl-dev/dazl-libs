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
 * Resolves the configured plugin specifier and imports the actual CSS transformer.
 *
 * This is the shared resolve-and-import path used by both the ESM loader (below)
 * and the CJS loader. Returning the real transformer directly avoids nesting an
 * extra loader plugin (and an extra postcss `.process()` pass) on the CJS path.
 *
 * Returns undefined when no plugin specifier is configured or the specified
 * module does not expose a transformer.
 */
export async function resolveDazlPostcssPlugin(): Promise<DazlPostcssPlugin | undefined> {
    const pluginSpecifier = process.env.DAZL_POSTCSS_PLUGIN_SPECIFIER;
    if (!pluginSpecifier) {
        return undefined;
    }

    const module = (await import(pluginSpecifier)) as DazlPostcssPluginModule;

    const pluginOrFactory = module.dazlPostcssPlugin;

    if (!pluginOrFactory) {
        console.warn(
            `Module "${pluginSpecifier}" does not expose a CSS transformer for PostCSS. ` +
                'Expected a named export "dazlPostcssPlugin" that is either a PostCSS plugin or a factory function that returns one.',
        );
        return undefined;
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
 * The plugin registration itself is synchronous so it can be used in configs
 * that do not support async plugin registration; only the transformation path
 * is async. When no transformer is available the CSS is left unchanged.
 */
export function dazlPostcssPlugin(): DazlPostcssPlugin {
    let pluginPromise: Promise<DazlPostcssPlugin | undefined> | undefined;

    return {
        postcssPlugin: 'dazl-postcss-plugin-loader',
        async Once(root: Root, helpers: Helpers) {
            pluginPromise ||= resolveDazlPostcssPlugin();
            const plugin = await pluginPromise;
            if (!plugin) {
                return;
            }
            await runDazlPostcssPlugin(root, helpers, plugin);
        },
    };
}

dazlPostcssPlugin.postcss = true as const;
export default dazlPostcssPlugin;
