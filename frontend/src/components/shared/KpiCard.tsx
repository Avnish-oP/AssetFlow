export function KpiCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-raised p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[28px] font-semibold leading-tight text-primary">{value}</div>
          <div className="mt-1 text-xs font-medium text-secondary">{label}</div>
        </div>
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface text-heading [&_svg]:size-5">
          {icon}
        </div>
      </div>
    </div>
  );
}

