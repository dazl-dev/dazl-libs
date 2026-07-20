import type { RsbuildPlugin } from '@rsbuild/core';

export const pluginDazl: RsbuildPlugin = {
    name: 'dazl-rsbuild-plugin',
    setup(api) {
        if (api.context.action !== 'dev') return;
        api.modifyEnvironmentConfig((config, { mergeEnvironmentConfig }) => {
            return mergeEnvironmentConfig(config, {
                tools: {
                    swc: {
                        jsc: {
                            transform: {
                                react: { runtime: 'automatic', development: true, importSource: '@dazl/dev' },
                            },
                        },
                    },
                },
            });
        });
    },
};
