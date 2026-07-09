import type { AcceptedPlugin, Helpers, Root } from 'postcss';
import type { DazlPostcssPluginOptions } from './dazl-plugin-types.js';

type DazlPostcssPluginLoader = ((options?: DazlPostcssPluginOptions) => AcceptedPlugin | undefined) & {
    postcss: true;
};

function runPlugin(root: Root, helpers: Helpers, plugin: AcceptedPlugin): Promise<void> {
    return helpers
        .postcss([plugin])
        .process(root, helpers.result.opts)
        .then((delegatedResult) => {
            helpers.result.messages.push(...delegatedResult.messages);
        });
}

const dazlPostcssPlugin: DazlPostcssPluginLoader = Object.assign(
    function dazlPostcssPlugin(options?: DazlPostcssPluginOptions): AcceptedPlugin {
        let pluginPromise: Promise<AcceptedPlugin | undefined> | undefined;

        return {
            postcssPlugin: 'dazl-postcss-plugin-cjs-loader',
            async Once(root: Root, helpers: Helpers) {
                pluginPromise ||= import('@dazl/dev/dazl-postcss-plugin').then(({ dazlPostcssPlugin: loadPlugin }) => {
                    return loadPlugin(options);
                });

                const plugin = await pluginPromise;
                if (!plugin) {
                    return;
                }

                await runPlugin(root, helpers, plugin);
            },
        };
    },
    { postcss: true as const },
);

module.exports = dazlPostcssPlugin;
const exportsObject = module.exports as {
    dazlPostcssPlugin?: DazlPostcssPluginLoader;
};
exportsObject.dazlPostcssPlugin = dazlPostcssPlugin;
