import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", height: "100vh", background: "#0a0a0f",
          color: "#e0d5c1", fontFamily: "monospace", padding: "2rem",
        }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>💥</div>
          <div style={{ fontSize: "1.2rem", color: "#d4a843", marginBottom: "0.5rem" }}>
            Error Inesperado
          </div>
          <div style={{ fontSize: "0.85rem", color: "#8a7f70", marginBottom: "1.5rem", textAlign: "center", maxWidth: 400 }}>
            {this.state.error?.message ?? "Algo salió mal. Recargá la página para intentar de nuevo."}
          </div>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{
              padding: "0.8rem 2rem", background: "#8b7355", color: "#e0d5c1",
              border: "1px solid #d4a843", borderRadius: 8, cursor: "pointer",
              fontSize: "1rem", fontWeight: "bold",
            }}
          >
            ⚔️ Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
