export function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4 transition-all duration-300 hover:-translate-y-1 hover:border-line-strong hover:shadow-xl hover:shadow-bg/50">
      <div className="text-[28px] font-semibold leading-tight text-primary">{value}</div>
      <div className="mt-1 text-xs text-secondary">{label}</div>
    </div>
  );
}

