export function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm text-secondary">
      <span>{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "h-10 rounded-[var(--radius-control)] border border-line bg-raised px-3 text-sm text-primary outline-none transition focus:border-line-strong";

export const buttonClass =
  "inline-flex h-10 items-center justify-center rounded-[var(--radius-control)] bg-green px-4 text-sm font-medium text-bg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClass =
  "inline-flex h-10 items-center justify-center rounded-[var(--radius-control)] border border-line bg-surface px-4 text-sm text-primary transition hover:border-line-strong hover:brightness-110";
