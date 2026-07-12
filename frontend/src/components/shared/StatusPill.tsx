const palette: Record<string, string> = {
  available: "border-green bg-green-bg text-green",
  active: "border-green bg-green-bg text-green",
  verified: "border-green bg-green-bg text-green",
  resolved: "border-green bg-green-bg text-green",
  approved: "border-green bg-green-bg text-green",
  completed: "border-green bg-green-bg text-green",
  open: "border-blue bg-blue-bg text-blue",
  allocated: "border-blue bg-blue-bg text-blue",
  reserved: "border-blue bg-blue-bg text-blue",
  upcoming: "border-blue bg-blue-bg text-blue",
  in_progress: "border-blue bg-blue-bg text-blue",
  technician_assigned: "border-blue bg-blue-bg text-blue",
  pending: "border-amber bg-amber-bg text-amber",
  damaged: "border-amber bg-amber-bg text-amber",
  requested: "border-amber bg-amber-bg text-amber",
  overdue: "border-red bg-red-bg text-red",
  missing: "border-red bg-red-bg text-red",
  blocked: "border-red bg-red-bg text-red",
  rejected: "border-red bg-red-bg text-red",
  closed: "border-line bg-raised text-secondary",
  lost: "border-red bg-red-bg text-red",
  high: "border-red bg-red-bg text-red",
  medium: "border-amber bg-amber-bg text-amber",
  low: "border-blue bg-blue-bg text-blue",
};

const pulseStatuses = new Set(["overdue", "missing"]);

export function StatusPill({ value }: { value: string }) {
  const key = value.toLowerCase();
  const pulse = pulseStatuses.has(key);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs shadow-sm hover:shadow-md hover:brightness-125 transition-all cursor-default ${
        palette[key] ?? "border-line bg-raised text-secondary"
      }`}
    >
      {pulse ? <span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-current" aria-hidden /> : null}
      {value.replaceAll("_", " ")}
    </span>
  );
}
