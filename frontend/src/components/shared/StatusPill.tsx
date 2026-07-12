const palette: Record<string, string> = {
  available: "border-green bg-green-bg text-green",
  active: "border-green bg-green-bg text-green",
  verified: "border-green bg-green-bg text-green",
  resolved: "border-green bg-green-bg text-green",
  allocated: "border-blue bg-blue-bg text-blue",
  reserved: "border-blue bg-blue-bg text-blue",
  upcoming: "border-blue bg-blue-bg text-blue",
  pending: "border-amber bg-amber-bg text-amber",
  damaged: "border-amber bg-amber-bg text-amber",
  overdue: "border-red bg-red-bg text-red",
  missing: "border-red bg-red-bg text-red",
  blocked: "border-red bg-red-bg text-red",
};

export function StatusPill({ value }: { value: string }) {
  const key = value.toLowerCase();
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${palette[key] ?? "border-line bg-raised text-secondary"}`}>
      {value.replaceAll("_", " ")}
    </span>
  );
}

