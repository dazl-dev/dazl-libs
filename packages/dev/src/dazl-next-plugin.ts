import type { DazlNextPluginModule } from './dazl-plugin-types.js';

/** The phase `next dev` loads its config in; Dazl instruments only this one. */
const NEXT_DEVELOPMENT_PHASE = 'phase-development-server';

/** A Next.js config function: `(phase, { defaultConfig }) => config`. */
export type NextConfigFunction<TConfig> = (
    phase: string,
    context: { defaultConfig: TConfig },
) => TConfig | Promise<TConfig>;

/**
 * Wraps a Next.js config so Dazl can instrument `next dev` for visual editing: elements mapped to
 * their JSX source, and CSS rules mapped to their file and with forcible `:hover`/`:focus` states.
 *
 * Outside Dazl it returns the config unchanged. In Dazl, which sets `DAZL_NEXT_PLUGIN_SPECIFIER`,
 * it returns a config function that resolves the app's config (an object or a function) and, for
 * `next dev` only, hands it to Dazl's plugin. Builds and `next start` get the app's config as is.
 *
 * ```ts
 * // next.config.ts
 * import { withDazl } from '@dazl/dev/next';
 *
 * export default withDazl({ reactStrictMode: true });
 * ```
 */
export function withDazl<TConfig extends object>(
    config: TConfig | NextConfigFunction<TConfig>,
): TConfig | NextConfigFunction<TConfig> {
    const pluginSpecifier = process.env.DAZL_NEXT_PLUGIN_SPECIFIER;
    if (!pluginSpecifier) {
        return config;
    }

    return async (phase, context) => {
        const resolved = typeof config === 'function' ? await config(phase, context) : config;
        if (phase !== NEXT_DEVELOPMENT_PHASE) {
            return resolved;
        }
        try {
            const { dazlNextConfig } = (await import(pluginSpecifier)) as DazlNextPluginModule<TConfig>;
            return await dazlNextConfig(resolved, { phase });
        } catch (error) {
            // the app must keep running without Dazl's instrumentation rather than fail to start
            console.warn(`[dazl] Could not load Dazl's Next.js plugin from "${pluginSpecifier}":`, error);
            return resolved;
        }
    };
}

export default withDazl;
