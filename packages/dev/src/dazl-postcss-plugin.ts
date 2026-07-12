import type { Helpers, Root } from 'postcss';
import type {
    DazlPostcssPlugin,
    DazlPostcssPluginFactory,
    DazlPostcssPluginModule,
    DazlPostcssPluginOptions,
    DazlPostcssPluginValue,
} from './dazl-plugin-types.js';

export type { DazlPostcssPluginOptions } from './dazl-plugin-types.js';

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
 * Returns undefined when no plugin specifier is available.
 */
export async function resolveDazlPostcssPlugin(
    options: DazlPostcssPluginOptions = {},
): Promise<DazlPostcssPlugin | undefined> {
    const pluginSpecifier = options.pluginSpecifier || process.env.DAZL_POSTCSS_PLUGIN_SPECIFIER;
    if (!pluginSpecifier) {
        return undefined;
    }

    const module = (await import(pluginSpecifier)) as DazlPostcssPluginModule;

    const pluginOrFactory = module.dazlPostcssPlugin;

    if (!pluginOrFactory) {
        throw new Error(
            `Module "${pluginSpecifier}" does not expose a CSS transformer for PostCSS. ` +
                'Expected one of: dazlPostcssPlugin, dazlPostCSSPlugin, postcssPlugin, cssTransformer.',
        );
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
 * Returns undefined when no plugin specifier is available.
 * The plugin itself is synchronous so it can be used in configs that do not
 * support async plugin registration; only the transformation path is async.
 */
export function dazlPostcssPlugin(options: DazlPostcssPluginOptions = {}): DazlPostcssPlugin | undefined {
    const pluginSpecifier = options.pluginSpecifier || process.env.DAZL_POSTCSS_PLUGIN_SPECIFIER;
    if (!pluginSpecifier) {
        return undefined;
    }

    let pluginPromise: Promise<DazlPostcssPlugin | undefined> | undefined;

    return {
        postcssPlugin: 'dazl-postcss-plugin-loader',
        async Once(root: Root, helpers: Helpers) {
            pluginPromise ||= resolveDazlPostcssPlugin(options);
            const plugin = await pluginPromise;
            if (!plugin) {
                return;
            }
            await runDazlPostcssPlugin(root, helpers, plugin);
        },
    };
}
