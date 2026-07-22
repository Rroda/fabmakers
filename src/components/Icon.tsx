import type { CSSProperties } from "react";

type IconProps = {
  /** Material Symbols ligature name, e.g. "dark_mode", "warning" */
  name: string;
  className?: string;
  filled?: boolean;
  /** px optical size hint (20–48) */
  size?: number;
  title?: string;
};

/**
 * Google Material Symbols Outlined — única fonte de ícones da UI FabMakers.
 * Nomes: https://fonts.google.com/icons
 */
export function Icon({ name, className = "", filled = false, size = 20, title }: IconProps) {
  const style: CSSProperties = {
    fontSize: size,
    fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
    lineHeight: 1,
    userSelect: "none",
  };

  return (
    <span
      className={`material-symbols-outlined inline-flex items-center justify-center shrink-0 ${className}`}
      style={style}
      title={title}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
    >
      {name}
    </span>
  );
}
