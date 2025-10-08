// Import the store classes from the library
import { PersistentStore } from '../src/persistent-store.ts';

// Constants
const DB_NAME = 'counter-playground';
const DEFAULT_SYNC_URL = 'http://admin:admin@localhost:5984/counter-playground';
const COUCHDB_ADMIN_URL = 'http://localhost:5984/_utils/';

// Types
type LogType = 'info' | 'error' | 'sync';

interface DbInfo {
    db_name: string;
    doc_count: number;
    update_seq: number;
    sizes?: {
        file?: number;
        external?: number;
    };
}

// Helper function for type-safe element selection
function getById<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`Element with id '${id}' not found`);
    }
    return element as T;
}

// Helper function for consistent error handling
function handleError(error: unknown, context: string): string {
    const message = error instanceof Error ? error.message : String(error);
    return `${context}: ${message}`;
}

// DOM Elements - will be queried after DOM is ready
const elements = initializeDOM();

// Initialize DOM elements and event listeners
function initializeDOM() {
    const elements = {
        // State display
        stateDisplay: getById<HTMLElement>('stateDisplay'),
        // Connection status
        connectionStatus: getById<HTMLElement>('connectionStatus'),
        connectionText: getById<HTMLElement>('connectionText'),
        // Database info
        dbInfo: getById<HTMLElement>('dbInfo'),
        dbDetails: getById<HTMLElement>('dbDetails'),
        // Activity log
        activityLog: getById<HTMLElement>('activityLog'),
        // Input fields
        syncUrlInput: getById<HTMLInputElement>('syncUrlInput'),
        amountInput: getById<HTMLInputElement>('amountInput'),
        // Buttons
        connectBtn: getById<HTMLButtonElement>('connectBtn'),
        disconnectBtn: getById<HTMLButtonElement>('disconnectBtn'),
        incrementBtn: getById<HTMLButtonElement>('incrementBtn'),
        decrementBtn: getById<HTMLButtonElement>('decrementBtn'),
        incrementByBtn: getById<HTMLButtonElement>('incrementByBtn'),
        resetBtn: getById<HTMLButtonElement>('resetBtn'),
        saveStateBtn: getById<HTMLButtonElement>('saveStateBtn'),
        exportDataBtn: getById<HTMLButtonElement>('exportDataBtn'),
        clearLocalDataBtn: getById<HTMLButtonElement>('clearLocalDataBtn'),
        compactDbBtn: getById<HTMLButtonElement>('compactDbBtn'),
        refreshDbInfoBtn: getById<HTMLButtonElement>('refreshDbInfoBtn'),
        openCouchDBAdminBtn: getById<HTMLButtonElement>('openCouchDBAdminBtn'),
        setLocalOnlyBtn: getById<HTMLButtonElement>('setLocalOnlyBtn'),
        clearLogBtn: getById<HTMLButtonElement>('clearLogBtn'),
    } as const;

    // Set up event listeners
    elements.incrementBtn.onclick = () => void increment();
    elements.decrementBtn.onclick = () => void decrement();
    elements.incrementByBtn.onclick = () => void incrementBy();
    elements.resetBtn.onclick = () => void reset();
    elements.saveStateBtn.onclick = () => void saveState();
    elements.connectBtn.onclick = () => void connect();
    elements.disconnectBtn.onclick = disconnect;
    elements.exportDataBtn.onclick = () => void exportData();
    elements.clearLocalDataBtn.onclick = () => void clearLocalData();
    elements.compactDbBtn.onclick = () => void compactDb();
    elements.refreshDbInfoBtn.onclick = () => void refreshDbInfo();
    elements.openCouchDBAdminBtn.onclick = openCouchDBAdmin;
    elements.setLocalOnlyBtn.onclick = setLocalOnly;
    elements.clearLogBtn.onclick = clearLog;
    return elements;
}

interface CounterStoreState {
    count: number;
    lastAction: string;
    timestamp: number;
}

// Counter Store implementation using the library
class CounterStore extends PersistentStore<CounterStoreState> {
    static id = PersistentStore.uniqueId('CounterStore', import.meta.url);
    constructor(syncUrl: string) {
        super(
            {
                count: 0,
                lastAction: 'init',
                timestamp: Date.now(),
            },
            {
                dbName: DB_NAME,
                syncUrl,
                autoSave: true,
            },
        );
    }

    private updateState(updates: Partial<CounterStoreState>): void {
        this.state = {
            ...this.state,
            ...updates,
            timestamp: Date.now(),
        };
    }

    increment = this.action<{ amount: number }>('INCREMENT', ({ amount = 1 }) => {
        this.updateState({
            count: this.state.count + amount,
            lastAction: `increment by ${amount}`,
        });
    });

    decrement = this.action<{ amount: number }>('DECREMENT', ({ amount = 1 }) => {
        this.updateState({
            count: this.state.count - amount,
            lastAction: `decrement by ${amount}`,
        });
    });

    reset = this.action('RESET', () => {
        this.updateState({
            count: 0,
            lastAction: 'reset',
        });
    });
}

// Global variables
let store: CounterStore;

// Sync event handler
function handleSyncEvent(event: Parameters<Parameters<CounterStore['onSyncEvent']>[0]>[0]) {
    // Only update connection status if we're actually syncing or if it's an error
    if (store.isSyncing() || event.status === 'error' || event.status === 'disconnected') {
        updateConnectionStatus(event.status);
    }

    if (event.message) {
        const logType: LogType =
            event.status === 'error'
                ? 'error'
                : event.status === 'connected' || event.status === 'syncing'
                  ? 'sync'
                  : 'info';
        // Only log important state changes to avoid duplication with console logs
        if (event.status === 'error' || event.status === 'connected' || event.status === 'disconnected') {
            log(event.message, logType);
        }
    }

    if (event.info && event.status === 'connected') {
        // Only log sync info for successful connections, not every sync cycle
        log(`Sync info: ${JSON.stringify(event.info, null, 2)}`, 'info');
    }

    if (event.error) {
        log(`Error details: ${event.error.message}`, 'error');
    }
}

// Initialize store
async function initStore() {
    // Initialize DOM elements and event listeners first
    initializeDOM();

    store = new CounterStore('');

    // Subscribe to state changes
    store.subscribe((prev, next, actions) => {
        updateStateDisplay();
        log(`State changed: ${actions.map((a) => a.type).join(', ')}`, 'info');
        void refreshDbInfo();
    });

    // Subscribe to sync events
    store.onSyncEvent(handleSyncEvent);

    // Set default sync URL if empty
    if (!elements.syncUrlInput.value) {
        elements.syncUrlInput.value = DEFAULT_SYNC_URL;
    }

    updateStateDisplay();
    updateConnectionStatus('disconnected');
    await refreshDbInfo();
}

// UI update functions
function updateStateDisplay() {
    if (!store) return;

    const state = store.getSnapshot();
    elements.stateDisplay.textContent = JSON.stringify(state, null, 2);
}

function updateConnectionStatus(status: string) {
    elements.connectionStatus.className = 'status-dot';

    switch (status) {
        case 'connected':
            elements.connectionStatus.classList.add('connected');
            elements.connectionText.textContent = 'Connected & Synced';
            elements.connectBtn.disabled = true;
            elements.disconnectBtn.disabled = false;
            break;
        case 'connecting':
        case 'syncing':
            elements.connectionStatus.classList.add('syncing');
            elements.connectionText.textContent = status === 'connecting' ? 'Connecting...' : 'Syncing...';
            elements.connectBtn.disabled = true;
            elements.disconnectBtn.disabled = false;
            break;
        case 'paused':
            elements.connectionStatus.classList.add('connected');
            elements.connectionText.textContent = 'Connected (Paused)';
            elements.connectBtn.disabled = true;
            elements.disconnectBtn.disabled = false;
            break;
        case 'error':
            elements.connectionText.textContent = 'Connection Error';
            elements.connectBtn.disabled = false;
            elements.disconnectBtn.disabled = false;
            break;
        case 'disconnected':
        default:
            elements.connectionText.textContent = 'Disconnected';
            elements.connectBtn.disabled = false;
            elements.disconnectBtn.disabled = true;
    }
}

async function refreshDbInfo() {
    if (!store) return;

    try {
        const info = (await store.getDbInfo()) as DbInfo;
        getById<HTMLElement>('dbInfo').textContent = `Local DB: ${info.doc_count} docs, ${info.update_seq} updates`;

        const sizes = info.sizes;
        const details = `
Database Name: ${info.db_name}
Document Count: ${info.doc_count}
Update Sequence: ${info.update_seq}
Disk Size: ${sizes?.file || 0} bytes
Data Size: ${sizes?.external || 0} bytes
                `.trim();

        getById<HTMLElement>('dbDetails').textContent = details;
    } catch (error) {
        log(handleError(error, 'Error getting DB info'), 'error');
    }
}

function log(message: string, type: LogType = 'info') {
    const logElement = getById<HTMLElement>('activityLog');
    const timestamp = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${timestamp}] ${message}`;

    logElement.appendChild(entry);
    logElement.scrollTop = logElement.scrollHeight;
}

// Action functions
async function increment() {
    if (!store) return;
    await store.increment({ amount: 1 });
}

async function decrement() {
    if (!store) return;
    await store.decrement({ amount: 1 });
}

async function incrementBy() {
    if (!store) return;
    const amount = parseInt(elements.amountInput.value) || 1;
    await store.increment({ amount });
}

async function reset() {
    if (!store) return;
    await store.reset();
}

async function saveState() {
    if (!store) return;
    await store.saveState();
    log('State saved manually', 'info');
}

function sanitizeUrlForLogging(url: string): string {
    return url.replace(/:\/\/[^@]*@/, '://***:***@');
}

function validateSyncUrl(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

async function connect() {
    if (!store) return;

    const syncUrl = elements.syncUrlInput.value.trim();
    if (!syncUrl) {
        log('Please enter a sync URL', 'error');
        return;
    }

    if (!validateSyncUrl(syncUrl)) {
        log('Invalid URL format. Example: http://admin:admin@localhost:5984/dbname', 'error');
        return;
    }

    const urlForLog = sanitizeUrlForLogging(syncUrl);

    try {
        // Stop any existing sync first
        if (store.isSyncing()) {
            log('Stopping existing sync connection...', 'info');
            store.stopSync();
        }

        // Set the new sync URL by accessing options (temporary workaround for private property)
        (store as unknown as { options: { syncUrl?: string } }).options.syncUrl = syncUrl;
        store.startSync();
        log(`Starting sync with ${urlForLog}...`, 'info');

        // Give some time for the sync to initialize
        await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
        log(handleError(error, 'Failed to start sync'), 'error');
    }
}

function disconnect() {
    if (!store) return;
    store.stopSync();
    updateConnectionStatus('disconnected');
}

function downloadJson(data: unknown, filename: string): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

async function exportData() {
    if (!store) return;

    try {
        const data = await store.exportData();
        if (data) {
            downloadJson(data, 'counter-store-export.json');
            log('Data exported successfully', 'info');
        } else {
            log('No data to export', 'info');
        }
    } catch (error) {
        log(handleError(error, 'Export failed'), 'error');
    }
}

async function clearLocalData() {
    if (!store || !confirm('This will permanently delete all local data. Continue?')) return;

    try {
        await store.destroy();
        // Reinitialize
        await initStore();
        log('Local data cleared and store reinitialized', 'info');
    } catch (error) {
        log(handleError(error, 'Clear failed'), 'error');
    }
}

async function compactDb() {
    if (!store) return;

    try {
        await store.compact();
        await refreshDbInfo();
        log('Database compacted successfully', 'info');
    } catch (error) {
        log(handleError(error, 'Compact failed'), 'error');
    }
}

function openCouchDBAdmin() {
    window.open(COUCHDB_ADMIN_URL, '_blank');
}

function setLocalOnly() {
    if (!store) return;

    store.stopSync();
    (store as unknown as { options: { syncUrl?: string } }).options.syncUrl = undefined;
    elements.syncUrlInput.value = '';
    log('Switched to local-only mode', 'info');
}

function clearLog() {
    elements.activityLog.innerHTML = '';
}

// Initialize the playground
async function initializePlayground(): Promise<void> {
    log('Initializing Persistent Store Playground...', 'info');
    try {
        await initStore();
        log('Playground initialized successfully!', 'info');
    } catch (error) {
        log(handleError(error, 'Initialization failed'), 'error');
    }
}

// Start the playground
void initializePlayground();
