export function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="text-[28px] font-semibold leading-tight text-primary">{value}</div>
      <div className="mt-1 text-xs text-secondary">{label}</div>
    </div>
  );
}

