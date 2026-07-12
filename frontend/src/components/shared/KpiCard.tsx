const washByAccent: Record<string, string> = {
  green: "pin-wash-mist",
  blue: "pin-wash-sky",
  amber: "pin-wash-sand",
  red: "pin-wash-blush",
};

const iconByAccent: Record<string, string> = {
  green: "bg-brand-bg text-brand",
  blue: "bg-blue-bg text-blue",
  amber: "bg-amber-bg text-amber",
  red: "bg-red-bg text-red",
};

export function KpiCard({
  label,
  value,
  icon,
  accentColor,
  trend,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  accentColor?: "green" | "blue" | "amber" | "red";
  trend?: string;
}) {
  const trendPositive = trend?.startsWith("+");
  const trendNegative = trend?.startsWith("-");

  return (
    <div
      className={`card-surface card-surface-hover min-w-0 overflow-hidden p-4 ${
        accentColor ? washByAccent[accentColor] : ""
      }`}
    >
      <div className="flex min-w-0 items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[10px] font-medium uppercase tracking-[0.1em] text-secondary" title={label}>
            {label}
          </div>
          <div className="mt-2 truncate font-display text-[1.75rem] leading-none tracking-tight text-primary tabular-nums">
            {value}
          </div>
        </div>
        <div
          className={`grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl [&_svg]:size-4 ${
            accentColor ? iconByAccent[accentColor] : "bg-raised text-brand"
          }`}
        >
          {icon ?? <KpiIcon label={label} />}
        </div>
      </div>
      {trend ? (
        <div className={`mt-3 truncate text-xs font-medium ${trendPositive ? "text-brand" : trendNegative ? "text-red" : "text-secondary"}`}>
          {trend}
        </div>
      ) : null}
    </div>
  );
}

function KpiIcon({ label }: { label: string }) {
  const key = label.toLowerCase();
  if (key.includes("maintenance")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    );
  }
  if (key.includes("booking")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      </svg>
    );
  }
  if (key.includes("transfer")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4" />
      </svg>
    );
  }
  if (key.includes("due") || key.includes("return")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }
  if (key.includes("allocated")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="M3.3 7 12 12l8.7-5M12 22V12" />
    </svg>
  );
}
