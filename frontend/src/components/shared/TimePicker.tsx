"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { inputClass } from "@/components/shared/FormField";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function parseTime(value?: string) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return { hour: 9, minute: 0 };
  const [h, m] = value.split(":").map(Number);
  return { hour: h, minute: m };
}

function formatDisplay(value?: string) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return "";
  const { hour, minute } = parseTime(value);
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${pad(minute)} ${suffix}`;
}

type TimePickerProps = {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  stepMinutes?: number;
};

export function TimePicker({
  value: controlledValue,
  defaultValue = "",
  onChange,
  name,
  className = "",
  required,
  disabled,
  placeholder = "Select time",
  stepMinutes = 15,
}: TimePickerProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const value = controlledValue ?? uncontrolled;
  const parsed = parseTime(value || defaultValue || "09:00");

  const slots = useMemo(() => {
    const items: string[] = [];
    for (let hour = 0; hour < 24; hour += 1) {
      for (let minute = 0; minute < 60; minute += stepMinutes) {
        items.push(`${pad(hour)}:${pad(minute)}`);
      }
    }
    return items;
  }, [stepMinutes]);

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

  useEffect(() => {
    if (!open || !value) return;
    const el = rootRef.current?.querySelector<HTMLElement>(`[data-time="${value}"]`);
    el?.scrollIntoView({ block: "center" });
  }, [open, value]);

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
        <span className={`truncate ${value ? "text-primary" : "text-muted"}`}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        <svg viewBox="0 0 16 16" fill="none" className="size-4 shrink-0 text-muted" aria-hidden>
          <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 5v3.2L10 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>

      {open ? (
        <div className="absolute left-0 z-50 mt-1.5 w-[200px] overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-pin)]">
          <div className="border-b border-line px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted">
            Pick a time
          </div>
          <ul role="listbox" aria-labelledby={id} className="max-h-56 overflow-auto p-1">
            {slots.map((slot) => {
              const active = slot === value || (!value && slot === `${pad(parsed.hour)}:${pad(parsed.minute)}`);
              return (
                <li key={slot}>
                  <button
                    type="button"
                    role="option"
                    data-time={slot}
                    aria-selected={active}
                    className={`flex w-full items-center rounded-[calc(var(--radius-control)-2px)] px-3 py-2 text-left text-sm transition ${
                      active ? "bg-brand-bg font-medium text-brand" : "text-primary hover:bg-raised"
                    }`}
                    onClick={() => choose(slot)}
                  >
                    {formatDisplay(slot)}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
