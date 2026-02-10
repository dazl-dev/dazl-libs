import { useEffect, useMemo, useState } from 'react';
import { type ComponentGalleryParams, componentGalleryParamsSchema } from './types';

const useLocationHash = (): string => {
    const [hash, setHash] = useState(() => (typeof window !== 'undefined' ? window.location.hash : ''));

    useEffect(() => {
        const handleHashChange = () => setHash(window.location.hash);
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    return hash;
};

export const useComponentGalleryParams = (): ComponentGalleryParams => {
    const hash = useLocationHash();

    return useMemo(() => {
        try {
            const parsed: unknown = JSON.parse(decodeURIComponent(hash.slice(1)));
            return componentGalleryParamsSchema.parse(parsed);
        } catch {
            return { columns: 1, examples: [] };
        }
    }, [hash]);
};
