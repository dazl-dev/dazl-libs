import { version as viteVersion } from 'vite';
import type { PluginOption } from 'vite';
import type { DazlVitePluginFactory } from './dazl-plugin-types.js';

type DazlPlugins = DazlVitePluginFactory<PluginOption>;

/** Loads the dazl vite plugin from the env vars dazl sets when starting the dev server (no-op otherwise). */
export async function dazlVitePlugin(): Promise<PluginOption> {
    const pluginSpecifier = process.env.DAZL_PLUGIN_SPECIFIER;
    const previewScriptUrl = process.env.DAZL_PREVIEW_SCRIPT_URL;
    if (!pluginSpecifier || !previewScriptUrl) {
        return false;
    }

    const { default: dazlPlugins } = (await import(pluginSpecifier)) as { default: DazlPlugins };

    return dazlPlugins({ viteVersion, previewScriptUrl });
}
