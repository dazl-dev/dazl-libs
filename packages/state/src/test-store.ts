import { BaseStore } from './base-store.ts';

export type TestStoreState = {
    count: number;
    text: string;
    nested: {
        value: number;
    };
};
// Test implementation of BaseStore
export class TestStore extends BaseStore<TestStoreState> {
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
