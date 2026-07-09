import type { AcceptedPlugin } from 'postcss';

export interface DazlPluginLoaderOptions {
    pluginSpecifier?: string;
    previewScriptUrl?: string;
}

export interface DazlVitePluginOptions extends DazlPluginLoaderOptions {
    viteVersion?: string;
}

export type DazlVitePluginFactory<TPluginOption = unknown> = (
    options: DazlVitePluginOptions,
) => Promise<TPluginOption[]>;

export type DazlPostcssPlugin = AcceptedPlugin;

export type DazlPostcssPluginFactory = (options: { previewScriptUrl?: string }) => DazlPostcssPlugin;
export type DazlPostcssPluginValue = DazlPostcssPlugin | DazlPostcssPluginFactory;

export interface DazlPostcssPluginModule {
    dazlPostcssPlugin?: DazlPostcssPluginValue;
    dazlPostCSSPlugin?: DazlPostcssPluginValue;
    postcssPlugin?: DazlPostcssPluginValue;
    cssTransformer?: DazlPostcssPluginValue;
}

export type DazlPostcssPluginOptions = DazlPluginLoaderOptions;
