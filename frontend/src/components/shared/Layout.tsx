import Link from "next/link";
import React from "react";

type Breadcrumb = {
  label: string;
  href?: string;
};

export function PageHeader({
  title,
  description,
  eyebrow,
  breadcrumbs,
  status,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  breadcrumbs?: Breadcrumb[];
  status?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="card-surface bg-surface px-4 py-4 shadow-sm sm:px-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {breadcrumbs?.length ? (
            <nav className="mb-1 flex flex-wrap items-center gap-1 text-xs text-secondary" aria-label="Breadcrumb">
              {breadcrumbs.map((item, index) => {
                const current = index === breadcrumbs.length - 1;
                return (
                  <React.Fragment key={`${item.label}-${index}`}>
                    {index > 0 ? <span className="text-muted">/</span> : null}
                    {item.href && !current ? (
                      <Link href={item.href} className="hover:text-primary">
                        {item.label}
                      </Link>
                    ) : (
                      <span className={current ? "text-primary" : ""}>{item.label}</span>
                    )}
                  </React.Fragment>
                );
              })}
            </nav>
          ) : eyebrow ? (
            <div className="mb-1 text-xs text-secondary">{eyebrow}</div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-heading">{title}</h1>
            {status}
          </div>
          {description ? <p className="mt-1 max-w-3xl text-sm text-secondary">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`card-surface p-4 sm:p-5 ${className}`}>{children}</section>;
}

export function Toolbar({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`flex min-w-0 flex-wrap items-end gap-3 ${className}`}>{children}</div>;
}

export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-base font-medium text-primary">{title}</h2>
        {description ? <p className="text-xs text-secondary">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  getBadge,
}: {
  value: T;
  options: readonly { id: T; label: string }[];
  onChange: (value: T) => void;
  getBadge?: (value: T) => React.ReactNode;
}) {
  return (
    <div className="inline-flex max-w-full flex-wrap gap-1 rounded-[var(--radius-control)] border border-line bg-raised p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`min-h-8 rounded-[calc(var(--radius-control)-2px)] px-3 text-xs font-medium transition ${
            value === option.id
              ? "bg-surface text-primary shadow-sm"
              : "text-secondary hover:bg-surface/70 hover:text-primary"
          }`}
        >
          {option.label}
          {getBadge?.(option.id)}
        </button>
      ))}
    </div>
  );
}

export function Modal({
  title,
  description,
  children,
  onClose,
  className = "max-w-md",
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <button type="button" aria-label="Close modal" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className={`card-surface relative w-full p-5 shadow-xl ${className}`}>
        <h3 className="text-base font-medium text-primary">{title}</h3>
        {description ? <p className="mt-1 text-sm text-secondary">{description}</p> : null}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
