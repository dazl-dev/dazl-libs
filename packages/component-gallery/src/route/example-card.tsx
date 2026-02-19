import { lazy, Component, Suspense, useState, memo } from 'react';
import type { ComponentExampleInfo } from './types';
import { useLinkBehaviorOverride } from './use-link-behavior-override';
import styles from './example-card.module.css';

interface ExampleCardProps {
    example: ComponentExampleInfo;
}

export const ExampleCard = memo(function Example({ example }: ExampleCardProps) {
    const [Component] = useState(() => lazy(() => import(/* @vite-ignore */ `/${example.relativePath}`)));
    const contentRef = useLinkBehaviorOverride();

    return (
        <div id={example.relativePath} className={styles.exampleCard}>
            <h3 className={styles.exampleCardHeader}>{example.displayName}</h3>
            <ErrorBoundary fallback={(error) => <ExampleCardError error={error} />}>
                <Suspense fallback={<ExampleCardLoading />}>
                    <div ref={contentRef} className={styles.exampleCardContent}>
                        <Component />
                    </div>
                </Suspense>
            </ErrorBoundary>
        </div>
    );
});

const ExampleCardLoading = () => {
    return (
        <div className={styles.exampleCardLoading}>
            <div className={styles.exampleCardSpinner} />
        </div>
    );
};

const ExampleCardError = ({ error }: { error: Error }) => {
    return (
        <div className={styles.exampleCardError}>
            <span className={styles.exampleCardErrorIcon}>⚠</span>
            <span className={styles.exampleCardErrorMessage}>{error.message}</span>
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
