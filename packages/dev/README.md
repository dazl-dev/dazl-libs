# @dazl/dev

Dazl development time utilities.

## JSX Runtime

This package exposes entrypoints (mainly `./jsx-dev-runtime`) so it can be used as `jsxImportSource`.
Its `jsxDEV` keeps the JSX source locations available on `window.__propsToSource`.

### Environment variables

Source tracking can be controlled with the following environment variables:

- `DAZL_SOURCE_TRACKING_DISABLED` — set to `true` to disable source tracking for all components.
- `DAZL_SOURCE_TRACKING_DISABLED_COMPONENTS` — a comma-separated list of component `displayName`/`name` values (host tag names such as `div` also match) to disable source tracking for specific components.

## License

MIT
