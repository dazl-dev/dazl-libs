# @dazl/state - State Management Library

## Overview

The `@dazl/state` library is a TypeScript-first state management solution designed for modern web applications with React Router integration. It provides a robust, type-safe foundation for managing application state with features like action batching, subscription management, error handling, and abort mechanisms.

## Core Concepts

### BaseStore

The `BaseStore` is an abstract class that forms the foundation of the state management system. It provides:

- **Deep Readonly State**: All state is deeply readonly to prevent accidental mutations
- **Action-Based Updates**: State changes happen through typed actions with automatic batching
- **Subscription System**: Components can subscribe to state changes with optional filtering
- **Error Handling**: Robust error handling with state rollback on failures
- **Abort Mechanism**: Actions can be aborted with proper cleanup and rollback

### Key Features

1. **Type Safety**: Full TypeScript support with generic types ensuring type safety across the entire state management flow
2. **Action Batching**: Multiple nested actions are automatically batched into single notifications
3. **Filtered Subscriptions**: Subscribers can filter which state changes they care about
4. **Async Support**: Full support for async actions with proper error handling
5. **React Router Integration**: Built-in integration with React Router for global store management
6. **Unique Store IDs**: Each store class has a unique identifier to prevent conflicts

## Usage Patterns

### Basic Store Implementation

```typescript
import { BaseStore } from '@dazl/state/base-store';

type CounterState = { count: number; label: string };

class CounterStore extends BaseStore<CounterState> {
  static id = BaseStore.uniqueId('CounterStore', import.meta.url);

  constructor(state: Partial<CounterState> = {}) {
    super({ count: 0, label: 'Counter', ...state });
  }

  increment = this.action<{ amount?: number }>('INCREMENT', ({ amount = 1 }) => {
    this.state = { ...this.state, count: this.state.count + amount };
  });

  setLabel = this.action<{ label: string }>('SET_LABEL', ({ label }) => {
    this.state = { ...this.state, label };
  });
}
```

### React Integration

The library provides seamless React integration through hooks that handle subscriptions and re-renders automatically.

#### Basic Component Usage

```typescript
import { useStoreState } from '@dazl/state/react-hook';

function Counter() {
  const store = useCounterStore();

  // Subscribe to all state changes - component re-renders on any state update
  const state = useStoreState(store);

  return (
    <div>
      <h2>{state.label}</h2>
      <p>Count: {state.count}</p>
      <button onClick={() => store.increment({ amount: 1 })}>+1</button>
      <button onClick={() => store.increment({ amount: 5 })}>+5</button>
      <button onClick={() => store.setLabel({ label: "New Counter" })}>Rename</button>
    </div>
  );
}
```

#### Global State with React Router

For application-wide state management, the library integrates with React Router's data loading patterns:

```typescript
import { createGlobalStore, useStoreState } from '@dazl/state/react-router';

// Create global store utilities
export const { storeLoader: counterStoreLoader, useStore: useCounterStore } =
  createGlobalStore(CounterStore);

// In your route loader - provide initial data
export const loader = () => {
  return {
    ...counterStoreLoader({ count: 10, label: "Global Counter" }),
  };
};

// In any component within the route tree
function Counter() {
  const store = useCounterStore(); // Access global store instance
  const state = useStoreState(store); // Subscribe to changes

  return (
    <div>
      <h3>{state.label}</h3>
      <p>Global Count: {state.count}</p>
      <button onClick={() => store.increment({ amount: 1 })}>Increment</button>
    </div>
  );
}

// Multiple components can access the same global store
function CounterDisplay() {
  const store = useCounterStore();
  const state = useStoreState(store, (prev, next) => prev.count !== next.count);

  return <div className="counter-badge">Count: {state.count}</div>;
}
```

## Advanced Patterns

### Action Composition and Batching

Actions can call other actions, with all state changes batched into a single notification:

```typescript
class TodoStore extends BaseStore<{
  todos: Todo[];
  filter: string;
  stats: { total: number; completed: number };
}> {
  static id = BaseStore.uniqueId('TodoStore', import.meta.url);

  // Simple actions
  addTodo = this.action<{ todo: Todo }>('ADD_TODO', ({ todo }) => {
    this.state = { ...this.state, todos: [...this.state.todos, todo] };
  });

  setFilter = this.action<{ filter: string }>('SET_FILTER', ({ filter }) => {
    this.state = { ...this.state, filter };
  });

  updateStats = this.action('UPDATE_STATS', () => {
    const total = this.state.todos.length;
    const completed = this.state.todos.filter((t) => t.completed).length;
    this.state = { ...this.state, stats: { total, completed } };
  });

  // Composed action - all changes batched into single notification
  addTodoAndFilter = this.action<{ todo: Todo; filter: string }>('ADD_AND_FILTER', async ({ todo, filter }) => {
    await this.addTodo({ todo });
    await this.setFilter({ filter });
    await this.updateStats();
    // Subscribers only get notified once with the final state
  });
}
```

### Async Actions and Loading States

Handle async operations with automatic error recovery:

```typescript
class DataStore extends BaseStore<{
  data: any[];
  loading: boolean;
  error: string | null;
}> {
  static id = BaseStore.uniqueId('DataStore', import.meta.url);

  constructor() {
    super({ data: [], loading: false, error: null });
  }

  fetchData = this.action<{ url: string }>('FETCH_DATA', async ({ url }) => {
    this.state = { ...this.state, loading: true, error: null };

    // Simulate API call
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    const data = await response.json();
    this.state = { ...this.state, data, loading: false };

    // If any step fails, ALL changes (including loading: true) are rolled back
  });
}
```

### Action Cancellation and Abort

Long-running actions can be aborted with automatic state rollback:

```typescript
class ProcessingStore extends BaseStore<{ processing: boolean; result: any }> {
  processLargeDataset = this.action<{ dataset: any[] }>('PROCESS', async ({ dataset }) => {
    this.state = { ...this.state, processing: true };

    for (let i = 0; i < dataset.length; i++) {
      // Check abort condition
      if (this.shouldCancel(dataset[i])) {
        this.abort(); // Rolls back ALL state changes and throws "Action aborted"
      }

      // Process item...
      await this.processItem(dataset[i]);
    }

    this.state = { ...this.state, processing: false, result: 'completed' };
  });

  private shouldCancel(item: any): boolean {
    // Your cancellation logic here
    return false;
  }
}
```

### Manual Action Flushing

The `flush()` method allows you to immediately notify subscribers with current state changes during a long-running action, rather than waiting for the entire action to complete. This is useful for providing intermediate updates in complex workflows:

```typescript
class DataProcessingStore extends BaseStore<{
  items: any[];
  processedCount: number;
  status: string;
}> {
  static id = BaseStore.uniqueId('DataProcessingStore', import.meta.url);

  constructor() {
    super({ items: [], processedCount: 0, status: 'idle' });
  }

  processLargeDataset = this.action<{ dataset: any[] }>('PROCESS_DATASET', async ({ dataset }) => {
    this.state = { ...this.state, status: 'processing', processedCount: 0 };

    for (let i = 0; i < dataset.length; i++) {
      // Process individual item
      const processed = await this.processItem(dataset[i]);
      this.state = {
        ...this.state,
        items: [...this.state.items, processed],
        processedCount: i + 1,
      };

      // Flush every 100 items to update UI with progress
      if ((i + 1) % 100 === 0) {
        this.flush(); // Subscribers get notified with current progress
      }
    }

    this.state = { ...this.state, status: 'completed' };
    // Final notification happens automatically when action completes
  });

  private async processItem(item: any): Promise<any> {
    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { ...item, processed: true };
  }
}
```

**Key flush characteristics:**

- **Intermediate Notifications**: Subscribers receive state updates immediately instead of waiting for action completion
- **Batch Consolidation**: All actions since the last flush (or action start) are replaced with a single `FLUSH` action in the notification
- **Action Context Required**: `flush()` can only be called from within an action - calling it outside throws an error
- **Automatic Prevention**: Multiple flush calls in the same batch are automatically deduplicated
- **Payload Information**: The `FLUSH` action includes metadata about what was batched (action types, count, timestamp)

This pattern is particularly useful for:

- Long-running data processing with progress updates
- Multi-step workflows where intermediate results should be visible
- Real-time updates during batch operations
- Providing responsive UIs during heavy computations

### Error Handling and Recovery

When any action fails, **ALL state changes** made during that action are automatically rolled back:

```typescript
class DataStore extends BaseStore<{ data: any[]; loading: boolean; error: string | null }> {
  // ✅ Correct - let automatic rollback handle failures
  fetchData = this.action<{ url: string }>('FETCH', async ({ url }) => {
    this.state = { ...this.state, loading: true, error: null };

    const response = await fetch(url); // If this fails...
    const data = await response.json();

    this.state = { ...this.state, data, loading: false };
    // ...ALL changes (including loading: true) are rolled back automatically
  });

  // ❌ Wrong - manual cleanup is unnecessary
  fetchDataWrong = this.action<{ url: string }>('FETCH_WRONG', async ({ url }) => {
    this.state = { ...this.state, loading: true };
    try {
      const data = await fetch(url).then((r) => r.json());
      this.state = { ...this.state, data, loading: false };
    } catch (error) {
      this.state = { ...this.state, loading: false }; // ← Unnecessary!
      throw error;
    }
  });
}
```

**Error handling guarantees:**

- Complete automatic rollback on any error
- No manual cleanup required
- Batched actions roll back atomically
- Subscribers only see successful state transitions
- Error details preserved in thrown exceptions

## Design Principles

1. **Immutability**: State is always deeply readonly, preventing accidental mutations
2. **Predictability**: All state changes happen through well-defined actions
3. **Performance**: Automatic batching reduces unnecessary re-renders
4. **Type Safety**: Full TypeScript integration ensures compile-time safety
5. **Error Recovery**: Automatic state rollback on action failures
6. **Composability**: Actions can call other actions with proper batching
7. **React Integration**: Seamless integration with React Router and hooks - `useStoreState` hook handles subscriptions automatically

## Best Practices

### State Design

- Keep state flat when possible - avoid deeply nested objects
- Use normalized data structures for lists and collections
- Separate UI state from domain data
- Consider using multiple smaller stores instead of one large store

### Action Design

- Make actions focused and atomic - each action should do one logical thing
- Use descriptive action names that clearly indicate the operation
- Leverage action composition for complex workflows
- Avoid side effects in actions - use subscriptions for logging, analytics, etc.

### Performance Optimization

- Use filtered subscriptions (`useStoreState` with filter function) to prevent unnecessary re-renders
- Batch related state changes by composing actions
- Consider memoizing expensive computations in selectors
- Use React's `useMemo` and `useCallback` with store-derived data

```typescript
// Good: Filtered subscription prevents re-renders when label changes
function CountDisplay() {
  const store = useCounterStore();
  const state = useStoreState(store, (prev, next) => prev.count !== next.count);
  return <div>Count: {state.count}</div>;
}

// Good: Memoized expensive computation
function ExpensiveComponent() {
  const store = useDataStore();
  const state = useStoreState(store);

  const expensiveValue = useMemo(() => {
    return computeExpensiveValue(state.data);
  }, [state.data]);

  return <div>{expensiveValue}</div>;
}
```

## Testing Guide

The library is designed with testability in mind:

### Unit Testing Actions

```typescript
describe('CounterStore', () => {
  let store: CounterStore;

  beforeEach(() => {
    store = new CounterStore({ count: 0, label: 'Test Counter' });
  });

  test('increment action updates state', async () => {
    await store.increment({ amount: 5 });
    expect(store.getSnapshot().count).toBe(5);
  });

  test('action failure rolls back state', async () => {
    const originalState = store.getSnapshot();

    // Mock an action that will fail
    const failingAction = store.action('FAIL', () => {
      store.state = { ...store.state, count: 999 };
      throw new Error('Action failed');
    });

    await expect(failingAction()).rejects.toThrow('Action failed');
    expect(store.getSnapshot()).toEqual(originalState);
  });
});
```

## API Reference

### BaseStore\<T\>

Abstract base class for all stores providing type-safe state management.

#### Static Methods

- `uniqueId<T>(id: T, url: string): StoreUniqueId<T>` - Creates unique store identifier using class name and import URL

#### Instance Methods

- `getSnapshot(): DeepReadonly<T>` - Returns current state snapshot
- `subscribe(callback: SubscriptionCallback<T>, filter?: SubscriptionFilter<T>): () => void` - Subscribe to state changes
- `action<P>(type: string, fn: ActionFunction<P>): (payload: P) => Promise<void>` - Create typed action

#### Properties

- `state: DeepReadonly<T>` - Current state (readonly, use actions to modify)
- `abortController: AbortController | undefined` - Active abort controller for current action

#### Protected Methods

- `abort(): void` - Abort current action and rollback all state changes
- `flush(): void` - Immediately flush current batch and notify subscribers (can only be called within an action)

### React Hooks

#### useStoreState\<T\>(store, filter?)

React hook for subscribing to store state with automatic re-renders.

**Parameters:**

- `store: BaseStore<T>` - Store instance to subscribe to
- `filter?: (prev: T, next: T) => boolean` - Optional change filter to optimize re-renders

**Returns:** `DeepReadonly<T>` - Current store state

**Usage:**

```typescript
// Subscribe to all changes
const state = useStoreState(store);

// Subscribe only when count changes
const state = useStoreState(store, (prev, next) => prev.count !== next.count);
```

### React Router Integration

#### createGlobalStore\<T\>(StoreClass)

Creates utilities for global store management with React Router.

**Parameters:**

- `StoreClass: new (...args: any[]) => BaseStore<T>` - Store class constructor

**Returns:** Object with:

- `useStore(): BaseStore<T>` - Hook to access global store instance
- `storeLoader(initialData?: Partial<T>): LoaderMapping` - Loader function for route data

**Example:**

```typescript
export const { storeLoader: userStoreLoader, useStore: useUserStore } =
  createGlobalStore(UserStore);

// In route configuration
export const loader = () => ({
  ...userStoreLoader({ id: 'user123', name: 'John' })
});

// In components
function UserProfile() {
  const store = useUserStore();
  const state = useStoreState(store);
  return <div>Hello, {state.name}!</div>;
}
```

#### Context Components

- `GlobalStoresContextProvider` - Provides store context to React tree wrapping the entire App
- `useGlobalStoresContext()` - Access the stores context (advanced usage)

### Type Definitions

```typescript
type DeepReadonly<T> = { readonly [P in keyof T]: DeepReadonly<T[P]> };

type SubscriptionCallback<T> = (prevState: DeepReadonly<T>, nextState: DeepReadonly<T>, actions: string[]) => void;

type SubscriptionFilter<T> = (prevState: DeepReadonly<T>, nextState: DeepReadonly<T>) => boolean;

type ActionFunction<P> = (payload: P) => Promise<void> | void;

type StoreUniqueId<T> = symbol & { __storeId: T };
```

---

This library provides a robust, type-safe foundation for state management that scales from simple component state to complex application-wide data flows. The combination of automatic error handling, action batching, and seamless React integration makes it an excellent choice for modern TypeScript applications.
