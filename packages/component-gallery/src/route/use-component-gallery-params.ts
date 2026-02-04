import { useMemo } from 'react';
import { useLocation } from 'react-router';
import { type ComponentGalleryParams, componentGalleryParamsSchema } from './types';

export const useComponentGalleryParams = (): ComponentGalleryParams => {
    const { hash } = useLocation();

    return useMemo(() => {
        try {
            const parsed: unknown = JSON.parse(decodeURIComponent(hash.slice(1)));
            return componentGalleryParamsSchema.parse(parsed);
        } catch {
            return { columns: 1, examples: [] };
        }
    }, [hash]);
};
