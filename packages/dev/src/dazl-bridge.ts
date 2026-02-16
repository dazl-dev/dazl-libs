/**
 * Dazl Bridge - Communication helpers for iframe to parent editor
 * Provides type-safe postMessage communication between an iframe and the Dazl editor
 */

export interface DazlMessage<T = unknown> {
    type: string;
    payload?: T;
    id?: string;
}

export type MessageHandler<T = unknown> = (payload: T, event: MessageEvent) => void;

/**
 * Send a message to the parent Dazl editor
 * @param type - The message type identifier
 * @param payload - Optional message payload
 * @param targetOrigin - Target origin for postMessage (defaults to '*')
 */
export function editorPost<T = unknown>(type: string, payload?: T, targetOrigin: string = '*'): void {
    if (typeof window === 'undefined' || !window.parent) {
        console.warn('editorPost: No parent window available');
        return;
    }

    const message: DazlMessage<T> = {
        type,
        ...(payload !== undefined && { payload }),
    };

    window.parent.postMessage(message, targetOrigin);
}

/**
 * Listen for messages from the parent Dazl editor
 * @param type - The message type to listen for
 * @param handler - Callback function to handle the message
 * @param options - Optional configuration
 * @returns Cleanup function to remove the event listener
 */
export function onEditor<T = unknown>(
    type: string,
    handler: MessageHandler<T>,
    options?: {
        /** Origin to accept messages from (for security). If not provided, accepts all origins */
        origin?: string;
    },
): () => void {
    if (typeof window === 'undefined') {
        console.warn('onEditor: window is not defined');
        return () => {};
    }

    const listener = (event: MessageEvent) => {
        // Check origin if specified
        if (options?.origin && event.origin !== options.origin) {
            return;
        }

        // Validate message structure
        const message = event.data as DazlMessage<T>;
        if (typeof message !== 'object' || message === null || typeof message.type !== 'string') {
            return;
        }

        // Check if this is the message type we're listening for
        if (message.type === type) {
            handler(message.payload as T, event);
        }
    };

    window.addEventListener('message', listener);

    // Return cleanup function
    return () => {
        window.removeEventListener('message', listener);
    };
}

/**
 * Create a typed communication bridge for specific message types
 * @example
 * ```ts
 * type EditorMessages = {
 *   'code:update': { code: string };
 *   'theme:change': { theme: 'light' | 'dark' };
 * };
 *
 * const bridge = createBridge<EditorMessages>();
 *
 * // Send message
 * bridge.post('code:update', { code: 'console.log("hello")' });
 *
 * // Listen for message
 * const unsubscribe = bridge.on('theme:change', ({ theme }) => {
 *   console.log('Theme changed to:', theme);
 * });
 *
 * // Call and wait for response
 * const result = await bridge.call('getData', { id: 123 });
 * ```
 */
export function createBridge<TMessages extends Record<string, unknown>>(options?: {
    targetOrigin?: string;
    origin?: string;
}) {
    const pendingCalls = new Map<
        string,
        {
            resolve: (value: any) => void;
            reject: (error: Error) => void;
            timeoutId: ReturnType<typeof setTimeout>;
        }
    >();

    // Listen for response messages
    const responseListener = (event: MessageEvent) => {
        if (options?.origin && event.origin !== options.origin) {
            return;
        }

        const message = event.data as DazlMessage;
        if (typeof message !== 'object' || message === null || typeof message.type !== 'string') {
            return;
        }

        // Check if this is a response to a pending call
        if (message.id && pendingCalls.has(message.id)) {
            const pending = pendingCalls.get(message.id)!;
            clearTimeout(pending.timeoutId);
            pendingCalls.delete(message.id);
            pending.resolve(message.payload);
        }
    };

    if (typeof window !== 'undefined') {
        window.addEventListener('message', responseListener);
    }

    return {
        post<K extends keyof TMessages>(type: K, payload: TMessages[K]): void {
            editorPost(type as string, payload, options?.targetOrigin);
        },
        on<K extends keyof TMessages>(type: K, handler: MessageHandler<TMessages[K]>): () => void {
            return onEditor(type as string, handler, { origin: options?.origin });
        },
        /**
         * Call and wait for response with matching ID
         * @param type - The message type identifier
         * @param payload - Message payload
         * @param timeout - Timeout in milliseconds (default: 5000)
         * @returns Promise that resolves with the response payload
         */
        call<K extends keyof TMessages, R = any>(type: K, payload: TMessages[K], timeout: number = 5000): Promise<R> {
            return new Promise((resolve, reject) => {
                const id = `${type as string}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

                const timeoutId = setTimeout(() => {
                    pendingCalls.delete(id);
                    reject(new Error(`Call to ${String(type)} timed out after ${timeout}ms`));
                }, timeout);

                pendingCalls.set(id, { resolve, reject, timeoutId });

                if (typeof window === 'undefined' || !window.parent) {
                    clearTimeout(timeoutId);
                    pendingCalls.delete(id);
                    reject(new Error('No parent window available'));
                    return;
                }

                const message: DazlMessage<TMessages[K]> = {
                    type: type as string,
                    payload,
                    id,
                };

                window.parent.postMessage(message, options?.targetOrigin || '*');
            });
        },
        /**
         * Respond to a call with a matching ID
         * @param id - The message ID to respond to
         * @param payload - Response payload
         */
        respond<T = unknown>(id: string, payload: T): void {
            if (typeof window === 'undefined' || !window.parent) {
                console.warn('respond: No parent window available');
                return;
            }

            const message: DazlMessage<T> = {
                type: '__response__',
                payload,
                id,
            };

            window.parent.postMessage(message, options?.targetOrigin || '*');
        },
        /**
         * Cleanup function to remove all listeners
         */
        destroy(): void {
            if (typeof window !== 'undefined') {
                window.removeEventListener('message', responseListener);
            }
            pendingCalls.forEach(({ timeoutId }) => clearTimeout(timeoutId));
            pendingCalls.clear();
        },
    };
}
