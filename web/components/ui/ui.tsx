"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { CheckIcon, CloseIcon } from "@/components/icons";

/** Shared building blocks for the rebrand: cards, buttons, pills, toggles, modals, tables. */

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4 max-md:pt-4">
      <div className="min-w-0">
        <h1 className="font-sans text-3xl leading-tight font-bold tracking-tight md:text-[48px] md:leading-[1.1]">{title}</h1>
        {subtitle ? <p className="mt-0.5 max-w-2xl text-sm text-muted">{subtitle}</p> : null}
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
  return <div className={cx("rounded-2xl bg-white shadow-card", padded && "p-5", className)}>{children}</div>;
}

export function CardTitle({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="font-sans text-xl leading-tight font-bold md:text-2xl">{title}</h2>
        {subtitle ? <p className="mt-0.5 max-w-xl text-sm text-muted">{subtitle}</p> : null}
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
  note?: ReactNode;
  dark?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-2xl p-5 shadow-card",
        dark ? "bg-accent text-white" : "bg-white",
        className,
      )}
    >
      <div className={cx("text-sm", dark ? "text-white/80" : "text-muted")}>{label}</div>
      <div className="mt-1 font-sans text-[30px] leading-none font-bold md:text-3xl">{value}</div>
      {note ? <div className={cx("mt-2 text-sm", dark ? "text-white/85" : "text-muted")}>{note}</div> : null}
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
        active ? "border-accent bg-accent text-white" : "border-transparent bg-white text-text shadow-card hover:border-accent/40",
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
  tag,
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
  /** Shown at the top right, beside the close button, e.g. "Critical" */
  tag?: ReactNode;
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
          <div className="flex shrink-0 items-center gap-2">
            {tag}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-1.5 text-muted hover:bg-bg"
            >
              <CloseIcon size={18} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-2 md:px-8">{children}</div>
        {footer ? (
          <div className="flex shrink-0 flex-wrap justify-end gap-3 px-6 pt-3 pb-6 md:px-8">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  required = false,
  children,
}: {
  label: string;
  hint?: ReactNode;
  /** Marks the label with a red * (pair it with a "* Required" note on the form) */
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="relative block">
      <span className="mb-1.5 block text-sm text-muted">
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-status-problem">
            *
          </span>
        ) : null}
        {required ? <span className="sr-only"> (required)</span> : null}
      </span>
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
export function ProgressBar({
  percent,
  color,
  height = 8,
  filling = false,
}: {
  percent: number;
  color: string;
  height?: number;
  /** Sap is coming in: a lighter band keeps reaching past the fill, like the level rising */
  filling?: boolean;
}) {
  const width = Math.min(Math.max(percent, 0), 100);
  const reach = Math.min(width + 10, 100);
  return (
    <div className="relative overflow-hidden rounded-full bg-progress-track" style={{ height }}>
      {filling && width < 100 ? (
        <div
          aria-hidden="true"
          className="anim-filling absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${reach}%`, background: color, ["--from" as string]: reach ? width / reach : 0 }}
        />
      ) : null}
      <div
        className="anim-grow relative h-full rounded-full transition-all duration-500"
        style={{ width: `${width}%`, background: color }}
      />
    </div>
  );
}

/**
 * A soft grey box with a label and a value, like Current and Target on a station. The unit sits
 * after the number, smaller and lighter, so the number reads first. Pass children for an input.
 */
export function InfoBox({
  label,
  value,
  unit,
  children,
  className,
  large = false,
}: {
  label: string;
  value?: ReactNode;
  unit?: string;
  children?: ReactNode;
  className?: string;
  /** The headline number of a card, e.g. a batch's sap in */
  large?: boolean;
}) {
  return (
    <div className={cx("rounded-xl bg-bg px-3.5 py-2.5", className)}>
      <div className="text-sm text-muted">{label}</div>
      {children ?? (
        <div className={cx("font-sans font-semibold", large ? "text-2xl md:text-3xl" : "text-lg")}>
          {value}
          {unit ? <span className="ml-1 text-sm font-normal text-muted">{unit}</span> : null}
        </div>
      )}
    </div>
  );
}

/**
 * A number typed into an info-box style field, with its unit beside it (weights, Brix). The shared
 * look for every "how much" input.
 */
export function NumberBox({
  label,
  value,
  onChange,
  unit,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  unit: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label
      className={cx(
        "block cursor-text rounded-xl border border-transparent bg-bg px-3.5 py-2.5 transition-colors focus-within:border-accent-mid focus-within:bg-white",
        className,
      )}
    >
      <span className="block text-sm text-muted">{label}</span>
      <span className="flex items-baseline gap-1">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full min-w-0 bg-transparent font-sans text-lg font-semibold outline-none placeholder:text-muted/50"
        />
        <span className="text-sm text-muted">{unit}</span>
      </span>
    </label>
  );
}

/**
 * A short numbered how-to. With `current`, the step you are on is green with slightly bolder text
 * and every other step (before or after) is greyed out; without it, every number is green.
 */
export function Steps({ items, current }: { items: ReactNode[]; current?: number }) {
  return (
    <ol className="space-y-2.5">
      {items.map((item, index) => {
        const on = current === undefined || index === current;
        return (
          <li key={index} className="flex items-start gap-3" aria-current={index === current ? "step" : undefined}>
            <span
              className={cx(
                "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-sans text-xs font-semibold",
                on ? "bg-accent text-white" : "border border-border bg-white text-muted",
              )}
            >
              {index + 1}
            </span>
            <span
              className={cx(
                "text-body",
                current !== undefined && (index === current ? "font-medium text-text" : "text-muted"),
              )}
            >
              {item}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Stands in for a chart with nothing to draw, so the space does not look broken. */
export function ChartEmpty({ height, message = "No data yet" }: { height: number; message?: string }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted/70"
      style={{ height }}
    >
      {message}
    </div>
  );
}

/** "Are you sure?" before something that is hard to undo. */
export function ConfirmModal({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  danger = false,
}: {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="outline" className="border-border text-text" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="pb-2 text-body text-muted">{message}</p>
    </Modal>
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
    // relative: the hidden input is absolutely placed, and without a positioned parent it hangs off
    // the page's own scroll area and adds empty space under the page.
    <label
      className={cx("relative flex items-center gap-3", disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer")}
    >
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
        "flex flex-col items-center rounded-2xl bg-white text-center shadow-card",
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
