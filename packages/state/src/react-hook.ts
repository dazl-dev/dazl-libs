import { useEffect, useReducer, useCallback, useRef } from 'react';
import type { BaseStore, DeepReadonly, SubscriberFilter } from './base-store.js';

/**
 * Hook to create a stable function reference that won't cause re-subscriptions.
 * Updates the function reference without changing the callback identity.
 *
 * @param fn The function to stabilize
 * @returns A stable function reference
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function useStableFilter<T extends SubscriberFilter<any> | undefined>(fn?: T): T {
    const fnRef = useRef(fn);
    fnRef.current = fn;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invokeCurrentFilter: SubscriberFilter<any> = (...args) => (fnRef.current ? fnRef.current(...args) : true);
    return useCallback(invokeCurrentFilter, []) as T;
}

/**
 * A simple React hook that subscribes to a BaseStore and forces re-renders when state changes.
 * Uses modulo to prevent counter overflow.
 *
 * @param store The BaseStore instance to subscribe to
 * @param filter Optional filter function to control when re-renders happen
 * @returns The current store state
 *
 * @example
 * function Counter() {
 *   const store = useCounterStore();
 *
 *   // Subscribe to all changes
 *   const state = useStoreState(store);
 *
 *   // Only re-render when count changes
 *   const countOnlyState = useStoreState(store, (prev, next) => prev.count !== next.count);
 *
 *   return (
 *     <div>
 *       <p>Count: {state.count}</p>
 *       <button onClick={() => store.increment()}>+</button>
 *     </div>
 *   );
 * }
 */
export function useStoreState<T extends object>(store: BaseStore<T>, filter?: SubscriberFilter<T>): DeepReadonly<T> {
    const [, forceUpdate] = useReducer(() => ({}), {});
    const stableFilter = useStableFilter(filter);
    useEffect(() => store.subscribe(forceUpdate, stableFilter), [store, stableFilter]);
    return store.state;
}
