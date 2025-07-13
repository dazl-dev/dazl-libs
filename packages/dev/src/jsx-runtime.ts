import * as ReactDevRuntime from 'react/jsx-dev-runtime';

const isBrowser = typeof window !== 'undefined';
const isObjectLike = (value: unknown) => typeof value === 'object' && value !== null;

const propsToSource = new WeakMap<object, ReactDevRuntime.JSXSource>();

const jsxDEVKeepSource: typeof ReactDevRuntime.jsxDEV = (type, props, key, isStatic, source, self) => {
    const reactElement = ReactDevRuntime.jsxDEV(type, props, key, isStatic, source, self);
    if (source && isObjectLike(reactElement.props)) {
        propsToSource.set(reactElement.props, source);
    }
    return reactElement;
};

// set on window for later inspection
if (isBrowser) {
    window.__propsToSource = propsToSource;
}

declare global {
    interface Window {
        __propsToSource: typeof propsToSource;
    }
}

export { Fragment, jsx, jsxs, type JSX } from 'react/jsx-runtime';
export { createElement } from 'react';
export const jsxDEV: typeof ReactDevRuntime.jsxDEV = isBrowser ? jsxDEVKeepSource : ReactDevRuntime.jsxDEV;
