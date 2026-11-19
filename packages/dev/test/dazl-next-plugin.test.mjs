import assert from 'node:assert/strict';
import console from 'node:console';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import process from 'node:process';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { withDazl } from '@dazl/dev/next';

const developmentPhase = 'phase-development-server';
const productionPhase = 'phase-production-build';

async function withPluginSpecifier(specifier, run) {
    const previous = process.env.DAZL_NEXT_PLUGIN_SPECIFIER;
    if (specifier === undefined) {
        delete process.env.DAZL_NEXT_PLUGIN_SPECIFIER;
    } else {
        process.env.DAZL_NEXT_PLUGIN_SPECIFIER = specifier;
    }

    try {
        await run();
    } finally {
        if (previous === undefined) {
            delete process.env.DAZL_NEXT_PLUGIN_SPECIFIER;
        } else {
            process.env.DAZL_NEXT_PLUGIN_SPECIFIER = previous;
        }
    }
}

async function createPlugin(t, source) {
    const directory = await mkdtemp(join(tmpdir(), 'dazl-next-plugin-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const path = join(directory, 'plugin.mjs');
    await writeFile(path, source);
    return pathToFileURL(path).href;
}

test('@dazl/dev/next resolves from the built package', () => {
    assert.match(import.meta.resolve('@dazl/dev/next'), /\/dist\/dazl-next-plugin\.js$/);
    assert.equal(typeof withDazl, 'function');
});

test('without a plugin specifier, object and function configs retain identity', async () => {
    await withPluginSpecifier(undefined, () => {
        const objectConfig = { reactStrictMode: true };
        const functionConfig = async () => objectConfig;
        assert.strictEqual(withDazl(objectConfig), objectConfig);
        assert.strictEqual(withDazl(functionConfig), functionConfig);
    });
});

test('development passes an object config and phase to the plugin', async (t) => {
    const specifier = await createPlugin(
        t,
        'export function dazlNextConfig(config, { phase }) { return { config, phase }; }',
    );
    await withPluginSpecifier(specifier, async () => {
        const config = { reactStrictMode: true };
        const result = await withDazl(config)(developmentPhase, { defaultConfig: {} });
        assert.strictEqual(result.config, config);
        assert.equal(result.phase, developmentPhase);
    });
});

test('development resolves an async config before passing it to the plugin', async (t) => {
    const specifier = await createPlugin(
        t,
        'export function dazlNextConfig(config, { phase }) { return { config, phase }; }',
    );
    await withPluginSpecifier(specifier, async () => {
        const config = { reactStrictMode: true };
        const context = { defaultConfig: {} };
        const calls = [];
        const wrapped = withDazl(async (phase, receivedContext) => {
            calls.push([phase, receivedContext]);
            return config;
        });
        const result = await wrapped(developmentPhase, context);
        assert.deepEqual(calls, [[developmentPhase, context]]);
        assert.strictEqual(result.config, config);
        assert.equal(result.phase, developmentPhase);
    });
});

test('non-development phases bypass the plugin', async (t) => {
    const specifier = await createPlugin(
        t,
        'export function dazlNextConfig() { return { instrumented: true }; }',
    );
    await withPluginSpecifier(specifier, async () => {
        const config = { reactStrictMode: true };
        const context = { defaultConfig: {} };
        assert.strictEqual(await withDazl(config)(productionPhase, context), config);
        const wrapped = withDazl(async () => config);
        assert.strictEqual(await wrapped(productionPhase, context), config);
    });
});

test('a rejected plugin import returns the resolved config', async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'dazl-next-plugin-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    t.mock.method(console, 'warn', () => {});
    await withPluginSpecifier(pathToFileURL(join(directory, 'missing.mjs')).href, async () => {
        const config = { reactStrictMode: true };
        assert.strictEqual(await withDazl(config)(developmentPhase, { defaultConfig: {} }), config);
    });
    assert.equal(console.warn.mock.callCount(), 1);
});

test('a rejected plugin invocation returns the resolved config', async (t) => {
    const specifier = await createPlugin(
        t,
        'export async function dazlNextConfig() { throw new Error("plugin failed"); }',
    );
    t.mock.method(console, 'warn', () => {});
    await withPluginSpecifier(specifier, async () => {
        const config = { reactStrictMode: true };
        const wrapped = withDazl(async () => config);
        assert.strictEqual(await wrapped(developmentPhase, { defaultConfig: {} }), config);
    });
    assert.equal(console.warn.mock.callCount(), 1);
});
