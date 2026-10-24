import type { CSSProperties } from "react";

/**
 * One tooltip look for every chart: a light card with dark text, so values stay
 * readable over any bar or line color. Recharts colors each row by its series,
 * which made dark-green text on the old dark tooltip unreadable.
 */
export const tooltipContentStyle: CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #E2E2DA",
  borderRadius: 12,
  boxShadow: "0 8px 24px rgba(26, 35, 24, 0.12)",
  color: "#1A2318",
  fontSize: 16,
  padding: "8px 12px",
};

export const tooltipLabelStyle: CSSProperties = {
  color: "#1A2318",
  fontWeight: 600,
  marginBottom: 2,
};

export const tooltipItemStyle: CSSProperties = {
  color: "#1A2318",
};

/** The highlight behind a hovered bar: a faint tint instead of solid grey. */
export const barCursor = { fill: "rgba(31, 58, 28, 0.06)" };
/** The guide line on hovered line charts. */
export const lineCursor = { stroke: "#B9C8B3", strokeWidth: 1 };
