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
    <div className={`rounded-xl border border-line bg-surface-raised p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${accentColor ? accentBorders[accentColor] : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[28px] font-semibold leading-tight text-primary">{value}</div>
          <div className="mt-1 text-xs font-medium text-secondary">{label}</div>
        </div>
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface text-heading [&_svg]:size-5">
          {icon ?? <KpiIcon label={label} />}
        </div>
      </div>
      {trend ? (
        <div className={`mt-2 text-xs ${trendPositive ? "text-green" : trendNegative ? "text-red" : "text-secondary"}`}>
          {trend}
        </div>
      ) : null}
    </div>
  );
}

function KpiIcon({ label }: { label: string }) {
  const icon = label.includes("maintenance") ? <path d="m14.7 6.3 3-3a4 4 0 0 1-5.4 5.4l-7.6 7.6a2 2 0 0 0 2.8 2.8l7.6-7.6a4 4 0 0 1 5.4-5.4l-3 3" /> : label.includes("Booking") ? <path d="M6 3v3m12-3v3M4 8h16M5 5h14v15H5zM8 12h3m2 0h3" /> : label.includes("transfer") ? <path d="M7 7h11l-3-3m3 3-3 3M17 17H6l3 3m-3-3 3-3" /> : label.includes("Due") ? <path d="M12 8v5l3 2m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /> : <path d="M4 7h16v13H4V7Zm3-3h10v3H7V4Zm2 8h6m-6 4h4" />;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">{icon}</svg>;
}
