import PouchDB from 'pouchdb';
import { BaseStore } from './base-store.js';
import type { ActionType, DeepReadonly } from './base-store.js';

export interface PersistentStoreOptions {
    dbName: string;
    syncUrl?: string;
    syncOptions?: PouchDB.Replication.SyncOptions;
    autoSave?: boolean;
}

export type SyncStatus = 'disconnected' | 'connecting' | 'connected' | 'syncing' | 'paused' | 'error';

export interface SyncEvent {
    status: SyncStatus;
    message?: string;
    error?: Error;
    info?: unknown;
}

export type SyncEventCallback = (event: SyncEvent) => void;

export interface PersistedDocument {
    _id: string;
    _rev?: string;
    state: unknown;
    lastUpdated: string;
    actions: Array<{ type: string; timestamp: number }>;
}

/**
 * A persistent store that extends BaseStore with PouchDB integration.
 * Automatically persists state changes to IndexedDB and optionally syncs with a remote CouchDB.
 *
 * @example
 * type MyState = { count: number };
 *
 * class MyStore extends PersistentStore<MyState> {
 *   static id = PersistentStore.uniqueId("MyStore", import.meta.url);
 *
 *   constructor() {
 *     super(
 *       { count: 0 },
 *       {
 *         dbName: 'my-store',
 *         syncUrl: 'http://localhost:5984/my-store'
 *       }
 *     );
 *   }
 *
 *   increment = this.action<{ amount?: number }>('INCREMENT', ({ amount = 1 }) => {
 *     this.state = { ...this.state, count: this.state.count + amount };
 *   });
 * }
 */
export abstract class PersistentStore<T extends object> extends BaseStore<T> {
    private db: PouchDB.Database<PersistedDocument>;
    private syncHandler?: PouchDB.Replication.Sync<PersistedDocument>;
    private storeId: string;
    private options: PersistentStoreOptions;
    private isLoadingFromRemote = false;
    private syncEventListeners = new Set<SyncEventCallback>();
    private currentSyncStatus: SyncStatus = 'disconnected';
    static id: string; // Must be defined in subclasses using BaseStore.uniqueId()
    constructor(initialState: T, options: PersistentStoreOptions) {
        super(initialState);
        this.storeId = (this.constructor as typeof PersistentStore).id;
        if (!this.storeId) {
            throw new Error('PersistentStore subclasses must define a static id using BaseStore.uniqueId()');
        }
        this.options = { autoSave: true, ...options };

        // Initialize PouchDB
        this.db = new PouchDB<PersistedDocument>(options.dbName);

        // Load persisted state first and then set up sync
        void this.initializeStore(options);

        // Subscribe to state changes to persist them (if autoSave is enabled)
        if (this.options.autoSave) {
            this.subscribe((prev, next, actions) => {
                void this.persistState(prev, next, actions);
            });
        }
    }

    private async initializeStore(options: PersistentStoreOptions): Promise<void> {
        await this.loadPersistedState();

        if (options.syncUrl) {
            this.setupSync(options.syncUrl, options.syncOptions);
        }
    }

    /**
     * Load the persisted state from the local database
     */
    private async loadPersistedState(): Promise<void> {
        try {
            const doc = await this.db.get(this.storeId);
            if (doc.state) {
                const prevState = this.state;
                this.state = doc.state as DeepReadonly<T>;

                // Notify subscribers about loaded state
                this.notifySubscribers(prevState, this.state, [
                    {
                        type: 'STATE_LOADED',
                        payload: { source: 'local', timestamp: Date.now() },
                    },
                ]);
            }
        } catch (error: unknown) {
            // Document doesn't exist yet, use initial state
            const pouchError = error as { status?: number };
            if (pouchError.status !== 404) {
                console.error('Error loading persisted state:', error);
            }
        }
    }

    /**
     * Persist the current state to the local database
     */
    private persistState = async (
        prevState: DeepReadonly<T>,
        nextState: DeepReadonly<T>,
        actions: ActionType[],
    ): Promise<void> => {
        // Skip persistence if we're loading from remote to avoid conflicts
        if (this.isLoadingFromRemote) {
            return;
        }

        try {
            let doc: PersistedDocument;

            try {
                doc = await this.db.get(this.storeId);
            } catch (error: unknown) {
                const pouchError = error as { status?: number };
                if (pouchError.status === 404) {
                    doc = {
                        _id: this.storeId,
                        state: nextState,
                        lastUpdated: new Date().toISOString(),
                        actions: [],
                    };
                } else {
                    throw error;
                }
            }

            await this.db.put({
                ...doc,
                state: nextState,
                lastUpdated: new Date().toISOString(),
                actions: actions.map((a) => ({
                    type: a.type,
                    timestamp: Date.now(),
                })),
            });
        } catch (error) {
            console.error('Error persisting state:', error);
        }
    };

    /**
     * Set up bidirectional sync with a remote CouchDB
     */
    private setupSync(remoteUrl: string, options?: PouchDB.Replication.SyncOptions): void {
        const remoteDb = new PouchDB<PersistedDocument>(remoteUrl);

        this.syncHandler = this.db.sync(remoteDb, {
            live: true,
            retry: true,
            ...options,
        });

        void this.syncHandler
            .on('change', (info) => {
                console.log('Sync change:', info);
                this.emitSyncEvent({
                    status: 'syncing',
                    message: `Syncing ${info.direction === 'pull' ? 'from' : 'to'} remote`,
                    info,
                });
                if (info.direction === 'pull' && info.change.docs && info.change.docs.length > 0) {
                    // Handle incoming changes from remote
                    void this.handleRemoteChanges(info.change.docs);
                }
            })
            .on('paused', (err) => {
                if (err) {
                    console.log('Sync paused due to error:', err);
                    this.emitSyncEvent({
                        status: 'error',
                        message: 'Sync paused due to error',
                        error: err instanceof Error ? err : new Error(JSON.stringify(err)),
                    });
                } else {
                    console.log('Sync paused (no changes)');
                    this.emitSyncEvent({
                        status: 'paused',
                        message: 'Sync paused (up to date)',
                    });
                }
            })
            .on('active', () => {
                console.log('Sync resumed');
                this.emitSyncEvent({
                    status: 'syncing',
                    message: 'Sync resumed',
                });
            })
            .on('denied', (err) => {
                console.error('Sync denied:', err);
                this.emitSyncEvent({
                    status: 'error',
                    message: 'Sync denied',
                    error: err instanceof Error ? err : new Error(JSON.stringify(err)),
                });
            })
            .on('complete', (info) => {
                console.log('Sync complete:', info);
                this.emitSyncEvent({
                    status: 'connected',
                    message: 'Sync completed successfully',
                    info,
                });
            })
            .on('error', (error) => {
                console.error('Sync error:', error);
                this.emitSyncEvent({
                    status: 'error',
                    message: 'Sync error occurred',
                    error: error instanceof Error ? error : new Error(JSON.stringify(error)),
                });
            });
    }

    /**
     * Handle incoming changes from remote sync
     */
    private handleRemoteChanges(docs: PersistedDocument[]): void {
        const stateDoc = docs.find((doc) => doc._id === this.storeId);
        if (stateDoc && stateDoc.state) {
            this.isLoadingFromRemote = true;

            try {
                const prevState = this.state;
                this.state = stateDoc.state as DeepReadonly<T>;

                // Notify subscribers about remote changes
                this.notifySubscribers(prevState, this.state, [
                    {
                        type: 'REMOTE_SYNC',
                        payload: {
                            source: 'remote',
                            timestamp: Date.now(),
                            lastUpdated: stateDoc.lastUpdated,
                        },
                    },
                ]);
            } finally {
                this.isLoadingFromRemote = false;
            }
        }
    }

    /**
     * Manually save the current state to the database
     */
    public async saveState(): Promise<void> {
        await this.persistState(this.state, this.state, []);
    }

    /**
     * Get information about the local database
     */
    public async getDbInfo(): Promise<PouchDB.Core.DatabaseInfo> {
        return await this.db.info();
    }

    /**
     * Start syncing with the remote database (if configured)
     */
    public startSync(): void {
        if (this.options.syncUrl && !this.syncHandler) {
            this.emitSyncEvent({ status: 'connecting', message: 'Attempting to connect to remote database' });
            this.setupSync(this.options.syncUrl, this.options.syncOptions);
        }
    }

    /**
     * Stop syncing with the remote database
     */
    public stopSync(): void {
        if (this.syncHandler) {
            this.syncHandler.cancel();
            this.syncHandler = undefined;
            this.emitSyncEvent({ status: 'disconnected', message: 'Disconnected from remote database' });
        }
    }

    /**
     * Check if the store is currently syncing
     */
    public isSyncing(): boolean {
        return !!this.syncHandler;
    }

    /**
     * Get the current sync status
     */
    public getSyncStatus(): SyncStatus {
        return this.currentSyncStatus;
    }

    /**
     * Subscribe to sync events
     */
    public onSyncEvent(callback: SyncEventCallback): () => void {
        this.syncEventListeners.add(callback);
        return () => {
            this.syncEventListeners.delete(callback);
        };
    }

    /**
     * Emit a sync event to all listeners
     */
    private emitSyncEvent(event: SyncEvent): void {
        this.currentSyncStatus = event.status;
        this.syncEventListeners.forEach((callback) => {
            try {
                callback(event);
            } catch (error) {
                console.error('Error in sync event listener:', error);
            }
        });
    }

    /**
     * Compact the local database to reduce storage space
     */
    public async compact(): Promise<void> {
        await this.db.compact();
    }

    /**
     * Destroy the local database and stop all sync operations
     * Warning: This will permanently delete all local data
     */
    public async destroy(): Promise<void> {
        this.stopSync();
        await this.db.destroy();
    }

    /**
     * Export the current state and metadata as JSON
     */
    public async exportData(): Promise<PersistedDocument | null> {
        try {
            return await this.db.get(this.storeId);
        } catch (error: unknown) {
            const pouchError = error as { status?: number };
            if (pouchError.status === 404) {
                return null;
            }
            throw error;
        }
    }

    /**
     * Import state from exported data
     */
    public async importData(data: PersistedDocument): Promise<void> {
        const prevState = this.state;
        this.state = data.state as DeepReadonly<T>;

        await this.db.put({
            ...data,
            _id: this.storeId,
        });

        this.notifySubscribers(prevState, this.state, [
            {
                type: 'STATE_IMPORTED',
                payload: { timestamp: Date.now() },
            },
        ]);
    }
}
