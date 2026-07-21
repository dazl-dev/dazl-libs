import type { AcceptedPlugin, Helpers, Root } from 'postcss';

type DazlPostcssPluginLoader = (() => AcceptedPlugin) & {
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
    function dazlPostcssPlugin(): AcceptedPlugin {
        let pluginPromise: Promise<AcceptedPlugin | undefined> | undefined;

        return {
            postcssPlugin: 'dazl-postcss-plugin-cjs-loader',
            async Once(root: Root, helpers: Helpers) {
                pluginPromise ||= import('@dazl/dev/dazl-postcss-plugin').then(({ resolveDazlPostcssPlugin }) => {
                    return resolveDazlPostcssPlugin();
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
