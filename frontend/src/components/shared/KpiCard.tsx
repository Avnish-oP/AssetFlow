const accentBorders: Record<string, string> = {
  green: "border-b-2 border-b-green",
  blue: "border-b-2 border-b-blue",
  amber: "border-b-2 border-b-amber",
  red: "border-b-2 border-b-red",
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
      className={`card-surface card-surface-hover p-4 ${accentColor ? accentBorders[accentColor] : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[28px] font-semibold leading-tight text-primary">{value}</div>
          <div className="mt-1 text-xs text-secondary">{label}</div>
        </div>
        {icon ? <div className="text-muted">{icon}</div> : null}
      </div>
      {trend ? (
        <div
          className={`mt-2 text-xs ${
            trendPositive ? "text-green" : trendNegative ? "text-red" : "text-secondary"
          }`}
        >
          {trend}
        </div>
      ) : null}
    </div>
  );
}
