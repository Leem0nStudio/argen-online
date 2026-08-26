import { haptic } from "../hooks/useHaptic";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "gold";
  size?: "sm" | "md" | "lg";
  hapticType?: "light" | "medium" | "heavy" | "success";
};

export default function AOButton({ variant = "primary", size = "md", hapticType = "light", className = "", children, onClick, ...rest }: Props) {
  const cls = [
    "ao-btn",
    `ao-btn--${variant}`,
    `ao-btn--${size}`,
    className,
  ].join(" ");
  return (
    <button
      className={cls}
      onClick={(e) => {
        if (hapticType) haptic(hapticType);
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
