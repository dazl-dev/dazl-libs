import { useEffect, useRef } from 'react';
import { scrollExampleCardIntoView } from './example-card';

/**
 * Scrolls to an example card whenever the container resizes (e.g., as lazy
 * components load). Auto-scroll stops once the user scrolls manually, and
 * resets on dependency changes.
 */
export const useScrollToExampleCard = (relativePath: string | undefined, counter: number | undefined) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!relativePath || !container) return;

        let scrolledManually = false;
        let scrollingProgrammatically = false;
        let animationFrameId = 0;

        const handleScroll = () => {
            if (scrollingProgrammatically) return;
            scrolledManually = true;
        };

        const resizeObserver = new ResizeObserver(() => {
            if (scrolledManually) return;
            scrollingProgrammatically = true;
            scrollExampleCardIntoView(relativePath);
            cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(() => {
                scrollingProgrammatically = false;
            });
        });

        window.addEventListener('scroll', handleScroll);
        resizeObserver.observe(container);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            resizeObserver.disconnect();
            cancelAnimationFrame(animationFrameId);
        };
    }, [relativePath, counter]);

    return containerRef;
};
