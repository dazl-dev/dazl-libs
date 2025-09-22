export type ActionType = { type: string; payload: Record<string, unknown> | void };
export type SubscriberCallback<T> = (
    prevState: DeepReadonly<T>,
    nextState: DeepReadonly<T>,
    actions: ActionType[],
) => void;
export type SubscriberFilter<T> = (
    prevState: DeepReadonly<T>,
    nextState: DeepReadonly<T>,
    actions: ActionType[],
) => boolean;

export type DeepReadonly<T> = {
    readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};
export type StoreUniqueId<Id extends string> = Id & { __brand: 'UniqueId' };

export abstract class BaseStore<T extends object> {
    private static ids = new Map<string, string>();
    /**
     * Used to define a unique id for a global store class.
     *
     * @example
     * type StoreState = { count: number };
     *
     * class MyStore extends BaseStore<StoreState> {
     *   static id = BaseStore.uniqueId("MyStore", import.meta.url);
     *   constructor(state: Partial<StoreState> = {}) {
     *     super({ count: 0, ...state });
     *   }
     * }
     */
    static uniqueId<T extends string>(id: T, url: string): StoreUniqueId<T> {
        const { pathname } = new URL(url);
        if (id.includes('@')) {
            throw new Error(`id "${id}" cannot contain "@" character`);
        }
        const existing = this.ids.get(id);
        const key = `${id}@${pathname}`;
        if (existing && existing !== key) {
            throw new Error(`Duplicate id "${existing}" found in "${key}"`);
        }
        this.ids.set(id, key);
        return id as StoreUniqueId<T>;
    }
    state: DeepReadonly<T>;
    private subscribers: Set<{
        callback: SubscriberCallback<T>;
        filter?: SubscriberFilter<T>;
    }> = new Set();

    private batchCount = 0;
    private batchedActions: ActionType[] | undefined = undefined;
    private initialState: DeepReadonly<T> | undefined = undefined;
    abortController: AbortController | undefined = undefined;

    constructor(state: T) {
        this.state = state;
    }
    /**
     * Returns the current state as a deeply readonly object.
     * The returned object should not be mutated.
     */
    getSnapshot(): DeepReadonly<T> {
        return this.state;
    }
    /**
     * Subscribes to state changes.
     * The callback will be called whenever the state changes, with the previous state, the new state, and the actions that caused the change.
     * An optional filter can be provided to only call the callback for specific state changes.
     * Returns an unsubscribe function to remove the subscriber.
     * Does not trigger on initial subscription.
     * Dose not
     */
    subscribe(callback: SubscriberCallback<T>, filter?: SubscriberFilter<T>): () => void {
        const subscriber = { callback, filter };
        this.subscribers.add(subscriber);
        return () => {
            this.subscribers.delete(subscriber);
        };
    }
    /**
     * Creates an action that can modify the state.
     * The action will batch state changes and notify subscribers only once after all nested actions complete.
     * @param type A string representing the action type.
     * @param fn A function that takes a payload and modifies the state.
     *
     * @example
     * class MyState extends State<{ count: number }> {
     *  constructor() {
     *      super({ count: 0 });
     *  }
     *  increment = this.action<{ amount?: number }>('INCREMENT', ({ amount = 1 }) => {
     *      this.state = { ...this.state, count: this.state.count + amount };
     *  });
     * }
     */
    protected action = <P extends Record<string, unknown> | void>(
        type: string,
        fn: (payload: P) => void | Promise<void>,
    ) => {
        return async (payload: P) => {
            const action: ActionType = { type, payload };
            const isRoot = this.batchCount === 0;
            if (isRoot) {
                this.initialState = this.state;
            }
            this.abortController ??= new AbortController();
            this.batchedActions ??= [];
            this.batchedActions.push(action);
            this.batchCount++;
            let batchError: unknown;
            try {
                await fn(payload);
                if (this.abortController?.signal.aborted) {
                    throw new Error('Action aborted');
                }
            } catch (error) {
                batchError = error;
                throw error;
            } finally {
                this.batchCount--;
                if (this.batchCount === 0 && this.initialState) {
                    if (batchError) {
                        this.state = this.initialState;
                    } else {
                        this.notifySubscribers(this.initialState, this.state, this.batchedActions);
                    }
                    this.abortController = undefined;
                    this.batchedActions = undefined;
                    this.initialState = undefined;
                }
            }
        };
    };
    /**
     * Internal mechanism to abort the currently running action.
     */
    protected abort() {
        if (this.abortController) {
            this.abortController.abort();
        } else {
            throw new Error('No action is currently running to abort');
        }
    }

    /**
     * Restore state from a history entry (used by History class)
     * This method allows controlled restoration of previous states
     * while properly notifying subscribers of the change.
     */
    restoreFromHistory(newState: DeepReadonly<T>): void {
        const prevState = this.state;
        this.state = newState;

        // Create a HISTORY_RESTORE action to notify subscribers
        const restoreAction: ActionType = {
            type: 'HISTORY_RESTORE',
            payload: { timestamp: Date.now() },
        };

        this.notifySubscribers(prevState, newState, [restoreAction]);
    }

    private notifySubscribers = (prevState: DeepReadonly<T>, nextState: DeepReadonly<T>, actions: ActionType[]) => {
        if (prevState === nextState) {
            return; // No state change
        }
        this.subscribers.forEach((sub) => {
            try {
                if (!sub.filter || sub.filter(prevState, nextState, actions)) {
                    sub.callback(prevState, nextState, actions);
                }
            } catch (error) {
                console.error('Subscriber callback error:', error);
            }
        });
    };
}
