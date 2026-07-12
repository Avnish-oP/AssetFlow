const palette: Record<string, string> = {
  available: "border-blue/20 bg-blue-bg text-blue",
  active: "border-blue/20 bg-blue-bg text-blue",
  verified: "border-blue/20 bg-blue-bg text-blue",
  resolved: "border-blue/20 bg-blue-bg text-blue",
  approved: "border-blue/20 bg-blue-bg text-blue",
  completed: "border-blue/20 bg-blue-bg text-blue",
  open: "border-blue/20 bg-blue-bg text-blue",
  allocated: "border-brand/20 bg-brand-bg text-brand",
  reserved: "border-blue/20 bg-blue-bg text-blue",
  upcoming: "border-blue/20 bg-blue-bg text-blue",
  in_progress: "border-blue/20 bg-blue-bg text-blue",
  technician_assigned: "border-blue/20 bg-blue-bg text-blue",
  pending: "border-amber/20 bg-amber-bg text-amber",
  damaged: "border-amber/20 bg-amber-bg text-amber",
  requested: "border-amber/20 bg-amber-bg text-amber",
  overdue: "border-red/20 bg-red-bg text-red",
  missing: "border-red/20 bg-red-bg text-red",
  blocked: "border-red/20 bg-red-bg text-red",
  rejected: "border-red/20 bg-red-bg text-red",
  closed: "border-line bg-raised text-secondary",
  lost: "border-red/20 bg-red-bg text-red",
  high: "border-red/20 bg-red-bg text-red",
  medium: "border-amber/20 bg-amber-bg text-amber",
  low: "border-blue/20 bg-blue-bg text-blue",
};

const pulseStatuses = new Set(["overdue", "missing"]);

export function StatusPill({ value }: { value: string }) {
  const key = value.toLowerCase();
  const pulse = pulseStatuses.has(key);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize tracking-wide ${
        palette[key] ?? "border-line bg-raised text-secondary"
      }`}
    >
      {pulse ? <span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-current" aria-hidden /> : null}
      {value.replaceAll("_", " ")}
    </span>
  );
}
