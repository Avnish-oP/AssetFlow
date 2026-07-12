export function ConflictBanner({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-l-4 border-red bg-red-bg px-4 py-3 text-sm text-primary">
      <div className="mb-1 font-medium text-red">{title}</div>
      <div className="text-secondary">{children}</div>
    </div>
  );
}

