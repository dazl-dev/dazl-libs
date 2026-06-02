// Loads a plugin's view module in the browser: finds it in the dev-server
// registry (which lists only views - api routes are reachable by URL and need
// no discovery), then dynamic-imports it.

type RegistryEntry = { pluginId: string; pluginRoute: string; moduleUrl: string };

const REGISTRY_URL = '/dazl-dev/__registry';

async function listPluginViews(): Promise<RegistryEntry[]> {
    const res = await fetch(REGISTRY_URL);
    if (!res.ok) throw new Error(`dazl-dev registry fetch failed: ${res.status}`);
    return (await res.json()) as RegistryEntry[];
}

export async function loadPluginView(
    pluginId: string,
    pluginRoute: string,
): Promise<{ default: unknown } | null> {
    const entries = await listPluginViews();
    const entry = entries.find((e) => e.pluginId === pluginId && e.pluginRoute === pluginRoute);
    if (!entry) return null;
    // Bundler-ignore comments so static analysis doesn't try to resolve the
    // runtime URL (vite reads @vite-ignore, webpack reads webpackIgnore).
    return (await import(
        /* @vite-ignore */
        /* webpackIgnore: true */
        entry.moduleUrl
    )) as { default: unknown };
}
