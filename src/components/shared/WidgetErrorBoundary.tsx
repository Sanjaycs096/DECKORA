import { Component, type ErrorInfo, type ReactNode } from 'react';
import { MaterialSymbol } from './MaterialSymbol';

interface Props {
  label: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[DECKORA WidgetErrorBoundary: ${this.props.label}]`, error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="aurora-glass inline-flex items-center gap-2 px-4 py-2.5 text-xs text-[var(--aurora-text-secondary)]"
        >
          <MaterialSymbol name="warning" size={16} className="text-[var(--aurora-warning)]" />
          <span>{this.props.label} encountered a rendering issue.</span>
        </div>
      );
    }
    return this.props.children;
  }
}
