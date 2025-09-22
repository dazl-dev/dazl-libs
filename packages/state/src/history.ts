import type { BaseStore, ActionType, DeepReadonly } from './base-store.ts';

export interface HistoryEntry<T> {
    /** The state snapshot at this point in history */
    state: DeepReadonly<T>;
    /** The actions that led to this state (from the previous state) */
    actions: ActionType[];
    /** Timestamp when this entry was created */
    timestamp: number;
    /** Optional label for this history entry */
    label?: string;
}

export interface HistoryOptions {
    /** Maximum number of history entries to keep (default: 50) */
    maxHistorySize?: number;
    /** Whether to automatically capture state changes (default: true) */
    autoCapture?: boolean;
    /** Function to determine if an action should be captured */
    shouldCapture?: (actions: ActionType[]) => boolean;
}

/**
 * A decoupled history management system for BaseStore instances.
 * Provides undo/redo functionality without modifying the store implementation.
 *
 * The initial state is preserved separately for total reset capability,
 * while history entries track all state changes including the initial state.
 *
 * @example
 * const store = new MyStore();
 * const history = new History(store);
 *
 * // Make some changes
 * store.increment({ amount: 5 });
 * store.setText({ text: "new text" });
 *
 * // Undo the last change
 * history.undo(); // reverts text change
 * history.undo(); // reverts increment
 *
 * // Redo
 * history.redo(); // reapplies increment
 *
 * // Clear history and reset to initial state
 * history.clear(); // back to state when history was created
 */
export class History<T extends object> {
    private readonly store: BaseStore<T>;
    private readonly options: Required<HistoryOptions>;
    private readonly initialState: DeepReadonly<T>;
    private entries: HistoryEntry<T>[] = [];
    private currentIndex = -1;
    private unsubscribe: (() => void) | undefined = undefined;
    private isApplyingHistory = false;

    constructor(store: BaseStore<T>, options: HistoryOptions = {}) {
        this.store = store;
        this.options = {
            maxHistorySize: options.maxHistorySize ?? 50,
            autoCapture: options.autoCapture ?? true,
            shouldCapture: options.shouldCapture ?? (() => true),
        };

        // Store the initial state separately for total reset capability
        this.initialState = this.store.getSnapshot();

        // Capture initial state in history using the stored initial state
        this.captureInitialState();

        // Subscribe to store changes if auto-capture is enabled
        if (this.options.autoCapture) {
            this.startAutoCapture();
        }
    }

    /**
     * Manually capture the current state
     */
    capture(label?: string): void {
        this.captureState([], label);
    }

    /**
     * Check if undo is possible
     */
    canUndo(): boolean {
        return this.currentIndex > 0;
    }

    /**
     * Check if redo is possible
     */
    canRedo(): boolean {
        return this.currentIndex < this.entries.length - 1;
    }

    /**
     * Undo to the previous state
     * @returns true if undo was performed, false if not possible
     */
    undo(): boolean {
        if (!this.canUndo()) {
            return false;
        }

        this.currentIndex--;
        const entry = this.entries[this.currentIndex];
        if (entry) {
            this.applyHistoryEntry(entry);
        }
        return true;
    }

    /**
     * Redo to the next state
     * @returns true if redo was performed, false if not possible
     */
    redo(): boolean {
        if (!this.canRedo()) {
            return false;
        }

        this.currentIndex++;
        const entry = this.entries[this.currentIndex];
        if (entry) {
            this.applyHistoryEntry(entry);
        }
        return true;
    }

    /**
     * Get the current history entry
     */
    getCurrentEntry(): HistoryEntry<T> | undefined {
        return this.entries[this.currentIndex];
    }

    /**
     * Get the initial state (when history was created)
     */
    getInitialState(): DeepReadonly<T> {
        return this.initialState;
    }

    /**
     * Get all history entries
     */
    getHistory(): ReadonlyArray<HistoryEntry<T>> {
        return [...this.entries];
    }

    /**
     * Get the current position in history
     */
    getCurrentIndex(): number {
        return this.currentIndex;
    }

    /**
     * Clear all history and reset to initial state
     */
    clear(): void {
        this.entries = [];
        this.currentIndex = -1;
        // Reset to the original initial state
        this.isApplyingHistory = true;
        try {
            this.store.restoreFromHistory(this.initialState);
        } finally {
            this.isApplyingHistory = false;
        }
        // Re-initialize history with the initial state
        this.captureInitialState();
    }

    /**
     * Jump to a specific point in history
     * @param index The history index to jump to
     * @returns true if jump was performed, false if index is invalid
     */
    jumpTo(index: number): boolean {
        if (index < 0 || index >= this.entries.length) {
            return false;
        }

        this.currentIndex = index;
        const entry = this.entries[index];
        if (entry) {
            this.applyHistoryEntry(entry);
        }
        return true;
    }

    /**
     * Start auto-capturing state changes
     */
    startAutoCapture(): void {
        if (this.unsubscribe) {
            return; // Already started
        }

        this.unsubscribe = this.store.subscribe(
            (prevState: DeepReadonly<T>, nextState: DeepReadonly<T>, actions: ActionType[]) => {
                // Skip if we're applying history (to avoid infinite loops)
                if (this.isApplyingHistory) {
                    return;
                }

                // Check if should capture
                if (!this.options.shouldCapture(actions)) {
                    return;
                }

                this.captureState(actions);
            },
        );
    }

    /**
     * Stop auto-capturing state changes
     */
    stopAutoCapture(): void {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = undefined;
        }
    }

    /**
     * Dispose of the history manager and clean up resources
     */
    dispose(): void {
        this.stopAutoCapture();
        this.entries = [];
        this.currentIndex = -1;
    }

    private captureInitialState(): void {
        const timestamp = Date.now();

        const entry: HistoryEntry<T> = {
            state: this.initialState,
            actions: [],
            timestamp,
            label: 'HISTORY_INITIAL_STATE',
        };

        // Add initial entry
        this.entries.push(entry);
        this.currentIndex = 0;
    }

    private captureState(actions: ActionType[], label?: string): void {
        const state = this.store.getSnapshot();
        const timestamp = Date.now();

        const entry: HistoryEntry<T> = {
            state,
            actions,
            timestamp,
            label,
        };

        // If we're not at the end of history, remove all entries after current index
        if (this.currentIndex < this.entries.length - 1) {
            this.entries = this.entries.slice(0, this.currentIndex + 1);
        }

        // Add new entry
        this.entries.push(entry);
        this.currentIndex = this.entries.length - 1;

        // Enforce max history size
        if (this.entries.length > this.options.maxHistorySize) {
            const excess = this.entries.length - this.options.maxHistorySize;
            this.entries = this.entries.slice(excess);
            this.currentIndex -= excess;
        }
    }

    private applyHistoryEntry(entry: HistoryEntry<T>): void {
        this.isApplyingHistory = true;
        try {
            // Use the store's restoration method
            this.store.restoreFromHistory(entry.state);
        } finally {
            this.isApplyingHistory = false;
        }
    }
}
