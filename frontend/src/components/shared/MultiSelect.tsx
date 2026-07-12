"use client";

import { useEffect, useId, useRef, useState } from "react";
import { inputClass } from "@/components/shared/FormField";
import type { SelectOption } from "@/components/shared/Select";

type MultiSelectProps = {
  options: SelectOption[];
  value?: string[];
  defaultValue?: string[];
  onChange?: (value: string[]) => void;
  name?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
};

export function MultiSelect({
  options,
  value: controlledValue,
  defaultValue = [],
  onChange,
  name,
  className = "",
  placeholder = "Select…",
  disabled,
}: MultiSelectProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [uncontrolled, setUncontrolled] = useState<string[]>(defaultValue);
  const value = controlledValue ?? uncontrolled;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle(next: string) {
    const set = new Set(value);
    if (set.has(next)) set.delete(next);
    else set.add(next);
    const list = Array.from(set);
    if (controlledValue === undefined) setUncontrolled(list);
    onChange?.(list);
  }

  const labels = options.filter((option) => value.includes(option.value)).map((option) => option.label);
  const summary =
    labels.length === 0 ? placeholder : labels.length <= 2 ? labels.join(", ") : `${labels.length} selected`;

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      {name
        ? value.map((item) => <input key={item} type="hidden" name={name} value={item} />)
        : null}
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`${inputClass} flex items-center justify-between gap-2 text-left ${
          open ? "border-brand" : ""
        } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
      >
        <span className={`truncate ${labels.length ? "text-primary" : "text-muted"}`}>{summary}</span>
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className={`size-4 shrink-0 text-muted transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-multiselectable
          aria-labelledby={id}
          className="absolute left-0 right-0 z-50 mt-1.5 max-h-60 overflow-auto rounded-[var(--radius-control)] border border-line bg-surface p-1 shadow-[var(--shadow-pin)]"
        >
          {options.map((option) => {
            const active = value.includes(option.value);
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`flex w-full items-center gap-2 rounded-[calc(var(--radius-control)-2px)] px-3 py-2 text-left text-sm transition ${
                    active ? "bg-brand-bg font-medium text-brand" : "text-primary hover:bg-raised"
                  }`}
                  onClick={() => toggle(option.value)}
                >
                  <span
                    className={`grid size-4 place-items-center rounded border ${
                      active ? "border-brand bg-brand text-brand-fg" : "border-line bg-surface"
                    }`}
                    aria-hidden
                  >
                    {active ? (
                      <svg viewBox="0 0 12 12" className="size-2.5" fill="none">
                        <path d="M2.5 6.2 4.8 8.5 9.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    ) : null}
                  </span>
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
