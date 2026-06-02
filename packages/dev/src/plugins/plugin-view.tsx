// Route-module primitives (clientLoader, clientAction, HydrateFallback) plus
// <PluginView />, which renders the matched plugin view. The host wires these
// into its router and spreads the loader result into PluginView.
//
// A view module default-exports a PluginViewDefinition (from definePluginView).
// Views receive pluginBaseUrl instead of hardcoding /dazl-dev/<pluginId>/.

import { createElement, type ComponentType } from 'react';
import { loadPluginView } from './load-plugin-view.ts';
import { INDEX_ROUTE, parseDevRoutePath } from './url.ts';

export type PluginViewLoaderArgs = {
    params: Readonly<Record<string, string | undefined>>;
    request: Request;
    // /dazl-dev/<pluginId>, no trailing slash.
    pluginBaseUrl: string;
};

export type PluginViewComponentProps<TData = unknown> = {
    data: TData;
    pluginBaseUrl: string;
};

export type PluginViewDefinition<TData = unknown> = {
    component: ComponentType<PluginViewComponentProps<TData>>;
    clientLoader?: (args: PluginViewLoaderArgs) => TData | Promise<TData>;
    clientAction?: (args: PluginViewLoaderArgs) => unknown;
};

// Identity at runtime; the wrapper supplies contextual typing so plugins author
// with `export default definePluginView({ component, ... })`.
export function definePluginView<TData = unknown>(def: PluginViewDefinition<TData>): PluginViewDefinition<TData> {
    return def;
}

async function loadEntry(
    params: PluginViewLoaderArgs['params'],
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

type RouteArgs = { params: PluginViewLoaderArgs['params']; request: Request };

// Browser-only, so views work whether or not the host renders on the server.
export async function clientLoader({ params, request }: RouteArgs) {
    const { pluginId, def } = await loadEntry(params);
    const pluginBaseUrl = `/dazl-dev/${pluginId}`;
    const data = def.clientLoader ? await def.clientLoader({ params, request, pluginBaseUrl }) : null;
    return { Component: def.component, data, pluginBaseUrl };
}

export async function clientAction({ params, request }: RouteArgs) {
    const { pluginId, def } = await loadEntry(params);
    if (!def.clientAction) throw new Error('No clientAction defined for this view');
    const pluginBaseUrl = `/dazl-dev/${pluginId}`;
    return def.clientAction({ params, request, pluginBaseUrl });
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
    // Direct createElement (not JSX) so the fiber gets no __source back to this
    // file - "go to code" lands on the user's component, not this wrapper.
    return createElement(Component, { data, pluginBaseUrl });
}
PluginView.displayName = 'PluginView';
