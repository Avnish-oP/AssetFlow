"use client";

import { useEffect, useId, useRef, useState } from "react";
import { inputClass } from "@/components/shared/FormField";

export type SelectOption = { value: string; label: string };

type SelectProps = {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  multiple?: never;
};

export function Select({
  options,
  value: controlledValue,
  defaultValue = "",
  onChange,
  name,
  placeholder,
  className = "",
  required,
  disabled,
}: SelectProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const value = controlledValue ?? uncontrolled;
  const selected = options.find((option) => option.value === value);
  const label = selected?.label ?? placeholder ?? "Select…";

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

  function choose(next: string) {
    if (controlledValue === undefined) setUncontrolled(next);
    onChange?.(next);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      {name ? <input type="hidden" name={name} value={value} required={required && !value} /> : null}
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
        <span className={`truncate ${selected ? "text-primary" : "text-muted"}`}>{label}</span>
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
          aria-labelledby={id}
          className="absolute left-0 right-0 z-50 mt-1.5 max-h-60 overflow-auto rounded-[var(--radius-control)] border border-line bg-surface p-1 shadow-[var(--shadow-pin)]"
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <li key={option.value || "__empty"}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`flex w-full items-center rounded-[calc(var(--radius-control)-2px)] px-3 py-2 text-left text-sm transition ${
                    active
                      ? "bg-brand-bg font-medium text-brand"
                      : "text-primary hover:bg-raised"
                  }`}
                  onClick={() => choose(option.value)}
                >
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
