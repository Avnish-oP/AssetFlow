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
    <div className="rounded-lg border border-line bg-surface p-4 transition-all duration-300 hover:-translate-y-1 hover:border-line-strong hover:shadow-xl hover:shadow-bg/50">
      <div className="text-[28px] font-semibold leading-tight text-primary">{value}</div>
      <div className="mt-1 text-xs text-secondary">{label}</div>
    </div>
  );
}
