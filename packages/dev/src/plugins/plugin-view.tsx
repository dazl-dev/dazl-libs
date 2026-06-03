// Route-module primitives (clientLoader, HydrateFallback) plus <PluginView />,
// which renders the matched plugin view. The host wires these into its router
// and spreads the loader result into PluginView.
//
// A view module default-exports a PluginViewDefinition (from definePluginView):
// a component plus an optional `load` for initial data. Both receive a PluginApi
// bound to the plugin, so plugin code calls its own api routes explicitly.

import { createElement, useMemo, type ComponentType } from 'react';
import { loadPluginView } from './load-plugin-view.ts';
import { INDEX_ROUTE, parseDevRoutePath } from './url.ts';

// Calls the plugin's own api routes (defineApi handlers served under the
// plugin's base URL). Routes are relative, e.g. api.post('notes', body).
export type PluginApi = {
    get<T = unknown>(route: string, init?: RequestInit): Promise<T>;
    post<T = unknown>(route: string, body?: unknown, init?: RequestInit): Promise<T>;
};

export type PluginLoadArgs = {
    params: Readonly<Record<string, string | undefined>>;
    request: Request;
    // /dazl-dev/<pluginId>, no trailing slash.
    pluginBaseUrl: string;
    api: PluginApi;
};

export type PluginViewComponentProps<TData = unknown> = {
    data: TData;
    pluginBaseUrl: string;
    api: PluginApi;
};

export type PluginViewDefinition<TData = unknown> = {
    load?: (args: PluginLoadArgs) => TData | Promise<TData>;
    component: ComponentType<PluginViewComponentProps<TData>>;
};

// Identity at runtime; the wrapper supplies contextual typing so plugins author
// with `export default definePluginView({ component, ... })`.
export function definePluginView<TData = unknown>(def: PluginViewDefinition<TData>): PluginViewDefinition<TData> {
    return def;
}

function createPluginApi(pluginBaseUrl: string): PluginApi {
    const call = async <T,>(route: string, init?: RequestInit): Promise<T> => {
        const res = await fetch(`${pluginBaseUrl}/${route}`, init);
        if (!res.ok) throw new Error(`dazl-dev api '${pluginBaseUrl}/${route}' failed: ${res.status}`);
        return (await res.json()) as T;
    };
    return {
        get: (route, init) => call(route, init),
        post: (route, body, init) =>
            call(route, {
                method: 'POST',
                ...init,
                headers: { 'Content-Type': 'application/json', ...init?.headers },
                body: body === undefined ? init?.body : JSON.stringify(body),
            }),
    };
}

async function loadEntry(
    params: PluginLoadArgs['params'],
): Promise<{ pluginId: string; def: PluginViewDefinition<unknown> }> {
    const parsed = parseDevRoutePath(params['*'] ?? '');
    if (!parsed) throw new Error('No plugin id in URL');
    const mod = await loadPluginView(parsed.pluginId, parsed.pluginRoute);
    if (!mod || !mod.default) {
        throw new Error(`No dazl-dev view registered at '${parsed.pluginId}/${parsed.pluginRoute}'`);
    }
    const def = mod.default as PluginViewDefinition<unknown>;
    // Label the view for dev tools (e.g. "hello" or "form/edit") instead of the
    // module's bare function name.
    if (!def.component.displayName) {
        def.component.displayName =
            parsed.pluginRoute === INDEX_ROUTE ? parsed.pluginId : `${parsed.pluginId}/${parsed.pluginRoute}`;
    }
    return { pluginId: parsed.pluginId, def };
}

// Browser-only, so views work whether or not the host renders on the server.
export async function clientLoader({ params, request }: { params: PluginLoadArgs['params']; request: Request }) {
    const { pluginId, def } = await loadEntry(params);
    const pluginBaseUrl = `/dazl-dev/${pluginId}`;
    const api = createPluginApi(pluginBaseUrl);
    const data = def.load ? await def.load({ params, request, pluginBaseUrl, api }) : null;
    return { Component: def.component, data, pluginBaseUrl };
}

// Shown while the matched view module loads.
export function HydrateFallback() {
    return <div></div>;
}
HydrateFallback.displayName = '__dazl_HydrateFallback';

// What clientLoader returns; the host spreads it into <PluginView />.
export type PluginViewProps = {
    Component: ComponentType<PluginViewComponentProps<unknown>>;
    data: unknown;
    pluginBaseUrl: string;
};

export function PluginView({ Component, data, pluginBaseUrl }: PluginViewProps) {
    // Stable identity per pluginBaseUrl so plugins can safely use `api` in
    // useEffect/useCallback deps without it churning across re-renders.
    const api = useMemo(() => createPluginApi(pluginBaseUrl), [pluginBaseUrl]);
    // Direct createElement (not JSX) so the fiber gets no __source back to this
    // file - "go to code" lands on the user's component, not this wrapper.
    return createElement(Component, { data, pluginBaseUrl, api });
}
PluginView.displayName = 'PluginView';
