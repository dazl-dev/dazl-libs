# @dazl/color-scheme

A simple color scheme management library for web applications with support for light/dark themes and automatic system preference detection.

## Features

- 🌓 **Light/Dark/System modes** - Support for light, dark, and automatic system preference detection
- 📱 **System preference detection** - Automatically responds to OS-level theme changes
- ⚛️ **React integration** - Ready-to-use React hook for seamless integration
- 💾 **Persistent storage** - Remembers user preferences using localStorage
- 🎨 **CSS class management** - Automatically applies theme classes to document root
- 🏷️ **Automatic style injection** - Injects the `color-scheme` CSS property on the document root for native browser theming
- 📦 **Zero dependencies** - Lightweight with no external dependencies
- 🔧 **TypeScript support** - Full TypeScript definitions included

## Installation

```bash
npm install @dazl/color-scheme
```

## Usage

### Client-side Setup

Import the client module to initialize color scheme management:

> **Note:** This import should only be used in client-side code and must run before the `<body>` is rendered. For best results, include it in an inline script.

```typescript
import '@dazl/color-scheme/client';

// The color scheme API is now available globally
const currentScheme = window.colorSchemeApi.current;
console.log(currentScheme); // { config: 'system', resolved: 'dark' }

// Change the color scheme
window.colorSchemeApi.config = 'light';

// Subscribe to changes
const unsubscribe = window.colorSchemeApi.subscribe(({ config, resolved }) => {
  console.log(`Color scheme changed: ${config} (resolved: ${resolved})`);
});
```

### React Integration

Use the provided React hook for easy integration:

```tsx
import { useColorScheme } from '@dazl/color-scheme/react';

function ThemeToggle() {
  const { configScheme, resolvedScheme, setColorScheme, isLight, isDark } =
    useColorScheme();

  return (
    <div>
      <p>Current config: {configScheme}</p>
      <p>Resolved theme: {resolvedScheme}</p>
      <p>Is light theme: {isLight}</p>
      <p>Is dark theme: {isDark}</p>

      <button onClick={() => setColorScheme('light')}>Light Theme</button>
      <button onClick={() => setColorScheme('dark')}>Dark Theme</button>
      <button onClick={() => setColorScheme('system')}>System Theme</button>
    </div>
  );
}
```

### CSS Styling

The library automatically applies CSS classes to the document root. Style your application accordingly:

```css
/* Dark theme styles */
:root.dark-theme {
  --bg-color: #000000;
  --text-color: #ffffff;
}

/* Light theme styles (explicit) */
:root.light-theme {
  --bg-color: #ffffff;
  --text-color: #000000;
}
```

## API Reference

### ColorSchemeApi

The global `window.colorSchemeApi` object provides the following interface:

#### Properties

- **`config`** (`ColorSchemeConfig`) - Get or set the current color scheme configuration
- **`current`** (`object`) - Get the current state including both config and resolved values

#### Methods

- **`subscribe(callback)`** - Subscribe to color scheme changes
  - `callback`: `(config: ColorSchemeConfig, resolved: ColorSchemeResolve) => void`
  - Returns: `() => void` - Unsubscribe function

### React Hook

#### `useColorScheme()`

Returns an object with the following properties:

- **`configScheme`** (`ColorSchemeConfig`) - Current configuration (light/dark/system)
- **`resolvedScheme`** (`ColorSchemeResolve`) - Resolved theme (light/dark)
- **`setColorScheme`** (`function`) - Function to change the color scheme
- **`isLight`** (`boolean`) - Whether the current resolved theme is light
- **`isDark`** (`boolean`) - Whether the current resolved theme is dark

## License

MIT © Dazl
