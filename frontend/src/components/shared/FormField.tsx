export function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid min-w-0 w-full gap-1.5 text-sm text-secondary">
      <span className="truncate text-[13px] font-medium text-primary/80">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "h-11 w-full min-w-0 max-w-full rounded-[var(--radius-control)] border border-line bg-surface px-3.5 text-sm text-primary shadow-[var(--shadow-sm)] outline-none transition placeholder:text-muted focus:border-brand";

export const fileInputClass = `${inputClass} file:mr-3 file:max-w-[40%] file:cursor-pointer file:overflow-hidden file:rounded-full file:border-0 file:bg-raised file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary`;

export const buttonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand px-5 text-sm font-medium text-brand-fg shadow-[var(--shadow-sm)] transition hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 text-sm font-medium text-primary shadow-[var(--shadow-sm)] transition hover:border-line-strong hover:bg-raised disabled:cursor-not-allowed disabled:opacity-50";
