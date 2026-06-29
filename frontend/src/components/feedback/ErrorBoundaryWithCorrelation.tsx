import React from 'react';
import { AlertTriangle, RefreshCw, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  correlationId: string | null;
  copied: boolean;
}

/**
 * ErrorBoundaryWithCorrelation — catches uncaught React render errors and
 * displays a user-friendly panel that includes any Correlation ID surfaced
 * by the backend via the global `serverError` custom event.
 *
 * Usage:
 *   <ErrorBoundaryWithCorrelation>
 *     <YourPage />
 *   </ErrorBoundaryWithCorrelation>
 */
export class ErrorBoundaryWithCorrelation extends React.Component<Props, State> {
  private serverErrorHandler: ((e: Event) => void) | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, correlationId: null, copied: false };
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidMount(): void {
    this.serverErrorHandler = (e: Event) => {
      const correlationId = (e as CustomEvent<{ correlationId?: string }>).detail?.correlationId ?? null;
      this.setState({ hasError: true, correlationId });
    };
    window.addEventListener('serverError', this.serverErrorHandler);
  }

  componentWillUnmount(): void {
    if (this.serverErrorHandler) {
      window.removeEventListener('serverError', this.serverErrorHandler);
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, correlationId: null, copied: false });
  };

  private handleCopy = (): void => {
    const { correlationId } = this.state;
    if (!correlationId) return;
    navigator.clipboard.writeText(correlationId).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  render(): React.ReactNode {
    const { hasError, correlationId, copied } = this.state;

    if (!hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-lg border-destructive/40">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <CardTitle className="text-lg">Something went wrong</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              An unexpected error occurred. Please try refreshing the page or contact support.
            </p>
          </CardHeader>

          {correlationId && (
            <CardContent className="pt-0">
              <div className="rounded-md bg-muted px-3 py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">Reference ID</p>
                  <p className="text-sm font-mono font-medium truncate">{correlationId}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-8 w-8"
                  onClick={this.handleCopy}
                  title="Copy reference ID"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Include this reference ID when contacting support.
              </p>
            </CardContent>
          )}

          <CardFooter>
            <Button onClick={this.handleReset} variant="outline" className="w-full gap-2">
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
}

export default ErrorBoundaryWithCorrelation;
