import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global React error boundary — catches unhandled JS errors in the component
 * tree and displays a recovery screen instead of a blank page.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production you could forward this to a monitoring service (Sentry etc.)
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="text-6xl">⚠️</div>
          <h1 className="text-2xl font-semibold text-foreground">
            Something went wrong
          </h1>
          <p className="text-muted-foreground text-sm">
            An unexpected error occurred. Your data is safe — please try
            refreshing the page.
          </p>
          {import.meta.env.DEV && this.state.error && (
            <pre className="text-left text-xs bg-muted p-3 rounded overflow-auto max-h-40 text-red-600">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-3 justify-center pt-2">
            <Button variant="outline" onClick={this.handleReset}>
              Try again
            </Button>
            <Button onClick={this.handleReload}>Reload page</Button>
          </div>
        </div>
      </div>
    );
  }
}
