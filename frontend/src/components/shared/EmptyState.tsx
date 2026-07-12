import { secondaryButtonClass } from "@/components/shared/FormField";

export function EmptyState({ title, action }: { title: string; action?: string }) {
  return (
    <div className="grid min-h-48 place-items-center rounded-lg border border-line bg-surface text-center">
      <div>
        <div className="mx-auto mb-3 grid h-9 w-9 place-items-center rounded-full border border-line text-muted">+</div>
        <p className="text-sm text-secondary">{title}</p>
        {action ? <button className={`${secondaryButtonClass} mt-4`}>{action}</button> : null}
      </div>
    </div>
  );
}

