export function ConflictBanner({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-[var(--radius-card)] border-l-4 border-red bg-red-bg px-4 py-3 text-sm text-primary">
      <svg viewBox="0 0 16 16" fill="none" className="mt-0.5 h-4 w-4 shrink-0 text-red" aria-hidden>
        <path
          d="M8 1.5 14.5 13H1.5L8 1.5ZM8 6v3.5M8 11.5h.01"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div>
        <div className="mb-1 font-medium text-red">{title}</div>
        <div className="text-secondary">{children}</div>
      </div>
    </div>
  );
}
