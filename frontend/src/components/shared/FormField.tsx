export function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid min-w-0 w-full gap-1.5 text-sm text-secondary">
      <span className="truncate">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "h-10 w-full min-w-0 max-w-full rounded-[var(--radius-control)] border border-line bg-raised px-3 text-sm text-primary outline-none transition focus:border-line-strong";

/** Native file controls are wider than text inputs on Windows — keep them inside the grid cell. */
export const fileInputClass =
  `${inputClass} file:mr-3 file:max-w-[40%] file:cursor-pointer file:overflow-hidden file:rounded-[var(--radius-control)] file:border-0 file:bg-surface file:px-3 file:py-1.5 file:text-xs file:text-primary`;

export const buttonClass =
  "inline-flex h-10 items-center justify-center rounded-[var(--radius-control)] bg-green px-4 text-sm font-medium text-bg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClass =
  "inline-flex h-10 items-center justify-center rounded-[var(--radius-control)] border border-line bg-surface px-4 text-sm text-primary transition hover:border-line-strong hover:brightness-110";
