// @ts-nocheck
import React, { ErrorInfo, ReactNode } from 'react';
import { Icon } from './ui/Icon';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<any, any> {
  public state: any = {
    hasError: false,
    error: null
  };

  constructor(props: any) {
    super(props);
  }

  public static getDerivedStateFromError(error: Error): any {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#121212] p-4">
          <div className="max-w-md w-full bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Icon name="alert-triangle" className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Something went wrong</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              The application encountered an unexpected error. We've logged this issue and are working to fix it.
            </p>
            {this.state.error && (
                <div className="mb-6 p-4 bg-gray-100 dark:bg-black/30 rounded-lg text-left overflow-auto max-h-32">
                    <p className="text-xs font-mono text-red-500">{this.state.error.toString()}</p>
                </div>
            )}
            <div className="flex gap-3 justify-center">
                <button
                onClick={() => window.location.href = '/'}
                className="px-6 py-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-xl font-semibold transition-colors"
                >
                Go Home
                </button>
                <button
                onClick={() => window.location.reload()}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors"
                >
                Reload Page
                </button>
            </div>
          </div>
        </div>
      );
    }

    return <React.Fragment>{this.props.children}</React.Fragment>;
  }
}

export default ErrorBoundary;
