# @dazl/component-gallery

A [Dazl](https://dazl.dev) integration that lets you browse and preview your project's React components.

## Installation

Within your React Router project:

```bash
npm install @dazl/component-gallery
```

## Setup

### 1. Add the Gallery Route

Create a development-only route in your React Router project:

```tsx
// app/dev/components.tsx
import '@dazl/component-gallery/styles.css';
export { default } from '@dazl/component-gallery/route';
export function clientLoader() {}
export function HydrateFallback() {}
```

Register the route:

```ts
// app/routes.ts
import { route, type RouteConfig } from '@react-router/dev/routes';

export default [
  // ... your other routes
  route('dev/components', 'dev/components.tsx'),
] satisfies RouteConfig;
```

### 2. Create Component Examples

Define component examples as `.example.tsx` files that export a React component as the default export:

```tsx
// app/components/button/button.example.tsx
import { Button } from './button';

export default function ButtonExample() {
  return <Button>Click me</Button>;
}
```

When you open the project in Dazl, it will automatically discover these files and provide a menu that lists all examples, allowing you to preview them.

## Usage

### Organizing Examples with Sections

Use the `Section` component to group related examples within a single file:

```tsx
// app/components/button/button.example.tsx
import { Section } from '@dazl/component-gallery';
import { Button } from './button';

export default function ButtonExample() {
  return (
    <>
      <Section title="Sizes" layout="row">
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
      </Section>

      <Section title="States" layout="column">
        <Button disabled>Disabled</Button>
        <Button loading>Loading</Button>
      </Section>
    </>
  );
}
```
