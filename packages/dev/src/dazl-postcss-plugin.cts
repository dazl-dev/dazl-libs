import type { AcceptedPlugin, Helpers, Root } from 'postcss';
import type { DazlPostcssPluginOptions } from './dazl-plugin-types.js';

type DazlPostcssPluginLoader = ((options?: DazlPostcssPluginOptions) => AcceptedPlugin) & {
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
        let pluginPromise: Promise<AcceptedPlugin> | undefined;

        return {
            postcssPlugin: 'dazl-postcss-plugin-cjs-loader',
            async Once(root: Root, helpers: Helpers) {
                pluginPromise ||= import('@dazl/dev/dazl-postcss-plugin').then(({ resolveDazlPostcssPlugin }) => {
                    return resolveDazlPostcssPlugin(options);
                });

                await runPlugin(root, helpers, await pluginPromise);
            },
        };
    },
    { postcss: true as const },
);

module.exports = dazlPostcssPlugin;
