# @dazl/dev

Dazl development time utilities.

## JSX Runtime

This package exposes entrypoints (mainly `./jsx-dev-runtime`) so it can be used as `jsxImportSource`.
Its `jsxDEV` keeps the JSX source locations available on `window.__propsToSource`.

### Environment variables

Source tracking can be controlled with the following environment variables. These flags only affect React Server Components (RSCs):

- `DAZL_RSC_SOURCE_TRACKING_ENABLED` — RSC source tracking is off by default; set to `true` to enable it. When not `true`, the original `jsxDEV` is used for server components and no `data-dazl-source` patching is applied.
- `DAZL_RSC_SOURCE_TRACKING_DISABLED_ALL_COMPONENTS` — set to `true` to disable RSC source tracking for all components (function types), while host elements such as `div` remain tracked.
- `DAZL_RSC_SOURCE_TRACKING_DISABLED_COMPONENTS` — a comma-separated list of component `displayName`/`name` values (host tag names such as `div` also match) to disable RSC source tracking for specific components only.

## Next.js

Wrap the Next.js config with `withDazl()` to enable Dazl's visual editing in `next dev`:

```ts
// next.config.ts
import type { NextConfig } from 'next';
import { withDazl } from '@dazl/dev/next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default withDazl(nextConfig);
```

Outside Dazl, `withDazl()` returns the config unchanged. When Dazl runs `next dev`, it sets
`DAZL_NEXT_PLUGIN_SPECIFIER`, and `withDazl()` lets Dazl's plugin add to the development config only:

- a generated tsconfig that extends the app's own and sets `jsxImportSource: '@dazl/dev'`, so elements map to their JSX source;
- a Turbopack loader for `.css` files, so CSS rules map to their source and their `:hover`/`:focus` states can be forced.

A config exported as a function is supported. Builds and `next start` always get the app's config as is.
Turbopack is required (the default `next dev` bundler since Next.js 16).

## PostCSS Plugin (Non-Vite)

You can load Dazl's CSS transformer as a PostCSS plugin:

```ts
import { dazlPostcssPlugin } from '@dazl/dev/dazl-postcss-plugin';

const plugin = dazlPostcssPlugin();

export default {
  plugins: [plugin],
};
```

Or reference it by module specifier in a `postcss.config.js`:

```js
module.exports = {
  plugins: {
    '@dazl/dev/dazl-postcss-plugin': {},
  },
};
```

The plugin registration is synchronous so it works in configs that do not allow
async plugin setup. The actual transformer module is loaded lazily on first CSS
transformation.

## License

MIT
