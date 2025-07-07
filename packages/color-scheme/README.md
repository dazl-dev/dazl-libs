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

#### Color-scheme API

- **`config`** (`light|dark|system`) - Get or set the current color scheme configuration
- **`currentState`** (`{ config: light|dark|system, resolved: light|dark }`) - Get the current state including both config and resolved values
- **`resolvedSystem`** (`light|dark`) - Get the resolved theme based on system preferences
- **`subscribe`** (`(handler: (currentState) => void) => () => void`) - Subscribe to color scheme changes and return an unsubscribe function
- **`getRootCssClass`** (`(resolved?: light|dark) => string`) - CSS class applied to the document root based on the resolved theme or passed value

#### Override root CSS class

Override the default CSS classes applied to the document root by specifying `data-dark-class` and `data-light-class` attributes in the client script tag:

```html
<script src="@dazl/color-scheme/client" data-dark-class="dark-theme" data-light-class="light-theme"></script>
```

### React Integration

Use the provided React hook for easy integration:

```tsx
import { useColorScheme } from '@dazl/color-scheme/react';

function ThemeToggle() {
  const { configScheme, resolvedScheme, setColorScheme, isLight, isDark } = useColorScheme();

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

#### Hook API

- **`resolvedScheme`** (`light|dark`) - Resolved theme (light/dark)
- **`configScheme`** (`light|dark|system`) - Current configuration (light/dark/system)
- **`setColorScheme`** (`(config: light|dark|system) => void`) - Function to change the color scheme
- **`isLight`** (`boolean`) - Whether the current resolved theme is light
- **`isDark`** (`boolean`) - Whether the current resolved theme is dark
- **`rootCssClass`** (`string`) - CSS class applied to the document root based on the resolved theme

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

## License

MIT © Dazl
