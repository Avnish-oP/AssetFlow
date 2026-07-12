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
    <div className="card-surface grid min-h-48 place-items-center text-center">
      <div className="px-6 py-8">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-line bg-raised text-muted">
          <svg viewBox="0 0 16 16" fill="none" className="h-5 w-5" aria-hidden>
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <p className="text-sm text-secondary">{title}</p>
        {description ? <p className="mt-1 text-xs text-muted">{description}</p> : null}
        {action ? (
          <button type="button" className={`${secondaryButtonClass} mt-4`} onClick={onAction}>
            {action}
          </button>
        ) : null}
      </div>
    </div>
  );
}
