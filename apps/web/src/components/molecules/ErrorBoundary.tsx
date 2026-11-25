import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from './ErrorState';

interface State {
  error: Error | null;
}

/** Catches render errors so one broken screen does not blank the whole app. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-md p-6">
        <ErrorState
          message="Algo deu errado ao exibir esta tela."
          onRetry={() => this.setState({ error: null })}
        />
      </div>
    );
  }
}
