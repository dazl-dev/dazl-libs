import { Children, isValidElement, type ReactNode } from 'react';

import styles from './example.module.css';

export interface SectionProps {
    layout?: 'row' | 'column';
    children: React.ReactNode;
}

export const Section = ({ layout = 'column', children }: SectionProps) => {
    const { title, content } = extractTitle(children);

    return (
        <section className={styles.section}>
            {title}
            <div className={layout === 'column' ? styles.sectionContentColumn : styles.sectionContentRow}>
                {content}
            </div>
        </section>
    );
};

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className={styles.sectionTitle}>{children}</div>
);

Section.Title = SectionTitle;

const extractTitle = (children: ReactNode): { title: ReactNode; content: ReactNode } => {
    const [title, ...content] = Children.toArray(children);
    return isValidElement(title) && title.type === SectionTitle
        ? { title, content }
        : { title: null, content: children };
};
