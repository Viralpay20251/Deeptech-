import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '32px',
            backgroundColor: '#1e293b',
            border: '1px solid #ef4444',
            borderRadius: '12px',
            margin: '24px auto',
            color: '#f8fafc',
            maxWidth: '800px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <AlertTriangle size={24} color="#ef4444" />
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
              {this.props.fallbackTitle || 'Component Render Error'}
            </h3>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px' }}>
            {this.state.error?.message || 'An unexpected error occurred while rendering this module.'}
          </p>
          {this.state.error?.stack && (
            <pre
              style={{
                padding: '12px',
                backgroundColor: '#0f172a',
                borderRadius: '6px',
                fontSize: '12px',
                overflowX: 'auto',
                color: '#f87171',
                marginBottom: '16px',
                maxHeight: '200px',
              }}
            >
              {this.state.error.stack}
            </pre>
          )}
          <button
            onClick={this.handleReset}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw size={14} />
            Return to Command Center
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
