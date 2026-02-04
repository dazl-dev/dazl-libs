import styles from './example.module.css';

interface SectionProps {
    title?: string;
    layout?: 'row' | 'column';
    children: React.ReactNode;
}

export const Section = ({ title, layout = 'column', children }: SectionProps) => {
    return (
        <section className={styles.section}>
            {title ? <div className={styles.sectionTitle}>{title}</div> : null}
            <div className={layout === 'column' ? styles.sectionContentColumn : styles.sectionContentRow}>
                {children}
            </div>
        </section>
    );
};
