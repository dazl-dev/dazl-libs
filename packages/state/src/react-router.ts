import { useLoaderData } from 'react-router';
import { createContext, createElement, useContext, useMemo } from 'react';
import type { BaseStore, StoreUniqueId } from './base-store.ts';

export { useStoreState } from './react-hook.ts';

/**
 * Creates a global store for a specific store data type under GlobalStoresContextProvider.
 * @param StoreClass The class of the store to create.
 * @returns An object containing react router loader function and a useStore hook.
 *
 * @example
 * import { BaseStore } from "@dazl/state/base-store";
 * import { createGlobalStore } from "@dazl/state/react-router";
 *
 * export type AppState = { name: string };
 *
 * export class AppStore extends BaseStore<AppState> {
 *   static id = BaseStore.uniqueId("AppStore", import.meta.url);
 *   constructor(state: Partial<AppState> = {}) {
 *     super({ name: "Dazl", ...state });
 *   }
 * }
 *
 * export const { storeLoader: appStoreLoader, useStore: useAppStore } = createGlobalStore(AppStore);
 */
export function createGlobalStore<T extends string, Store extends BaseStore<object>, StoreData>(
    StoreClass: { id: StoreUniqueId<T> } & (new (data: StoreData) => Store),
) {
    type LoaderMapping = {
        [K in typeof key]: Store extends BaseStore<infer S> ? S : StoreData;
    };

    const key = `store_${StoreClass.id}` as const;

    return {
        useStore() {
            const context = useGlobalStoresContext();
            const data = useLoaderData<{ [key: string]: StoreData }>();
            if (data && typeof data === 'object' && key in data) {
                const storeData = context.get(key);
                let store = storeData?.store as Store | undefined;
                if (!store) {
                    store = new StoreClass(data[key] as StoreData);
                    context.set(key, { store, data: data[key] });
                } else {
                    store = hotStore<T, Store, StoreData>(store, StoreClass, storeData, data, key, context);
                }
                return store;
            } else {
                throw new Error(`No store data found for key: ${key}. use the storeLoader to load data for this key.`);
            }
        },
        storeLoader(data: StoreData): LoaderMapping {
            return {
                [key]: data,
            } as LoaderMapping;
        },
    };
}

const GlobalStoresContext = createContext<Map<string, { store: BaseStore<object>; data: unknown }> | null>(null);

function hotStore<T extends string, Store extends BaseStore<object>, StoreData>(
    store: Store,
    StoreClass: { id: StoreUniqueId<T> } & (new (data: StoreData) => Store),
    storeData: { store: BaseStore<object>; data: unknown } | undefined,
    data: { [key: string]: StoreData },
    key: string,
    context: Map<string, { store: BaseStore<object>; data: unknown }>,
) {
    const CurrentStoreConstructor = store.constructor as typeof StoreClass;
    if (store instanceof StoreClass) {
        if (storeData?.data !== data[key]) {
            // update existing store instance with new data
            store = new StoreClass(data[key] as StoreData);
            context.set(key, { store, data: data[key] });
        }
        // no op - reuse existing store instance
    } else if (CurrentStoreConstructor.id === StoreClass.id) {
        store = new StoreClass(store.getSnapshot() as StoreData);
        context.set(key, { store, data: data[key] });
    } else {
        throw new Error(
            `Store instance type mismatch for key: ${key}. Expected ${StoreClass.id}, got ${CurrentStoreConstructor.id}`,
        );
    }
    return store;
}

export function GlobalStoresContextProvider({ children }: { children: React.ReactNode }) {
    const value = useMemo(() => new Map<string, { store: BaseStore<object>; data: unknown }>(), []);
    return createElement(GlobalStoresContext.Provider, { value }, children);
}

export function useGlobalStoresContext() {
    const context = useContext(GlobalStoresContext);
    if (!context) {
        throw new Error('GlobalStoresContext not found. Please wrap your app in a <GlobalStoresContextProvider>.');
    }
    return context;
}
