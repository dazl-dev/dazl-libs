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

async function loadDazlPostcssPlugin(options: Required<DazlPostcssPluginOptions>): Promise<DazlPostcssPlugin> {
    const module = (await import(options.pluginSpecifier)) as DazlPostcssPluginModule;

    const pluginOrFactory =
        module.dazlPostcssPlugin || module.dazlPostCSSPlugin || module.postcssPlugin || module.cssTransformer;

    if (!pluginOrFactory) {
        throw new Error(
            `Module "${options.pluginSpecifier}" does not expose a CSS transformer for PostCSS. ` +
                'Expected one of: dazlPostcssPlugin, dazlPostCSSPlugin, postcssPlugin, cssTransformer.',
        );
    }

    if (isDazlPostcssPluginFactory(pluginOrFactory)) {
        return pluginOrFactory({ previewScriptUrl: options.previewScriptUrl });
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

    const previewScriptUrl = options.previewScriptUrl || process.env.DAZL_PREVIEW_SCRIPT_URL;
    const resolvedOptions: Required<DazlPostcssPluginOptions> = {
        pluginSpecifier,
        previewScriptUrl: previewScriptUrl || '',
    };
    let pluginPromise: Promise<DazlPostcssPlugin> | undefined;

    return {
        postcssPlugin: 'dazl-postcss-plugin-loader',
        async Once(root: Root, helpers: Helpers) {
            pluginPromise ||= loadDazlPostcssPlugin(resolvedOptions);
            await runDazlPostcssPlugin(root, helpers, await pluginPromise);
        },
    };
}
