// URL helpers shared by the browser and the dev server; no environment-specific imports, so both sides can use them.

export const INDEX_ROUTE = 'index';

const DEV_ROUTE_PREFIX = '/dazl-dev/';

// Parse a dazl-dev URL or path into (pluginId, pluginRoute). `URL` extracts the
// pathname (dropping any origin, query, and hash); a leading `/dazl-dev/` is
// stripped if present, then the tail is split: empty -> null; a single segment
// resolves pluginRoute to INDEX_ROUTE. So a full URL, a '/dazl-dev/form'
// pathname, and an already-stripped 'form' all yield the same result.
export function parseDevRoutePath(url: string): { pluginId: string; pluginRoute: string } | null {
    let pathname: string;
    try {
        // The base just lets URL resolve a relative path/tail; only pathname is read.
        pathname = new URL(url, 'http://ignored-base.invalid').pathname;
    } catch {
        return null;
    }
    const tail = (pathname.startsWith(DEV_ROUTE_PREFIX) ? pathname.slice(DEV_ROUTE_PREFIX.length) : pathname).replace(
        /^\/+|\/+$/g,
        '',
    );
    if (!tail) return null;
    const segments = tail.split('/');
    const pluginId = segments[0]!;
    const pluginRoute = segments.length === 1 ? INDEX_ROUTE : segments.slice(1).join('/');
    return { pluginId, pluginRoute };
}
