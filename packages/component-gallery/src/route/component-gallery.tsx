import type { CSSProperties } from 'react';
import styles from './component-gallery.module.css';
import { ExampleCard } from './example-card';
import { useComponentGalleryParams } from './use-component-gallery-params';
import { useScrollToExampleCard } from './use-scroll-to-example-card';

export const ComponentGallery = () => {
    const { columns, examples, selectedExamplePath, random } = useComponentGalleryParams();
    const ref = useScrollToExampleCard(selectedExamplePath, random);

    return (
        <div ref={ref} className={styles.root} style={{ '--columns': columns } as CSSProperties}>
            {examples.map((example) => (
                <ExampleCard key={example.relativePath} example={example} />
            ))}
        </div>
    );
};
