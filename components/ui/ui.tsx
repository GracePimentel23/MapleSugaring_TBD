"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { CheckIcon, CloseIcon } from "@/components/icons";

/** Shared building blocks for the rebrand: cards, buttons, pills, toggles, modals, tables. */

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4 max-md:pt-4">
      <div className="min-w-0">
        <h1 className="font-sans text-3xl font-bold tracking-tight md:text-[48px] md:leading-tight">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cx("mb-3 font-sans text-base font-semibold", className)}>{children}</h2>;
}

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return <div className={cx("rounded-2xl border border-border bg-white", padded && "p-5", className)}>{children}</div>;
}

export function CardTitle({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h2 className="font-sans text-xl font-bold md:text-2xl">{title}</h2>
        {subtitle ? <p className="mt-1 max-w-xl text-sm text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Label, big number, small note. `dark` is the filled forest-green variant. */
export function StatCard({
  label,
  value,
  note,
  dark = false,
  className,
}: {
  label: string;
  value: string;
  note?: string;
  dark?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-2xl border p-5",
        dark ? "border-accent bg-accent text-white" : "border-border bg-white",
        className,
      )}
    >
      <div className={cx("text-sm", dark ? "text-white/80" : "text-muted")}>{label}</div>
      <div className="mt-1 font-sans text-[30px] leading-tight font-bold md:text-3xl">{value}</div>
      {note ? <div className={cx("mt-1 text-sm", dark ? "text-white/80" : "text-muted")}>{note}</div> : null}
    </div>
  );
}

type ButtonVariant = "primary" | "outline" | "danger" | "ghost";

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-sans font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2.5 text-sm md:text-body",
        variant === "primary" && "bg-accent text-white hover:bg-sidebar-hover",
        variant === "outline" && "border border-accent bg-white text-accent hover:bg-accent-light",
        variant === "danger" && "border border-attention-border bg-white text-status-problem hover:bg-attention-bg",
        variant === "ghost" && "text-accent hover:bg-accent-light",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Rounded filter pill with a count bubble. */
export function FilterPill({
  label,
  count,
  active,
  onClick,
  badge,
  className,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "relative inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 font-sans text-sm font-medium whitespace-nowrap transition-colors",
        active ? "border-accent bg-accent text-white" : "border-border bg-white text-text hover:border-accent/40",
        className,
      )}
    >
      {label}
      {count !== undefined ? (
        <span
          className={cx(
            "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold",
            active ? "bg-white/20 text-white" : "bg-bg text-muted",
          )}
        >
          {count}
        </span>
      ) : null}
      {badge}
    </button>
  );
}

/** Pill-shaped switch. Uses the deep green when on. */
export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
      className={cx(
        "h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-accent-mid" : "bg-[#D5D9CF]",
      )}
    >
      <span
        className="block h-5 w-5 rounded-full bg-white shadow-sm transition-transform"
        style={{ transform: checked ? "translateX(20px)" : "none" }}
      />
    </button>
  );
}

/** Centered dialog on desktop, bottom sheet on phones. */
export function Modal({
  title,
  onClose,
  children,
  footer,
  width = "md",
  eyebrow,
  subtitle,
  badge,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: "md" | "lg";
  eyebrow?: string;
  /** A line under the title, kept in the fixed header so it never scrolls under it */
  subtitle?: ReactNode;
  /** Shown beside the title, e.g. a status badge */
  badge?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          "relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl md:rounded-3xl",
          width === "lg" ? "md:max-w-2xl" : "md:max-w-lg",
        )}
      >
        <div className="flex justify-center pt-3 md:hidden">
          <div className="h-1 w-10 rounded-full bg-[#D5D9CF]" />
        </div>
        <div className="flex shrink-0 items-start justify-between gap-4 px-6 pt-5 pb-3 md:px-8 md:pt-7">
          <div className="min-w-0">
            {eyebrow ? <p className="mb-1 text-sm text-muted">{eyebrow}</p> : null}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="font-sans text-2xl font-bold md:text-[32px]">{title}</h2>
              {badge}
            </div>
            {subtitle ? <p className="mt-1 text-body text-muted">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-muted hover:bg-bg"
          >
            <CloseIcon size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-2 md:px-8">{children}</div>
        {footer ? (
          <div className="flex shrink-0 flex-wrap justify-end gap-3 px-6 pt-3 pb-6 md:px-8">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-muted">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-sm text-muted">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-border bg-white px-4 py-3 text-body text-text outline-none transition-colors focus:border-accent-mid disabled:bg-bg disabled:text-muted";

/** Simple bordered table with uppercase heads. Columns are plain strings or nodes. */
export function DataTable({
  columns,
  rows,
  empty = "Nothing here yet.",
}: {
  columns: { key: string; label: string; align?: "left" | "right"; className?: string }[];
  rows: { key: string; cells: Record<string, ReactNode>; onClick?: () => void }[];
  empty?: string;
}) {
  return (
    <>
      <div className="-mx-1 overflow-x-auto">
        {/* Wide tables scroll sideways on phones; narrow ones just fit. */}
        <table className={cx("w-full border-collapse text-left text-sm", columns.length > 3 && "min-w-[520px]")}>
          <thead>
            <tr className="border-b border-border">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cx("table-head px-3 pb-3", column.align === "right" && "text-right", column.className)}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key}
                onClick={row.onClick}
                className={cx("border-b border-border last:border-0", row.onClick && "cursor-pointer hover:bg-bg")}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cx(
                      "px-3 py-3.5 align-middle",
                      column.align === "right" && "text-right",
                      column.className,
                    )}
                  >
                    {row.cells[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Outside the scroller, so on a phone it centers in view instead of across the wide table. */}
      {rows.length === 0 ? <p className="px-2 py-6 text-center text-sm text-muted">{empty}</p> : null}
    </>
  );
}

/** Thin progress track with a colored fill. */
export function ProgressBar({ percent, color, height = 8 }: { percent: number; color: string; height?: number }) {
  return (
    <div className="overflow-hidden rounded-full bg-progress-track" style={{ height }}>
      <div
        className="anim-grow h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(Math.max(percent, 0), 100)}%`, background: color }}
      />
    </div>
  );
}

/** Square checkbox in the deep green, with its label. */
export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className={cx("flex items-center gap-3", disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        className={cx(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent-mid",
          checked ? "border-accent-mid bg-accent-mid text-white" : "border-[#9CA39A] bg-white",
        )}
      >
        {checked ? <CheckIcon size={14} /> : null}
      </span>
      <span className="text-body">{label}</span>
    </label>
  );
}

/**
 * The one "nothing here yet" look: a soft circular icon, a title and a line of
 * help. `compact` is for empty sections inside a page.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center rounded-2xl border border-dashed border-[#CFD6C8] bg-white text-center",
        compact ? "px-6 py-7" : "px-6 py-14",
      )}
    >
      <span
        className={cx(
          "mb-3 flex items-center justify-center rounded-full bg-accent-light text-accent-mid",
          compact ? "h-11 w-11" : "h-14 w-14",
        )}
      >
        {icon}
      </span>
      <p className={cx("font-sans font-semibold", compact ? "text-base" : "text-lg")}>{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
