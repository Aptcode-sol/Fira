import { Component } from 'react';
import { Link } from 'react-router-dom';

/**
 * Reusable error boundary for the admin panel.
 * Catches render errors in children while keeping the rest of the UI functional.
 *
 * Props:
 *  - fallbackMessage (string): custom message shown on error
 *  - showDashboardLink (boolean): whether to show "Go to Dashboard" link (default: true)
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // ponytail: log only — no external reporting wired yet
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const message = this.props.fallbackMessage || 'Something went wrong loading this page.';
    const showDashboardLink = this.props.showDashboardLink !== false;

    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 text-center" role="alert" aria-live="assertive">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>

        <p className="text-white text-lg font-medium mb-2">{message}</p>
        <p className="text-gray-300 text-sm mb-8">
          {this.state.error?.message || 'An unexpected error occurred.'}
        </p>

        <div className="flex items-center gap-4">
          <button
            onClick={this.handleRetry}
            className="px-5 py-2.5 bg-white text-black rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            Retry
          </button>
          {showDashboardLink && (
            <Link
              to="/"
              className="px-5 py-2.5 border border-white/20 text-white rounded-lg font-medium hover:bg-white/5 transition-colors"
            >
              Go to Dashboard
            </Link>
          )}
        </div>
      </div>
    );
  }
}
