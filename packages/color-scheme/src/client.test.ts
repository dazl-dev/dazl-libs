import { expect } from 'chai';
import type { ColorSchemeApi, ColorSchemeConfig, ColorSchemeResolve, ColorSchemeSubscriber, CurrentState } from './types';
import { waitFor } from 'promise-assist';

describe('Color Scheme Client', () => {
  it('should apply default system light theme', async () => {
    using t = await setupTestWindow({systemColorScheme: 'light'});

    t.expected({
      config: 'system',
      resolved: 'light',
      resolvedSystem: 'light',
      rootCssClass: 'light-theme',
      rootColorScheme: 'light',
    });
  });
  it('should apply default system dark theme', async () => {
    using t = await setupTestWindow({systemColorScheme: 'dark'});

    t.expected({
      config: 'system',
      resolved: 'dark',
      resolvedSystem: 'dark',
      rootCssClass: 'dark-theme',
      rootColorScheme: 'dark',
    });
  });
  it('should detect system color change', async () => {
    using t = await setupTestWindow({systemColorScheme: 'light'});

    t.expected({
      label: 'initial light',
      config: 'system',
      resolved: 'light',
      resolvedSystem: 'light',
      rootCssClass: 'light-theme',
      rootColorScheme: 'light',
    });

    await t.waitForUpdate({
      action: () => t.setSystemColorScheme('dark'),
    });

    t.expected({
      label: 'after system change to dark',
      config: 'system',
      resolved: 'dark',
      resolvedSystem: 'dark',
      rootCssClass: 'dark-theme',
      rootColorScheme: 'dark',
    });

    await t.waitForUpdate({
      action: () => t.setSystemColorScheme('light'),
    });

    t.expected({
      label: 'after system change back to light',
      config: 'system',
      resolved: 'light',
      resolvedSystem: 'light',
      rootCssClass: 'light-theme',
      rootColorScheme: 'light',
    });
  });
  it('should override the system color scheme', async () => {
    using t = await setupTestWindow({systemColorScheme: 'light'});

    const subCalls: CurrentState[] = [];
    t.api.subscribe(state => subCalls.push(state));

    t.waitForUpdate({
      action: () => t.api.config = 'dark',
    });

    expect(subCalls, 'after dark override').to.have.eql([
      {
        config: 'dark',
        resolved: 'dark',
        resolvedSystem: 'light',
      },
    ]);
    subCalls.length = 0;
    
    t.setSystemColorScheme('dark');
    t.setSystemColorScheme('light');
    t.setSystemColorScheme('dark');

    expect(subCalls, 'system has no affect after dark override').to.have.eql([]);

    t.waitForUpdate({
      action: () => t.api.config = 'light',
    });

    expect(subCalls, 'after light override').to.have.eql([
      {
        config: 'light',
        resolved: 'light',
        resolvedSystem: 'dark',
      },
    ]);
    subCalls.length = 0;

    t.setSystemColorScheme('light');
    t.setSystemColorScheme('dark');

    expect(subCalls, 'system has no affect after light override').to.have.eql([]);

    t.waitForUpdate({
      action: () => t.api.config = 'system',
    });

    expect(subCalls, 'after default back to system').to.have.eql([
      {
        config: 'system',
        resolved: 'dark',
        resolvedSystem: 'dark',
      },
    ]);
  });
  it('should persist color scheme config', async () => {
    using t = await setupTestWindow({systemColorScheme: 'light'});

    await t.waitForUpdate({
      action: () => t.api.config = 'dark',
    });

    t.expected({
      label: 'after dark override',
      config: 'dark',
      resolved: 'dark',
      resolvedSystem: 'light',
      rootCssClass: 'dark-theme',
      rootColorScheme: 'dark',
    });

    const newApi = await t.refreshWindow();
    
    expect(newApi, 'new colorSchemeApi after refresh').to.not.equal(t.api);
    t.expected({
      label: 'after refresh with dark override',
      config: 'dark',
      resolved: 'dark',
      resolvedSystem: 'light',
      rootCssClass: 'dark-theme',
      rootColorScheme: 'dark',
    });
  });
});

async function setupTestWindow({
  config = 'system',
  systemColorScheme,
}: {
  config?: ColorSchemeConfig;
  systemColorScheme: 'light' | 'dark';
}) {
  const iframe = document.createElement('iframe');
  iframe.srcdoc = `
        <!DOCTYPE html>
        <html>
          <head>
          <script src="./dist/client.js"></script>
            <title>Color Scheme Test</title>
          </head>
          <body>
            <p>Color Scheme Test</p>
            <script>
              document.body.appendChild(document.createElement('div')).textContent = 'random' + Math.random();
              </script>
          </body>
        </html>
      `;
  iframe.style.colorScheme = systemColorScheme;
  document.body.appendChild(iframe);
  await new Promise((resolve) => {
    iframe.onload = resolve;
  });
  const colorSchemeApi = iframe.contentWindow?.colorSchemeApi;
  if (!colorSchemeApi) {
    throw new Error('Color Scheme API not found in iframe');
  }
  const initialConfig = colorSchemeApi.config;
  if(initialConfig !== config) {
    colorSchemeApi.config = config;
  }
  return {
    api: colorSchemeApi,
    setSystemColorScheme(config: ColorSchemeResolve) {
      iframe.style.colorScheme = config;
    },
    async waitForUpdate({action}: {action?: () => void}) {
      let update: null | Parameters<ColorSchemeSubscriber>[0] = null
      const unsubscribe = colorSchemeApi.subscribe((current) => {
        update = current;
      });
      action?.();
      return await waitFor(() => {
        if (!update) {
          throw new Error('No update received');
        }
      }).catch((e) => {
        throw new Error(`Timeout waiting for update: ${e.message}`);
      }).finally(() => {
        unsubscribe();
      });
    },
    async refreshWindow() {
      iframe.contentWindow?.location.reload();
      await new Promise((resolve) => {
        iframe.onload = resolve;
      });
      return iframe.contentWindow?.colorSchemeApi;
    },
    expected({label, ...expected}: {config: ColorSchemeConfig, resolved: ColorSchemeResolve, resolvedSystem: ColorSchemeResolve, rootCssClass: string, rootColorScheme: ColorSchemeResolve, label?: string}) {
      const labelPrefix = label ? `(${label}) ` : '';

      expect(colorSchemeApi.currentState, `${labelPrefix}API current state`).to.eql({
        config: expected.config,
        resolved: expected.resolved,
        resolvedSystem: expected.resolvedSystem,
      });

      const htmlRoot = iframe.contentDocument?.documentElement;
      if (!htmlRoot) {
        throw new Error(`${labelPrefix}HTML root not found in iframe document`);
      }
      expect(htmlRoot.classList.value, `${labelPrefix}HTML root css class`).to.eql(expected.rootCssClass);
      expect(htmlRoot.style.colorScheme, `${labelPrefix}HTML root color scheme`).to.eql(expected.rootColorScheme);
    },
    [Symbol.dispose]: () => {
      colorSchemeApi.config = initialConfig;
      colorSchemeApi.dispose();
      document.body.removeChild(iframe);
    },
  };
}
