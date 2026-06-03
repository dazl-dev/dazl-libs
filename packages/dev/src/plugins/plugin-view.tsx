// dazl-dev plugin views. Router-agnostic: resolveView() takes a URL and returns
// a ready-to-render element for the matched view. The host wires it into its own
// router (e.g. a react-router clientLoader) and renders the result directly;
//
// A view module default-exports a PluginViewDefinition (from definePluginView):
// a component plus an optional `load` for initial data. Both receive a PluginApi
// bound to the plugin, so plugin code calls its own api routes explicitly.

import { createElement, type ComponentType, type ReactElement } from 'react';
import { loadPluginView } from './load-plugin-view.ts';
import { INDEX_ROUTE, parseDevRoutePath } from './url.ts';

// Calls the plugin's own api routes (defineApi handlers served under the
// plugin's base URL). Routes are relative, e.g. api.post('notes', body).
export type PluginApi = {
    get<T = unknown>(route: string, init?: RequestInit): Promise<T>;
    post<T = unknown>(route: string, body?: unknown, init?: RequestInit): Promise<T>;
};

export type PluginLoadArgs = {
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

// Router-agnostic entry point: takes the request URL (or path), resolves the
// matched plugin view, runs its `load`, and returns a bound, ready-to-render
// element. The host renders the returned element directly.
export async function resolveView(url: string): Promise<ReactElement> {
    const parsed = parseDevRoutePath(url);
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
    const pluginBaseUrl = `/dazl-dev/${parsed.pluginId}`;
    const api = createPluginApi(pluginBaseUrl);
    const data = def.load ? await def.load({ pluginBaseUrl, api }) : null;
    // Direct createElement (not JSX) so the fiber gets no __source back to this
    // file - "go to code" lands on the user's component, not this wrapper.
    return createElement(def.component, { data, pluginBaseUrl, api });
}
