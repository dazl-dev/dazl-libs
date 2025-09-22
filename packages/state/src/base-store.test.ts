import { expect } from 'chai';
import { type ActionType } from './base-store.ts';

import { BaseStore } from './base-store.ts';

type TestStoreState = {
    count: number;
    text: string;
    nested: {
        value: number;
    };
};
// Test implementation of BaseStore
class TestStore extends BaseStore<TestStoreState> {
    static id = TestStore.uniqueId('TestStore', import.meta.url);
    constructor(initialState = { count: 0, text: 'hello', nested: { value: 1 } }) {
        super(initialState);
    }

    increment = this.action<{ amount?: number } | void>('INCREMENT', ({ amount = 1 } = {}) => {
        this.state = {
            ...this.state,
            count: this.state.count + amount,
        };
    });

    setText = this.action<{ text: string }>('SET_TEXT', ({ text }) => {
        this.state = {
            ...this.state,
            text,
        };
    });

    setNested = this.action<{ value: number }>('SET_NESTED', ({ value }) => {
        this.state = {
            ...this.state,
            nested: { ...this.state.nested, value },
        };
    });

    throwError = this.action('THROW_ERROR', () => {
        this.state = { ...this.state }; // to ensure state is "touched" and reverted
        throw new Error('Test error');
    });

    asyncAction = this.action<{ newCount: number }>('ASYNC_ACTION', async ({ newCount }) => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        this.state = {
            ...this.state,
            count: newCount,
        };
    });

    abortedAsyncAction = this.action<{ newCount: number }>('SLOW_ASYNC_ACTION', async ({ newCount }) => {
        this.state = {
            ...this.state,
            count: newCount,
        };
        await new Promise((resolve) => setTimeout(resolve, 20));
        this.abort();
    });

    batchedAction = this.action<{ increment1: number; increment2: number; text: string }>(
        'BATCHED_ACTION',
        async ({ increment1, increment2, text }) => {
            await this.increment({ amount: increment1 });
            await this.increment({ amount: increment2 });
            await this.setText({ text });
        },
    );

    nestedBatchedAction = this.action<{ step1: number; step2: number; text: string; nestedValue: number }>(
        'NESTED_BATCHED',
        async ({ step1, step2, text, nestedValue }) => {
            await this.batchedAction({
                increment1: step1,
                increment2: step2,
                text,
            });
            await this.setNested({ value: nestedValue });
        },
    );
}

describe('BaseStore', () => {
    let store: TestStore;
    let subscriberCallback: string[];

    beforeEach(() => {
        store = new TestStore();
        subscriberCallback = [];
    });

    describe('Constructor and Initial State', () => {
        it('should initialize with provided state', () => {
            const initialState = { count: 5, text: 'test', nested: { value: 10 } };
            const customStore = new TestStore(initialState);
            expect(customStore.state).to.deep.equal(initialState);
        });

        it('should make state readonly', () => {
            // This test only fail at TypeScript compile time.
            // @ts-expect-error The store state is readonly
            store.state.nested.value = 10;
        });
    });

    describe('Subscriptions', () => {
        it('should add and remove subscribers', () => {
            const unsubscribe = store.subscribe(() => {
                subscriberCallback.push('called');
            });
            expect(store['subscribers'].size).to.equal(1);
            unsubscribe();
            expect(store['subscribers'].size).to.equal(0);
        });

        it('should call subscribers when state changes', async () => {
            let callCount = 0;
            let lastPrevState: typeof store.state, lastNextState: typeof store.state, lastActions: ActionType[];

            store.subscribe((prevState, nextState, actions) => {
                callCount++;
                lastPrevState = prevState;
                lastNextState = nextState;
                lastActions = actions;
            });

            await store.increment({ amount: 5 });

            expect(callCount).to.equal(1);
            expect(lastPrevState!.count).to.equal(0);
            expect(lastNextState!.count).to.equal(5);
            expect(lastActions!).to.have.lengthOf(1);
            expect(lastActions![0]!.type).to.equal('INCREMENT');
            expect(lastActions![0]!.payload).to.deep.equal({ amount: 5 });
        });

        it('should not call subscribers when state does not change', async () => {
            let callCount = 0;
            store.subscribe(() => callCount++);

            // Create action that doesn't change state
            const noChangeAction = store['action']('NO_CHANGE', () => {
                // Don't modify state
            });

            await noChangeAction();
            expect(callCount).to.equal(0);
        });

        it('should not call subscribers on initial subscription', () => {
            let callCount = 0;
            store.subscribe(() => callCount++);
            expect(callCount).to.equal(0);
        });

        it('should handle subscriber errors gracefully', async () => {
            let errorCallbackCalled = false;
            let normalCallbackCalled = false;

            // Add a subscriber that throws an error
            store.subscribe(() => {
                errorCallbackCalled = true;
                throw new Error('Subscriber error');
            });

            // Add a normal subscriber
            store.subscribe(() => {
                normalCallbackCalled = true;
            });

            await store.increment();

            expect(errorCallbackCalled).to.equal(true);
            expect(normalCallbackCalled).to.equal(true);
        });
    });

    describe('Filtered Subscriptions', () => {
        it('should only call subscribers when filter returns true', async () => {
            let callCount = 0;

            // Filter that only triggers for count changes
            store.subscribe(
                () => callCount++,
                (prevState, nextState) => prevState.count !== nextState.count,
            );

            await store.setText({ text: 'new text' });
            expect(callCount).to.equal(0);

            await store.increment();
            expect(callCount).to.equal(1);
        });

        it('should handle filter function errors gracefully', async () => {
            let normalCallbackCalled = false;

            store.subscribe(
                () => {
                    normalCallbackCalled = true;
                },
                () => {
                    throw new Error('Filter error');
                },
            );

            await store.increment();
            expect(normalCallbackCalled).to.equal(false); // Callback shouldn't be called if filter throws
        });
    });

    describe('Actions', () => {
        it('should execute simple actions', async () => {
            await store.increment({ amount: 3 });
            expect(store.state.count).to.equal(3);

            await store.setText({ text: 'updated' });
            expect(store.state.text).to.equal('updated');
        });

        it('should not modify state when action throws error', async () => {
            const originalState = store.state;

            try {
                await store.throwError();
                expect.fail('Action should have thrown an error');
            } catch (error) {
                expect((error as Error).message).to.equal('Test error');
                expect(store.state).to.deep.equal(originalState);
            }
        });

        it('should not notify subscribers when action throws error', async () => {
            let callCount = 0;
            store.subscribe(() => callCount++);

            try {
                await store.throwError();
                expect.fail('Action should have thrown an error');
            } catch (error) {
                expect((error as Error).message).to.equal('Test error');
            }

            expect(callCount).to.equal(0);
        });
    });

    describe('Action Batching', () => {
        it('should batch multiple nested actions into single notification', async () => {
            let callCount = 0;
            let capturedActions: ActionType[] = [];

            store.subscribe((prevState, nextState, actions) => {
                callCount++;
                capturedActions = [...actions];
            });

            await store.batchedAction({
                increment1: 2,
                increment2: 3,
                text: 'batched',
            });

            expect(callCount).to.equal(1);
            expect(store.state.count).to.equal(5); // 0 + 2 + 3
            expect(store.state.text).to.equal('batched');

            expect(capturedActions.map((a) => a.type)).to.deep.equal([
                'BATCHED_ACTION',
                'INCREMENT',
                'INCREMENT',
                'SET_TEXT',
            ]);
        });

        it('should handle deeply nested batched actions', async () => {
            let callCount = 0;
            let capturedActions: ActionType[] = [];

            store.subscribe((prevState, nextState, actions) => {
                callCount++;
                capturedActions = [...actions];
            });

            await store.nestedBatchedAction({
                step1: 1,
                step2: 2,
                text: 'deeply nested',
                nestedValue: 99,
            });

            expect(callCount).to.equal(1);
            expect(store.state.count).to.equal(3); // 0 + 1 + 2
            expect(store.state.text).to.equal('deeply nested');
            expect(store.state.nested.value).to.equal(99);

            expect(capturedActions.map((a) => a.type)).to.deep.equal([
                'NESTED_BATCHED',
                'BATCHED_ACTION',
                'INCREMENT',
                'INCREMENT',
                'SET_TEXT',
                'SET_NESTED',
            ]);
        });

        it('should preserve state if error occurs during batching', async () => {
            const originalState = { ...store.state };

            // Create an action that calls other actions then fails
            const failingBatchAction = store['action']('FAILING_BATCH', async () => {
                await store.increment({ amount: 5 });
                await store.setText({ text: 'should not persist' });
                throw new Error('Batch failed');
            });

            let callCount = 0;
            store.subscribe(() => callCount++);

            try {
                await failingBatchAction();
                expect.fail('Action should have thrown an error');
            } catch (error) {
                expect((error as Error).message).to.equal('Batch failed');
                expect(store.state).to.deep.equal(originalState);
                expect(callCount).to.equal(0);
            }
        });
    });

    describe('Scenarios', () => {
        it('should handle concurrent actions properly', async () => {
            const promises = [
                store.increment({ amount: 1 }),
                store.increment({ amount: 2 }),
                store.increment({ amount: 3 }),
            ];

            await Promise.all(promises);
            expect(store.state.count).to.equal(6);
        });

        it('should handle multiple subscribers with different filters', async () => {
            let countChangeCount = 0;
            let textChangeCount = 0;
            let allChangeCount = 0;

            // Subscribe to count changes only
            store.subscribe(
                () => countChangeCount++,
                (prev, next) => prev.count !== next.count,
            );

            // Subscribe to text changes only
            store.subscribe(
                () => textChangeCount++,
                (prev, next) => prev.text !== next.text,
            );

            // Subscribe to all changes
            store.subscribe(() => allChangeCount++);

            await store.increment();
            expect(countChangeCount).to.equal(1);
            expect(textChangeCount).to.equal(0);
            expect(allChangeCount).to.equal(1);

            await store.setText({ text: 'new' });
            expect(countChangeCount).to.equal(1);
            expect(textChangeCount).to.equal(1);
            expect(allChangeCount).to.equal(2);

            await store.batchedAction({
                increment1: 1,
                increment2: 1,
                text: 'batched text',
            });
            expect(countChangeCount).to.equal(2); // Count changed
            expect(textChangeCount).to.equal(2); // Text changed
            expect(allChangeCount).to.equal(3); // One notification for batch
        });
    });

    describe('Abort Mechanism', () => {
        it('should throw error when aborting during action execution', async () => {
            try {
                await store.abortedAsyncAction({ newCount: 100 });
                expect.fail('Action should have thrown an error');
            } catch (error) {
                expect((error as Error).message).to.equal('Action aborted');
            }
            expect(store.state.count).to.equal(0);
        });

        it('should handle abort in batched actions with proper rollback', async () => {
            const originalState = store.state;

            // Create a batched action that can be aborted
            const batchedAbortAction = store['action']('BATCHED_ABORT', async () => {
                await store.increment({ amount: 10 });
                await store.setText({ text: 'modified' });
                await store.abortedAsyncAction({ newCount: 50 });
            });

            try {
                await batchedAbortAction();
                expect.fail('Action should have thrown an error');
            } catch (error) {
                expect((error as Error).message).to.equal('Action aborted');
            }

            // All changes should be rolled back due to abort
            expect(store.state).to.equal(originalState);
        });

        it('should not notify subscribers when action is aborted', async () => {
            let subscriberCallCount = 0;
            let lastNotification: { prev: unknown; next: unknown; actions: ActionType[] } | null = null;

            store.subscribe((prev, next, actions) => {
                subscriberCallCount++;
                lastNotification = { prev, next, actions };
            });

            try {
                await store.abortedAsyncAction({ newCount: 200 });
                expect.fail('Action should have thrown an error');
            } catch (error) {
                expect((error as Error).message).to.equal('Action aborted');
            }

            // Subscriber should not have been called for the aborted action
            expect(subscriberCallCount).to.equal(0);
            expect(lastNotification).to.equal(null);

            // Verify subscribers still work for successful actions
            await store.increment();
            expect(subscriberCallCount).to.equal(1);
            expect(lastNotification).to.not.equal(null);
            expect(lastNotification!.actions).to.have.length(1);
            expect(lastNotification!.actions[0]!.type).to.equal('INCREMENT');
        });
    });

    describe('Store Cleanup', () => {
        it('should clean up properly after nested batched actions', async () => {
            await store.nestedBatchedAction({
                step1: 1,
                step2: 2,
                text: 'nested test',
                nestedValue: 99,
            });

            // All cleanup properties should be reset after complex batching
            expect(store.abortController).to.equal(undefined);
            expect(store['batchCount']).to.equal(0);
            expect(store['batchedActions']).to.equal(undefined);
            expect(store['initialState']).to.equal(undefined);
        });
        it('should clean up all properties after failed actions', async () => {
            try {
                await store.throwError();
                expect.fail('Action should have thrown an error');
            } catch (error) {
                expect((error as Error).message).to.equal('Test error');
            }

            // All cleanup properties should be reset
            expect(store.abortController).to.equal(undefined);
            expect(store['batchCount']).to.equal(0);
            expect(store['batchedActions']).to.equal(undefined);
            expect(store['initialState']).to.equal(undefined);
        });

        it('should clean up all properties after aborted actions', async () => {
            try {
                await store.abortedAsyncAction({ newCount: 50 });
                expect.fail('Action should have thrown an error');
            } catch (error) {
                expect((error as Error).message).to.equal('Action aborted');
            }

            // All cleanup properties should be reset
            expect(store.abortController).to.equal(undefined);
            expect(store['batchCount']).to.equal(0);
            expect(store['batchedActions']).to.equal(undefined);
            expect(store['initialState']).to.equal(undefined);
        });
    });
});
