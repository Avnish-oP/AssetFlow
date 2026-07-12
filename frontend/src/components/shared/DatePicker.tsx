"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { inputClass } from "@/components/shared/FormField";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toIso(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function parseIso(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDisplay(value?: string) {
  const date = parseIso(value);
  if (!date) return "";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

type DatePickerProps = {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
};

export function DatePicker({
  value: controlledValue,
  defaultValue = "",
  onChange,
  name,
  className = "",
  required,
  disabled,
  placeholder = "Select date",
}: DatePickerProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const value = controlledValue ?? uncontrolled;
  const selected = parseIso(value);
  const initial = selected ?? new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  useEffect(() => {
    if (!open) return;
    const current = parseIso(value) ?? new Date();
    setViewYear(current.getFullYear());
    setViewMonth(current.getMonth());
  }, [open, value]);

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

  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const prevDays = new Date(viewYear, viewMonth, 0).getDate();
    const items: { day: number; inMonth: boolean; iso: string }[] = [];

    for (let i = startPad - 1; i >= 0; i -= 1) {
      const day = prevDays - i;
      const month = viewMonth - 1;
      const year = month < 0 ? viewYear - 1 : viewYear;
      const realMonth = (month + 12) % 12;
      items.push({ day, inMonth: false, iso: toIso(year, realMonth, day) });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      items.push({ day, inMonth: true, iso: toIso(viewYear, viewMonth, day) });
    }
    while (items.length % 7 !== 0 || items.length < 42) {
      const day = items.length - (startPad + daysInMonth) + 1;
      const month = viewMonth + 1;
      const year = month > 11 ? viewYear + 1 : viewYear;
      const realMonth = month % 12;
      items.push({ day, inMonth: false, iso: toIso(year, realMonth, day) });
    }
    return items;
  }, [viewMonth, viewYear]);

  function choose(iso: string) {
    if (controlledValue === undefined) setUncontrolled(iso);
    onChange?.(iso);
    setOpen(false);
  }

  function shiftMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  const todayIso = toIso(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      {name ? <input type="hidden" name={name} value={value} required={required && !value} /> : null}
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="dialog"
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
          <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-labelledby={id}
          className="absolute left-0 z-50 mt-1.5 w-[288px] rounded-[var(--radius-card)] border border-line bg-surface p-3 shadow-[var(--shadow-pin)]"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              className="grid size-8 place-items-center rounded-full text-secondary hover:bg-raised hover:text-primary"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
            >
              ‹
            </button>
            <div className="font-display text-sm tracking-tight text-primary">
              {MONTHS[viewMonth]} {viewYear}
            </div>
            <button
              type="button"
              className="grid size-8 place-items-center rounded-full text-secondary hover:bg-raised hover:text-primary"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((day) => (
              <div key={day} className="py-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, index) => {
              const active = cell.iso === value;
              const isToday = cell.iso === todayIso;
              return (
                <button
                  key={`${cell.iso}-${index}`}
                  type="button"
                  onClick={() => choose(cell.iso)}
                  className={`grid aspect-square place-items-center rounded-full text-xs transition ${
                    active
                      ? "bg-brand font-medium text-brand-fg"
                      : cell.inMonth
                        ? "text-primary hover:bg-brand-bg hover:text-brand"
                        : "text-muted/50 hover:bg-raised"
                  } ${!active && isToday ? "ring-1 ring-brand/40" : ""}`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-line pt-2">
            <button
              type="button"
              className="text-xs font-medium text-brand hover:brightness-110"
              onClick={() => choose(todayIso)}
            >
              Today
            </button>
            <button
              type="button"
              className="text-xs text-secondary hover:text-primary"
              onClick={() => {
                if (controlledValue === undefined) setUncontrolled("");
                onChange?.("");
                setOpen(false);
              }}
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
