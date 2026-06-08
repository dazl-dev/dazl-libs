// dazl-dev plugin views. A view module default-exports a PluginViewDefinition
// (from definePluginView): a component plus an optional `load` for initial data.
// Both receive a PluginApi bound to the plugin (built by the dev server), so
// plugin code calls its own api routes explicitly.

import type { ComponentType } from 'react';

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
