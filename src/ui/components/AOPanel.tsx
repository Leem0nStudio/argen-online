type Props = React.HTMLAttributes<HTMLDivElement> & {
  variant?: "panel" | "sheet" | "hud";
  padded?: boolean;
};

export function AOPanel({ variant = "panel", padded = true, className = "", children, ...rest }: Props) {
  return (
    <div className={`ao-panel ao-panel--${variant} ${padded ? "ao-panel--padded" : ""} ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function AOBottomSheet({ children, onClose, title }: { children: React.ReactNode; onClose?: () => void; title?: string }) {
  return (
    <div className="ao-sheet-backdrop" onClick={onClose}>
      <div className="ao-sheet" onClick={(e) => e.stopPropagation()}>
        {title && <div className="ao-sheet-handle" />}
        {title && <div className="ao-panel-title">{title}</div>}
        {children}
      </div>
    </div>
  );
}
