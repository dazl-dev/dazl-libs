import { expect } from 'chai';
import { type ActionType } from './base-store.ts';
import { TestStore } from './test-store.ts';

describe('BaseStore', () => {
    let store: TestStore;
    let subscriberCallback: string[];

    beforeEach(() => {
        TestStore['ids'].clear();
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

    describe('Static Methods', () => {
        describe('uniqueId', () => {
            it('should create a unique id', () => {
                const id = TestStore.uniqueId('testId', 'file:///test/path.ts');
                expect(id).to.equal('testId');
            });

            it('should throw error when id contains "@" character', () => {
                expect(() => {
                    TestStore.uniqueId('invalid@id', 'file:///test/path.ts');
                }).to.throw('id "invalid@id" cannot contain "@" character');
            });

            it('should throw error for duplicate ids from different files', () => {
                // First registration
                TestStore.uniqueId('duplicateId', 'file:///test/path1.ts');

                // Second registration with same id but different path should throw
                expect(() => {
                    TestStore.uniqueId('duplicateId', 'file:///test/path2.ts');
                }).to.throw('Duplicate id "duplicateId@/test/path1.ts" found in "duplicateId@/test/path2.ts"');
            });

            it('should allow same id from same file (re-registration)', () => {
                const id1 = TestStore.uniqueId('sameFileId', 'file:///test/same.ts');
                const id2 = TestStore.uniqueId('sameFileId', 'file:///test/same.ts');
                expect(id1).to.equal(id2);
            });
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

        it('should throw error when trying to abort with no active action', () => {
            expect(() => {
                store['abort']();
            }).to.throw('No action is currently running to abort');
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
            expect(store['flushedState']).to.equal(undefined);
        });
    });

    describe('Flush Mechanism', () => {
        it('should throw error when flush is called outside of an action batch', () => {
            expect(() => {
                store.testFlush();
            }).to.throw('Cannot flush outside of an action batch');
        });

        it('should flush actions and create FLUSH action with correct payload', async () => {
            let callCount = 0;
            let capturedActions: ActionType[] = [];

            store.subscribe((prevState, nextState, actions) => {
                callCount++;
                capturedActions = [...actions];
            });

            await store.flushingAction({
                increment1: 2,
                increment2: 3,
                text: 'flushed',
            });

            // Should only get one notification due to flush, then one more for final actions
            expect(callCount).to.equal(2);

            // First notification should be the flush
            expect(capturedActions[0]!.type).to.equal('FLUSH');
            const flushPayload = capturedActions[0]!.payload as Record<string, unknown>;
            expect(flushPayload.flushedActionTypes).to.deep.equal(['FLUSHING_ACTION', 'INCREMENT', 'INCREMENT']);

            // Verify final state is correct
            expect(store.state.count).to.equal(5); // 0 + 2 + 3
            expect(store.state.text).to.equal('flushed');
        });

        it('should prevent duplicate flush notifications in same batch when flush is called at the end of an action', async () => {
            let callCount = 0;
            const allCapturedActions: ActionType[][] = [];

            store.subscribe((prevState, nextState, actions) => {
                callCount++;
                allCapturedActions.push([...actions]);
            });

            await store.doubleFlushAction({
                increment1: 2,
                increment2: 3,
            });

            // Should get exactly 2 notifications: one from first flush, one from final batch completion
            expect(callCount).to.equal(2);

            // First notification should be from the first flush - the actual batched actions
            expect(allCapturedActions[0]!.length).to.equal(2);
            expect(allCapturedActions[0]![0]!.type).to.equal('DOUBLE_FLUSH_ACTION');
            expect(allCapturedActions[0]![1]!.type).to.equal('INCREMENT');

            // Second notification should be final completion with FLUSH and remaining actions
            expect(allCapturedActions[1]!.length).to.equal(2);
            expect(allCapturedActions[1]![0]!.type).to.equal('FLUSH');
            expect(allCapturedActions[1]![1]!.type).to.equal('INCREMENT');

            // The FLUSH action should have the correct payload
            const flushPayload = allCapturedActions[1]![0]!.payload as Record<string, unknown>;
            expect(flushPayload.flushedActionTypes).to.deep.equal(['DOUBLE_FLUSH_ACTION', 'INCREMENT']);
        });

        it('should use flushed state as previous state for subsequent notifications', async () => {
            const notificationStates: Array<{ prev: typeof store.state; next: typeof store.state }> = [];

            store.subscribe((prevState, nextState) => {
                notificationStates.push({ prev: prevState, next: nextState });
            });

            // Create a more complex action with multiple flush steps
            const multiFlushAction = store['action']('MULTI_FLUSH_ACTION', async () => {
                // Step 1: increment count and flush
                await store.increment({ amount: 2 });
                await store.increment({ amount: 3 });
                store['flush'](); // First flush: count goes from 0 -> 5

                // Step 2: change text and increment more, then flush again
                await store.setText({ text: 'after first flush' });
                await store.increment({ amount: 1 });
                store['flush'](); // Second flush: text changes and count goes from 5 -> 6

                // Step 3: final changes after second flush
                await store.setNested({ value: 99 });
                await store.setText({ text: 'final text' });
            });

            await multiFlushAction();

            expect(notificationStates.length).to.equal(3);

            // First notification: initial state -> state after first flush (count: 0->5)
            expect(notificationStates[0]!.prev.count).to.equal(0);
            expect(notificationStates[0]!.next.count).to.equal(5);
            expect(notificationStates[0]!.prev.text).to.equal('hello');
            expect(notificationStates[0]!.next.text).to.equal('hello'); // text unchanged in first flush

            // Second notification: first flushed state -> state after second flush
            // Previous state should be the state from first flush, not the original state
            expect(notificationStates[1]!.prev.count).to.equal(5); // Uses flushed state as previous
            expect(notificationStates[1]!.next.count).to.equal(6);
            expect(notificationStates[1]!.prev.text).to.equal('hello'); // Previous from first flush
            expect(notificationStates[1]!.next.text).to.equal('after first flush');

            // Third notification: second flushed state -> final state
            // Previous state should be the state from second flush
            expect(notificationStates[2]!.prev.count).to.equal(6); // Uses second flushed state as previous
            expect(notificationStates[2]!.next.count).to.equal(6); // No count change in final step
            expect(notificationStates[2]!.prev.text).to.equal('after first flush'); // Previous from second flush
            expect(notificationStates[2]!.next.text).to.equal('final text');
            expect(notificationStates[2]!.prev.nested.value).to.equal(1); // Previous from second flush
            expect(notificationStates[2]!.next.nested.value).to.equal(99);
        });

        it('should handle multiple consecutive flush calls with no changes between them', async () => {
            let callCount = 0;
            const capturedNotifications: Array<{ actions: ActionType[] }> = [];

            store.subscribe((prevState, nextState, actions) => {
                callCount++;
                capturedNotifications.push({ actions: [...actions] });
            });

            // Create an action that makes some changes, flushes, then calls flush multiple times without changes
            const multipleFlushAction = store['action']('MULTIPLE_FLUSH_ACTION', async function () {
                // Make some initial changes
                await store.increment({ amount: 3 });
                await store.setText({ text: 'first change' });

                // First flush - should work normally
                store['flush']();

                // Call flush multiple times with no changes between
                store['flush'](); // Should be ignored (no actions to flush)
                store['flush'](); // Should be ignored (no actions to flush)
                store['flush'](); // Should be ignored (no actions to flush)

                // Make one more change after multiple flushes
                await store.increment({ amount: 2 });
            });

            await multipleFlushAction();

            // Should get exactly 2 notifications:
            // 1. From first flush with the batched changes
            // 2. From final batch completion with the last increment
            expect(callCount).to.equal(2);

            // First notification should be from the first flush
            expect(capturedNotifications[0]!.actions.length).to.equal(3); // MULTIPLE_FLUSH_ACTION, INCREMENT, SET_TEXT
            expect(capturedNotifications[0]!.actions[0]!.type).to.equal('MULTIPLE_FLUSH_ACTION');
            expect(capturedNotifications[0]!.actions[1]!.type).to.equal('INCREMENT');
            expect(capturedNotifications[0]!.actions[2]!.type).to.equal('SET_TEXT');

            // Second notification should be the final batch with FLUSH and INCREMENT
            expect(capturedNotifications[1]!.actions.length).to.equal(2); // FLUSH, INCREMENT
            expect(capturedNotifications[1]!.actions[0]!.type).to.equal('FLUSH');
            expect(capturedNotifications[1]!.actions[1]!.type).to.equal('INCREMENT');

            // Verify final state
            expect(store.state.count).to.equal(5); // 0 + 3 + 2
            expect(store.state.text).to.equal('first change');
        });

        it('should handle flush with state rollback on error', async () => {
            const originalState = store.state;
            let callCount = 0;

            store.subscribe(() => callCount++);

            // Add method to test store that flushes then errors
            const flushThenErrorAction = store['action']('FLUSH_THEN_ERROR', async function () {
                await store.increment({ amount: 5 });
                store['flush'](); // This should notify subscribers
                await store.increment({ amount: 3 });
                throw new Error('Error after flush');
            });

            try {
                await flushThenErrorAction();
                expect.fail('Action should have thrown an error');
            } catch (error) {
                expect((error as Error).message).to.equal('Error after flush');
            }

            // State should be rolled back to original
            expect(store.state).to.equal(originalState);

            // Should have received one notification from the flush
            expect(callCount).to.equal(1);
        });
    });
});
