import { type RefCallback, useCallback } from 'react';

/**
 * Always open absolute URLs in a new tab and prevent navigation for relative
 * URLs.
 */
export const useLinkBehaviorOverride = (): RefCallback<HTMLElement> => {
    return useCallback((container: HTMLElement | null) => {
        if (!container) return;

        const handleClick = (event: MouseEvent) => {
            if (!(event.target instanceof Element)) return;

            const link = event.target.closest('a');
            if (!link) return;

            const href = link.getAttribute('href');
            if (!href) return;

            event.preventDefault();

            if (isAbsoluteUrl(href)) {
                window.open(href, '_blank', 'noopener,noreferrer');
            }
        };

        container.addEventListener('click', handleClick);

        return () => {
            container.removeEventListener('click', handleClick);
        };
    }, []);
};

const isAbsoluteUrl = (url: string): boolean => /^[a-z][a-z0-9+.-]*:/i.test(url);
