"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { CheckIcon, ChevronDownIcon } from "@/components/icons";
import Popover from "@/components/ui/Popover";
import { cx } from "@/components/ui/ui";

export interface SelectOption {
  value: string;
  label: string;
  /** A second, lighter line under the label */
  detail?: string;
}

/**
 * A dropdown in the app's own style (the browser's built-in one looks out of place): a field-like
 * button and a list of options under it. With `value=""` it shows the placeholder, which also makes
 * it work as an "Add…" menu that resets after each pick.
 */
export default function Select({
  value,
  onChange,
  options,
  placeholder = "Choose…",
  label,
  disabled = false,
  icon,
  emptyText = "Nothing to choose",
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** For screen readers */
  label: string;
  disabled?: boolean;
  /** Shown before the text, e.g. a plus for an "Add…" menu */
  icon?: ReactNode;
  emptyText?: string;
}) {
  const listId = useId();
  const anchor = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const chosen = options.find((option) => option.value === value);

  function pick(option: SelectOption) {
    onChange(option.value);
    setOpen(false);
    anchor.current?.focus();
  }

  return (
    <>
      <button
        ref={anchor}
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => {
          setActive(Math.max(options.findIndex((option) => option.value === value), 0));
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            setOpen(true);
          } else if (open && event.key === "ArrowDown") {
            event.preventDefault();
            setActive((current) => Math.min(current + 1, options.length - 1));
          } else if (open && event.key === "ArrowUp") {
            event.preventDefault();
            setActive((current) => Math.max(current - 1, 0));
          } else if (open && event.key === "Enter") {
            event.preventDefault();
            const option = options[active];
            if (option) pick(option);
          }
        }}
        className={cx(
          "flex w-full items-center gap-2 rounded-xl border bg-white px-4 py-3 text-left text-body transition-colors outline-none",
          open ? "border-accent-mid" : "border-border hover:border-accent/40",
          "focus-visible:border-accent-mid disabled:cursor-not-allowed disabled:bg-bg disabled:text-muted",
        )}
      >
        {icon ? <span className="shrink-0 text-accent">{icon}</span> : null}
        <span
          className={cx(
            "min-w-0 flex-1 truncate",
            !chosen && !icon && "text-muted",
            Boolean(icon) && "font-semibold text-accent",
          )}
        >
          {chosen ? chosen.label : placeholder}
        </span>
        <ChevronDownIcon size={18} className={cx("shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>

      <Popover
        anchor={anchor}
        panelRef={panel}
        open={open}
        onClose={() => setOpen(false)}
        matchWidth
        estimatedHeight={280}
        className="py-1"
      >
        <ul id={listId} role="listbox" aria-label={label} className="max-h-64 overflow-y-auto overscroll-contain">
          {options.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted">{emptyText}</li>
          ) : (
            options.map((option, index) => {
              const selected = option.value === value;
              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(option)}
                  className={cx("flex cursor-pointer items-center gap-3 px-4 py-2.5", index === active && "bg-bg")}
                >
                  <span className="min-w-0 flex-1">
                    <span className={cx("block truncate text-body", selected && "font-semibold")}>{option.label}</span>
                    {option.detail ? <span className="block truncate text-sm text-muted">{option.detail}</span> : null}
                  </span>
                  {selected ? <CheckIcon size={16} className="shrink-0 text-accent" /> : null}
                </li>
              );
            })
          )}
        </ul>
      </Popover>
    </>
  );
}
