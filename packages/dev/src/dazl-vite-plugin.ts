import { version as viteVersion } from 'vite';
import type { PluginOption } from 'vite';

interface DazlVitePluginOptions {
    previewScriptUrl?: string;
    viteVersion?: string;
}

type DazlPlugins = (options: DazlVitePluginOptions) => Promise<PluginOption[]>;

/** Loads the dazl vite plugin from the env vars dazl sets when starting the dev server (no-op otherwise). */
export async function dazlVitePlugin(): Promise<PluginOption> {
    const pluginUrl = process.env.DAZL_PLUGIN_URL;
    const previewScriptUrl = process.env.DAZL_PREVIEW_SCRIPT_URL;
    if (!pluginUrl || !previewScriptUrl) {
        return false;
    }

    const { default: dazlPlugins } = (await import(pluginUrl)) as { default: DazlPlugins };

    return dazlPlugins({ viteVersion, previewScriptUrl });
}
