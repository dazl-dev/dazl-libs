import type { AcceptedPlugin } from 'postcss';

export interface DazlVitePluginOptions {
    viteVersion?: string;
    pluginSpecifier?: string;
    previewScriptUrl?: string;
}

export type DazlVitePluginFactory<TPluginOption = unknown> = (
    options: DazlVitePluginOptions,
) => Promise<TPluginOption[]>;

export type DazlPostcssPlugin = AcceptedPlugin;

export type DazlPostcssPluginFactory = () => DazlPostcssPlugin;
export type DazlPostcssPluginValue = DazlPostcssPlugin | DazlPostcssPluginFactory;

export interface DazlPostcssPluginModule {
    dazlPostcssPlugin?: DazlPostcssPluginValue;
}
