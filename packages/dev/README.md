# @dazl/dev

Dazl development time utilities.

## JSX Runtime

This package exposes entrypoints (mainly `./jsx-dev-runtime`) so it can be used as `jsxImportSource`.
Its `jsxDEV` keeps the JSX source locations available on `window.__propsToSource`.

## PostCSS Plugin (Non-Vite)

You can load Dazl's CSS transformer as a PostCSS plugin:

```ts
import { dazlPostcssPlugin } from '@dazl/dev/dazl-postcss-plugin';

const plugin = dazlPostcssPlugin();

export default {
  plugins: [plugin].filter(Boolean),
};
```

The plugin registration is synchronous so it works in configs that do not allow
async plugin setup. The actual transformer module is loaded lazily on first CSS
transformation.

The loader reads:

- `DAZL_PLUGIN_SPECIFIER` (required): module specifier for the Dazl plugin module
- `DAZL_PREVIEW_SCRIPT_URL` (optional): forwarded to the transformer when supported

## License

MIT
