import { expect } from 'chai';
import { BaseStore } from './base-store.ts';
import { History } from './history.ts';
import { TestStore, type TestStoreState } from './test-store.ts';

describe('History', () => {
    let store: TestStore;
    let history: History<TestStoreState>;

    beforeEach(() => {
        store = new TestStore();
        history = new History(store);
    });

    afterEach(() => {
        history.dispose();
    });

    describe('Basic functionality', () => {
        it('should capture initial state', () => {
            const currentEntry = history.getCurrentEntry();
            expect(currentEntry).to.not.equal(undefined);
            expect(currentEntry!.state).to.deep.equal({ count: 0, text: 'hello', nested: { value: 1 } });
            expect(currentEntry!.label).to.equal('HISTORY_INITIAL_STATE');
        });

        it('should capture state changes automatically', async () => {
            await store.increment({ amount: 5 });

            const historyEntries = history.getHistory();
            expect(historyEntries).to.have.length(2); // initial + increment

            const lastEntry = historyEntries[historyEntries.length - 1];
            expect(lastEntry).to.not.equal(undefined);
            expect(lastEntry!.state.count).to.equal(5);
            expect(lastEntry!.actions).to.have.length(1);
            expect(lastEntry!.actions[0]!.type).to.equal('INCREMENT');
        });

        it('should support undo operation', async () => {
            const initialState = store.getSnapshot();

            await store.increment({ amount: 3 });
            expect(store.getSnapshot().count).to.equal(3);

            const undoResult = history.undo();
            expect(undoResult).to.equal(true);
            expect(store.getSnapshot()).to.deep.equal(initialState);
        });

        it('should support redo operation', async () => {
            await store.increment({ amount: 3 });
            const afterIncrement = store.getSnapshot();

            history.undo(); // Go back to initial

            const redoResult = history.redo();
            expect(redoResult).to.equal(true);
            expect(store.getSnapshot()).to.deep.equal(afterIncrement);
        });

        it('should indicate when undo/redo is not possible', () => {
            // Initially, should not be able to undo
            expect(history.canUndo()).to.equal(false);
            expect(history.canRedo()).to.equal(false);
            expect(history.undo()).to.equal(false);
            expect(history.redo()).to.equal(false);
        });
    });

    describe('Multiple state changes', () => {
        it('should handle multiple consecutive changes', async () => {
            await store.increment({ amount: 1 });
            await store.setText({ text: 'world' });
            await store.setNested({ value: 42 });

            const historyEntries = history.getHistory();
            expect(historyEntries).to.have.length(4); // initial + 3 changes

            // Undo twice
            history.undo(); // undo nested change
            history.undo(); // undo text change

            const currentState = store.getSnapshot();
            expect(currentState.count).to.equal(1);
            expect(currentState.text).to.equal('hello');
            expect(currentState.nested.value).to.equal(1);
        });

        it('should handle undo/redo chains correctly', async () => {
            await store.increment({ amount: 1 });
            await store.increment({ amount: 2 });
            await store.increment({ amount: 3 });

            expect(store.getSnapshot().count).to.equal(6);

            // Undo all changes
            history.undo(); // count: 3
            history.undo(); // count: 1
            history.undo(); // count: 0

            expect(store.getSnapshot().count).to.equal(0);
            expect(history.canUndo()).to.equal(false);

            // Redo all changes
            history.redo(); // count: 1
            history.redo(); // count: 3
            history.redo(); // count: 6

            expect(store.getSnapshot().count).to.equal(6);
            expect(history.canRedo()).to.equal(false);
        });
    });

    describe('History branching', () => {
        it('should create new branch when making changes after undo', async () => {
            await store.increment({ amount: 5 });
            await store.setText({ text: 'branch' });

            // Undo once and make a different change
            history.undo(); // back to count: 5, text: 'hello'
            await store.setText({ text: 'different' });

            // Should not be able to redo the original branch
            expect(history.canRedo()).to.equal(false);

            const historyEntries = history.getHistory();
            const lastEntry = historyEntries[historyEntries.length - 1];
            expect(lastEntry!.state.text).to.equal('different');
        });
    });

    describe('Configuration options', () => {
        it('should respect maxHistorySize option', async () => {
            const smallHistory = new History(store, { maxHistorySize: 3 });

            // Make more changes than the limit
            await store.increment({ amount: 1 });
            await store.increment({ amount: 2 });
            await store.increment({ amount: 3 });
            await store.increment({ amount: 4 });

            const historyEntries = smallHistory.getHistory();
            expect(historyEntries.length).to.be.at.most(3);

            smallHistory.dispose();
        });

        it('should support disabling auto-capture', async () => {
            const manualHistory = new History(store, { autoCapture: false });

            await store.increment({ amount: 5 });

            // Should not have captured the change automatically
            const historyEntries = manualHistory.getHistory();
            expect(historyEntries).to.have.length(1); // only initial state

            // But manual capture should work
            manualHistory.capture('Manual capture');
            const updatedEntries = manualHistory.getHistory();
            expect(updatedEntries).to.have.length(2);
            expect(updatedEntries[1]!.state.count).to.equal(5);
            expect(updatedEntries[1]!.label).to.equal('Manual capture');

            manualHistory.dispose();
        });

        it('should support custom shouldCapture filter', async () => {
            const selectiveHistory = new History(store, {
                shouldCapture: (actions) => actions.some((action) => action.type !== 'SET_TEXT'),
            });

            await store.increment({ amount: 1 }); // should capture
            await store.setText({ text: 'ignored' }); // should not capture
            await store.setNested({ value: 99 }); // should capture

            const historyEntries = selectiveHistory.getHistory();
            expect(historyEntries).to.have.length(3); // initial + increment + setNested

            const lastEntry = historyEntries[historyEntries.length - 1];
            expect(lastEntry!.state.nested.value).to.equal(99);
            expect(lastEntry!.state.text).to.equal('ignored'); // text change was applied but not separately captured

            selectiveHistory.dispose();
        });
    });

    describe('Jump to specific history point', () => {
        it('should jump to any point in history', async () => {
            await store.increment({ amount: 1 }); // index 1
            await store.increment({ amount: 2 }); // index 2
            await store.increment({ amount: 3 }); // index 3

            const jumpResult = history.jumpTo(1);
            expect(jumpResult).to.equal(true);
            expect(store.getSnapshot().count).to.equal(1);
            expect(history.getCurrentIndex()).to.equal(1);

            // Should be able to redo from here
            expect(history.canRedo()).to.equal(true);
        });

        it('should reject invalid jump indices', async () => {
            await store.increment({ amount: 1 });

            expect(history.jumpTo(-1)).to.equal(false);
            expect(history.jumpTo(999)).to.equal(false);
            expect(store.getSnapshot().count).to.equal(1); // state unchanged
        });
    });

    describe('History manipulation', () => {
        it('should clear history and reset', async () => {
            await store.increment({ amount: 5 });
            await store.setText({ text: 'test' });

            history.clear();

            const historyEntries = history.getHistory();
            expect(historyEntries).to.have.length(1); // only current state
            expect(history.canUndo()).to.equal(false);
            expect(historyEntries[0]!.label).to.equal('HISTORY_INITIAL_STATE');
        });
    });

    describe('Async actions', () => {
        it('should handle async actions correctly', async () => {
            await store.increment({ amount: 10 });

            expect(store.getSnapshot().count).to.equal(10);

            const undoResult = history.undo();
            expect(undoResult).to.equal(true);
            expect(store.getSnapshot().count).to.equal(0);
        });
    });

    describe('Error scenarios', () => {
        it('should not break when store actions fail', async () => {
            // Create a store with a failing action
            class FailingStore extends BaseStore<TestStoreState> {
                static id = FailingStore.uniqueId('FailingStore', import.meta.url);

                constructor() {
                    super({ count: 0, text: 'hello', nested: { value: 1 } });
                }

                failingAction = this.action('FAILING_ACTION', () => {
                    this.state = { ...this.state, count: this.state.count + 1 };
                    throw new Error('Action failed');
                });
            }

            const failingStore = new FailingStore();
            const failingHistory = new History(failingStore);

            try {
                await failingStore.failingAction();
                expect.fail('Action should have thrown an error');
            } catch (error) {
                expect((error as Error).message).to.equal('Action failed');
            }

            // History should not be corrupted
            expect(failingStore.getSnapshot().count).to.equal(0); // state should be reverted
            expect(failingHistory.canUndo()).to.equal(false); // no change should be captured

            failingHistory.dispose();
        });
    });

    describe('Resource cleanup', () => {
        it('should clean up resources on dispose', () => {
            const cleanupHistory = new History(store);

            cleanupHistory.dispose();

            // After dispose, history should be empty and non-functional
            const historyEntries = cleanupHistory.getHistory();
            expect(historyEntries).to.have.length(0);
        });

        it('should stop auto-capture when stopped', async () => {
            history.stopAutoCapture();

            await store.increment({ amount: 5 });

            // Should not capture since auto-capture is stopped
            const historyEntries = history.getHistory();
            expect(historyEntries).to.have.length(1); // only initial state

            // Can restart auto-capture
            history.startAutoCapture();
            await store.increment({ amount: 3 });

            const updatedEntries = history.getHistory();
            expect(updatedEntries).to.have.length(2); // initial + latest increment
        });

        it('should return initial state', () => {
            const initialState = history.getInitialState();
            expect(initialState).to.deep.equal({ count: 0, text: 'hello', nested: { value: 1 } });
        });

        it('should handle multiple startAutoCapture calls gracefully', async () => {
            history.stopAutoCapture(); // Stop first
            history.startAutoCapture(); // Start again
            history.startAutoCapture(); // This should hit the early return path

            // Verify it still works normally after multiple startAutoCapture calls
            await store.increment({ amount: 1 });
            const historyEntries = history.getHistory();
            expect(historyEntries).to.have.length(2); // initial + one change
        });
    });
});
