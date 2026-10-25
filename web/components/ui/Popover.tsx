"use client";

import { useEffect, useLayoutEffect, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cx } from "@/components/ui/ui";

/**
 * A panel pinned under (or, without room, over) an anchor element, drawn on top of everything so a
 * scrolling modal can't clip it. Closes on a click outside the anchor and the panel, or on Escape.
 */
export default function Popover({
  anchor,
  open,
  onClose,
  children,
  className,
  matchWidth = false,
  estimatedHeight = 320,
  panelRef,
}: {
  anchor: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** Same width as the anchor (dropdown lists) instead of the panel's own width (calendars). */
  matchWidth?: boolean;
  /** Used to decide whether the panel fits below the anchor. */
  estimatedHeight?: number;
  panelRef: RefObject<HTMLDivElement | null>;
}) {
  const [style, setStyle] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const box = anchor.current?.getBoundingClientRect();
      if (!box) return;
      const gap = 6;
      const below = window.innerHeight - box.bottom;
      const flip = below < estimatedHeight + gap && box.top > below;
      const width = matchWidth ? box.width : undefined;
      // Keep the panel inside the screen with a small margin.
      const panelWidth = width ?? Math.min(320, window.innerWidth - 16);
      const left = Math.min(Math.max(8, box.left), window.innerWidth - panelWidth - 8);
      setStyle({
        position: "fixed",
        left,
        width: panelWidth,
        ...(flip ? { bottom: window.innerHeight - box.top + gap } : { top: box.bottom + gap }),
        // On a short screen neither side may fit: scroll inside the panel instead of running off it.
        maxHeight: (flip ? box.top : below) - gap - 8,
        overflowY: "auto",
      });
    }
    place();
    // Follow the anchor when the modal or page scrolls or the window resizes.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, anchor, matchWidth, estimatedHeight]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (anchor.current?.contains(target) || panelRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, onClose, anchor, panelRef]);

  if (!open || !style) return null;
  return createPortal(
    <div
      ref={panelRef}
      style={style}
      className={cx("z-[60] rounded-2xl border border-border bg-white text-text shadow-xl", className)}
    >
      {children}
    </div>,
    document.body,
  );
}
