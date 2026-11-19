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

export interface DazlNextConfigOptions {
    /** The Next.js phase the config is loaded for. */
    phase: string;
}

/** The module `DAZL_NEXT_PLUGIN_SPECIFIER` names: Dazl's side of `withDazl()`. */
export interface DazlNextPluginModule<TConfig> {
    dazlNextConfig: (config: TConfig, options: DazlNextConfigOptions) => TConfig | Promise<TConfig>;
}

export interface DazlPostcssPluginModule {
    dazlPostcssPlugin?: DazlPostcssPluginValue;
}
