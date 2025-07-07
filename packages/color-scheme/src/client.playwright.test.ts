import { test, expect, type Page } from '@playwright/test';
import type { ColorSchemeConfig, ColorSchemeResolve, CurrentState } from './types';
import { join } from 'node:path';
import { mkdtemp, copyFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

async function setupTestPage(page: Page, systemColorScheme: ColorSchemeResolve) {
    // Set the color scheme preference before navigating
    await page.emulateMedia({ colorScheme: systemColorScheme });

    // Create a temporary directory and copy setup test files there
    const tempDir = await mkdtemp(join(tmpdir(), 'color-scheme-test-'));
    const clientJsPath = join(import.meta.dirname, '../dist/client.js');
    await copyFile(clientJsPath, join(tempDir, 'client.js'));
    await writeFile(
        join(tempDir, 'test.html'),
        `
  <!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Color Scheme Test</title>
    <script
      src="./client.js"
    ></script>
  </head>
  <body>
    <h1>Color Scheme Test Page</h1>
    <div id="content">
      <p>This page tests the color scheme functionality.</p>
      <div id="config"></div>
      <div id="resolved"></div>
      <div id="resolved-system"></div>
      <h3>subscription calls</h3>
      <div id="subscription-calls"></div>
    </div>
    <script>
      // Helper function to update display
      function updateDisplay() {
        const api = window.colorSchemeApi;
        document.getElementById('config').textContent = \`Config: \${api.config}\`;
        document.getElementById(
          'resolved'
        ).textContent = \`Resolved: \${api.currentState.resolved}\`;
        document.getElementById(
          'resolved-system'
        ).textContent = \`System: \${api.resolvedSystem}\`;
      }

      // Initial display update
      updateDisplay();

      // Subscribe to changes
      window.colorSchemeApi.subscribe((state) => {
        document.getElementById(
          'subscription-calls'
        ).textContent += \`\n\${JSON.stringify(state)}\`;
        updateDisplay();
      });
    </script>
  </body>
</html>
  `,
    );

    // Navigate to the test page
    await page.goto(`file://${join(tempDir, 'test.html')}`);

    // Wait for the page to load and API to be available
    await page.waitForFunction(() => window.colorSchemeApi);

    return {
        async getColorSchemeState() {
            return await page.evaluate(() => {
                return {
                    ...window.colorSchemeApi.currentState,
                    resolvedSystem: window.colorSchemeApi.resolvedSystem,
                    rootCssClass: document.documentElement.classList.value,
                    rootColorScheme: document.documentElement.style.colorScheme,
                };
            });
        },
        async setConfig(config: ColorSchemeConfig): Promise<void> {
            await page.evaluate((config: ColorSchemeConfig) => (window.colorSchemeApi.config = config), config);
        },
        async setSystemColorScheme(scheme: ColorSchemeResolve): Promise<void> {
            await page.emulateMedia({ colorScheme: scheme });
        },
        async waitForStateChange(action: () => Promise<void>): Promise<CurrentState> {
            // Subscribe to changes and wait for update
            const statePromise = page.evaluate(() => {
                return new Promise<CurrentState>((resolve) => {
                    const unsubscribe = window.colorSchemeApi.subscribe((state) => {
                        unsubscribe();
                        resolve(state);
                    });
                });
            });

            await action();
            return await statePromise;
        },
        async getSubscriptionCalls(): Promise<CurrentState[]> {
            return await page.evaluate(() => {
                const callsLogElement = document.getElementById('subscription-calls')!;
                const callsText = callsLogElement.textContent;
                callsLogElement.textContent = ''; // Clear the log after reading
                const calls = callsText
                    ? callsText
                          .split('\n')
                          .filter(Boolean)
                          .map((line) => JSON.parse(line) as CurrentState)
                    : [];
                return calls;
            });
        },
        async expectState({
            label,
            ...expected
        }: {
            config: ColorSchemeConfig;
            resolved: ColorSchemeResolve;
            resolvedSystem: ColorSchemeResolve;
            rootCssClass: string;
            rootColorScheme: ColorSchemeResolve;
            label?: string;
        }) {
            const labelPrefix = label ? `(${label}) ` : '';

            const actual = await this.getColorSchemeState();

            expect(actual.config, `${labelPrefix}API current config`).toEqual(expected.config);
            expect(actual.resolved, `${labelPrefix}API current resolved`).toEqual(expected.resolved);

            expect(actual.resolvedSystem, `${labelPrefix}resolved system color scheme`).toBe(expected.resolvedSystem);
            expect(actual.rootCssClass, `${labelPrefix}HTML root css class`).toBe(expected.rootCssClass);
            expect(actual.rootColorScheme, `${labelPrefix}HTML root color scheme`).toBe(expected.rootColorScheme);
        },
    };
}

test.describe('Color Scheme Client', () => {
    test('should apply default system light theme', async ({ page }) => {
        const t = await setupTestPage(page, 'light');

        await t.expectState({
            config: 'system',
            resolved: 'light',
            resolvedSystem: 'light',
            rootCssClass: 'light-theme',
            rootColorScheme: 'light',
        });
    });

    test('should apply default system dark theme', async ({ page }) => {
        const t = await setupTestPage(page, 'dark');

        await t.expectState({
            config: 'system',
            resolved: 'dark',
            resolvedSystem: 'dark',
            rootCssClass: 'dark-theme',
            rootColorScheme: 'dark',
        });
    });

    test('should detect system color change', async ({ page }) => {
        const t = await setupTestPage(page, 'light');

        await t.expectState({
            label: 'initial light',
            config: 'system',
            resolved: 'light',
            resolvedSystem: 'light',
            rootCssClass: 'light-theme',
            rootColorScheme: 'light',
        });

        await t.waitForStateChange(async () => {
            await t.setSystemColorScheme('dark');
        });

        await t.expectState({
            label: 'after system change to dark',
            config: 'system',
            resolved: 'dark',
            resolvedSystem: 'dark',
            rootCssClass: 'dark-theme',
            rootColorScheme: 'dark',
        });

        await t.waitForStateChange(async () => {
            await t.setSystemColorScheme('light');
        });

        await t.expectState({
            label: 'after system change back to light',
            config: 'system',
            resolved: 'light',
            resolvedSystem: 'light',
            rootCssClass: 'light-theme',
            rootColorScheme: 'light',
        });
    });

    test('should override the system color scheme', async ({ page }) => {
        const t = await setupTestPage(page, 'light');

        await t.waitForStateChange(async () => {
            await t.setConfig('dark');
        });

        let calls = await t.getSubscriptionCalls();
        expect(calls, 'after dark override').toEqual([
            {
                config: 'dark',
                resolved: 'dark',
            },
        ]);

        // Change system settings - should have no effect
        await t.setSystemColorScheme('dark');
        await t.setSystemColorScheme('light');
        await t.setSystemColorScheme('dark');

        // Wait a bit to ensure no state changes
        await page.waitForTimeout(100);

        calls = await t.getSubscriptionCalls();
        expect(calls, 'system has no affect after dark override').toEqual([]);

        await t.waitForStateChange(async () => {
            await t.setConfig('light');
        });

        calls = await t.getSubscriptionCalls();
        expect(calls, 'after light override').toEqual([
            {
                config: 'light',
                resolved: 'light',
            },
        ]);

        // Change system settings again - should still have no effect
        await t.setSystemColorScheme('light');
        await t.setSystemColorScheme('dark');

        // Wait a bit to ensure no state changes
        await page.waitForTimeout(100);

        calls = await t.getSubscriptionCalls();
        expect(calls, 'system has no affect after light override').toEqual([]);

        await t.waitForStateChange(async () => {
            await t.setConfig('system');
        });

        calls = await t.getSubscriptionCalls();
        expect(calls, 'after default back to system').toEqual([
            {
                config: 'system',
                resolved: 'dark',
            },
        ]);
    });

    test('should persist color scheme config', async ({ page }) => {
        const t = await setupTestPage(page, 'light');

        await t.waitForStateChange(async () => {
            await t.setConfig('dark');
        });

        await t.expectState({
            label: 'after dark override',
            config: 'dark',
            resolved: 'dark',
            resolvedSystem: 'light',
            rootCssClass: 'dark-theme',
            rootColorScheme: 'dark',
        });

        // Reload the page to test persistence
        await page.reload();
        await page.waitForFunction(() => window.colorSchemeApi);

        await t.expectState({
            label: 'after refresh with dark override',
            config: 'dark',
            resolved: 'dark',
            resolvedSystem: 'light',
            rootCssClass: 'dark-theme',
            rootColorScheme: 'dark',
        });
    });
});
