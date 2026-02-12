import { lazy, Component, Suspense, useState, memo } from 'react';
import type { ComponentExampleInfo } from './types';
import { useLinkBehaviorOverride } from './use-link-behavior-override';
import styles from './example-card.module.css';

interface ExampleCardProps {
    example: ComponentExampleInfo;
}

export const ExampleCard = memo(function ExampleCard({ example }: ExampleCardProps) {
    const [Component] = useState(() => lazy(() => import(/* @vite-ignore */ `/${example.relativePath}`)));
    const contentRef = useLinkBehaviorOverride();

    return (
        <div id={example.relativePath} className={styles.card}>
            <h3 className={styles.cardHeader}>{example.displayName}</h3>
            <div ref={contentRef} className={styles.cardContent}>
                <ErrorBoundary fallback={(error) => <ErrorState error={error} />}>
                    <Suspense fallback={<LoadingState />}>
                        <Component />
                    </Suspense>
                </ErrorBoundary>
            </div>
        </div>
    );
});

const LoadingState = () => {
    return (
        <div className={styles.loadingState}>
            <div className={styles.spinner} />
        </div>
    );
};

const ErrorState = ({ error }: { error: Error }) => {
    return (
        <div className={styles.errorState}>
            <span className={styles.errorIcon}>⚠</span>
            <span className={styles.errorMessage}>{error.message}</span>
        </div>
    );
};

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback: (error: Error) => React.ReactNode;
}

interface ErrorBoundaryState {
    error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error };
    }

    render() {
        if (this.state.error) {
            return this.props.fallback(this.state.error);
        }
        return this.props.children;
    }
}

export const scrollExampleCardIntoView = (id: string) => {
    const element = document.getElementById(id);
    if (!element) return;

    element.scrollIntoView({
        behavior: 'instant',
        block: 'nearest',
    });

    element.animate(
        [
            { boxShadow: '0 0 0 0 #3E63DD' },
            { boxShadow: '0 0 0 4px #3E63DD', offset: 0.2 },
            { boxShadow: '0 0 0 0 #3E63DD' },
        ],
        {
            duration: 900,
            easing: 'ease-out',
        },
    );
};
