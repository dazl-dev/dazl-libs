// URL helpers shared by the browser and the dev server; no environment-specific imports, so both sides can use them.

export const INDEX_ROUTE = 'index';

// Parse the tail after `/dazl-dev/` into (pluginId, pluginRoute). Empty tail
// returns null; a single segment resolves pluginRoute to INDEX_ROUTE.
export function parseDevRoutePath(tail: string): { pluginId: string; pluginRoute: string } | null {
    const trimmed = tail.replace(/^\/+|\/+$/g, '');
    if (!trimmed) return null;
    const segments = trimmed.split('/');
    const pluginId = segments[0]!;
    const pluginRoute = segments.length === 1 ? INDEX_ROUTE : segments.slice(1).join('/');
    return { pluginId, pluginRoute };
}
