import { secondaryButtonClass } from "@/components/shared/FormField";

export function EmptyState({
  title,
  description,
  action,
  onAction,
}: {
  title: string;
  description?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="card-surface grid min-h-48 place-items-center text-center pin-wash-mist">
      <div className="px-6 py-10">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-surface text-muted shadow-[var(--shadow-sm)]">
          <svg viewBox="0 0 16 16" fill="none" className="h-5 w-5" aria-hidden>
            <path d="M3 4.5h10M5 2.5h6M4 6.5h8v6.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="font-display text-lg text-primary">{title}</p>
        {description ? <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-muted">{description}</p> : null}
        {action ? (
          <button type="button" className={`${secondaryButtonClass} mt-5`} onClick={onAction}>
            {action}
          </button>
        ) : null}
      </div>
    </div>
  );
}
