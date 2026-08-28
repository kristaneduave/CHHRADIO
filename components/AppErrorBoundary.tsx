import React from 'react';

interface AppErrorBoundaryProps {
  children?: React.ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  errorCode: string;
  copied: boolean;
}

const createErrorCode = () => `RAD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

interface BoundaryBaseInstance {
  props: AppErrorBoundaryProps;
  setState(state: Partial<AppErrorBoundaryState>): void;
  render(): React.ReactNode;
}

const BoundaryBase = React.Component as unknown as new (props: AppErrorBoundaryProps) => BoundaryBaseInstance;

export class AppErrorBoundary extends BoundaryBase {
  state: AppErrorBoundaryState = { hasError: false, errorCode: '', copied: false };

  static getDerivedStateFromError(): Partial<AppErrorBoundaryState> {
    return { hasError: true, errorCode: createErrorCode() };
  }

  componentDidCatch(error: Error): void {
    console.error('Application boundary recovered from an unexpected error.', error);
  }

  private retry = () => window.location.reload();

  private returnHome = () => window.location.assign('/');

  private copyCode = async () => {
    try {
      await navigator.clipboard.writeText(this.state.errorCode);
      this.setState({ copied: true });
    } catch {
      // The code remains selectable if clipboard permission is unavailable.
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b1118] p-6 text-slate-100">
        <section className="w-full max-w-md rounded-[1.75rem] border border-white/10 bg-[#121b26] p-7 text-center shadow-2xl">
          <span className="material-icons mb-4 text-4xl text-amber-300">error_outline</span>
          <h1 className="text-xl font-bold text-white">Something went wrong</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">Your clinical information is not shown in this error. Try again, or return to the home screen.</p>
          <button type="button" onClick={this.copyCode} className="mt-5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-300">
            {this.state.copied ? 'Error code copied' : `Copy error code ${this.state.errorCode}`}
          </button>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button type="button" onClick={this.returnHome} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300">Return Home</button>
            <button type="button" onClick={this.retry} className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white">Retry</button>
          </div>
        </section>
      </main>
    );
  }
}

export default AppErrorBoundary;
