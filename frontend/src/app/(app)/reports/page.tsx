"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DataTable, TableRow } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { buttonClass, secondaryButtonClass } from "@/components/shared/FormField";
import { StatusPill } from "@/components/shared/StatusPill";
import {
  apiFetch,
  type AssetUsageReport,
  type BookingHeatmapReport,
  type DepartmentAllocationReport,
  type MaintenanceFrequencyReport,
  type RetirementReport,
  type UtilizationReport,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/roles";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HEAT_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          const text = value == null ? "" : String(value);
          return `"${text.replaceAll('"', '""')}"`;
        })
        .join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function heatColor(count: number, max: number) {
  if (!count || max <= 0) return "transparent";
  const intensity = Math.min(1, count / max);
  return `rgba(59, 130, 246, ${0.15 + intensity * 0.75})`;
}

export default function ReportsPage() {
  const { user } = useAuth();
  const allowed = can(user?.role, "reports");
  const [utilization, setUtilization] = useState<UtilizationReport | null>(null);
  const [usage, setUsage] = useState<AssetUsageReport | null>(null);
  const [maintenance, setMaintenance] = useState<MaintenanceFrequencyReport | null>(null);
  const [retirement, setRetirement] = useState<RetirementReport | null>(null);
  const [heatmap, setHeatmap] = useState<BookingHeatmapReport | null>(null);
  const [deptAlloc, setDeptAlloc] = useState<DepartmentAllocationReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [util, use, freq, retire, heat, depts] = await Promise.all([
        apiFetch<UtilizationReport>("/reports/utilization"),
        apiFetch<AssetUsageReport>("/reports/assets/usage"),
        apiFetch<MaintenanceFrequencyReport>("/reports/maintenance/frequency"),
        apiFetch<RetirementReport>("/reports/retirement"),
        apiFetch<BookingHeatmapReport>("/reports/bookings/heatmap"),
        apiFetch<DepartmentAllocationReport>("/reports/departments/allocations"),
      ]);
      setUtilization(util);
      setUsage(use);
      setMaintenance(freq);
      setRetirement(retire);
      setHeatmap(heat);
      setDeptAlloc(depts);
    } catch (err) {
      const detail = (err as { detail?: unknown })?.detail;
      setError(typeof detail === "string" ? detail : "Could not load reports");
    }
  }, []);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  const heatMax = useMemo(() => Math.max(1, ...(heatmap?.cells.map((c) => c.count) ?? [0])), [heatmap]);
  const heatLookup = useMemo(() => {
    const map = new Map<string, number>();
    for (const cell of heatmap?.cells ?? []) {
      map.set(`${cell.weekday}-${cell.hour}`, cell.count);
    }
    return map;
  }, [heatmap]);

  if (!allowed) {
    return (
      <div className="grid gap-4">
        <h1 className="text-xl font-semibold">Reports & analytics</h1>
        <EmptyState
          title="Insufficient permissions"
          description="Reports are available to admin, asset managers, and department heads."
        />
      </div>
    );
  }

  const chartData = utilization?.series ?? [];
  const lineData = (maintenance?.items ?? []).map((item) => ({
    name: item.tag,
    requests: item.request_count,
  }));

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Reports & analytics</h1>
          <p className="text-sm text-secondary">
            Utilization, usage, maintenance, retirement, booking heatmap, and department allocations.
          </p>
        </div>
        <div className="flex gap-2">
          <button className={secondaryButtonClass} type="button" onClick={() => load()}>
            Refresh
          </button>
          <button
            className={buttonClass}
            type="button"
            onClick={() => {
              const rows = [
                ...(usage?.most_used ?? []).map((item) => ({ section: "most_used", ...item })),
                ...(usage?.idle ?? []).map((item) => ({ section: "idle", ...item })),
                ...(maintenance?.items ?? []).map((item) => ({ section: "maintenance", ...item })),
                ...(retirement?.items ?? []).map((item) => ({ section: "retirement", ...item })),
                ...(deptAlloc?.items ?? []).map((item) => ({ section: "department_allocations", ...item })),
                ...(heatmap?.cells ?? []).map((item) => ({
                  section: "booking_heatmap",
                  weekday: WEEKDAYS[item.weekday] ?? item.weekday,
                  hour: item.hour,
                  count: item.count,
                })),
              ];
              downloadCsv(`assetflow-reports-${new Date().toISOString().slice(0, 10)}.csv`, rows);
            }}
          >
            Export CSV
          </button>
        </div>
      </header>

      {error ? <p className="text-sm text-red">{error}</p> : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="card-surface p-4">
          <h2 className="mb-3 text-base font-medium">Utilization (14 days)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
                />
                <Legend />
                <Bar dataKey="allocations" fill="var(--accent-blue)" radius={2} />
                <Bar dataKey="bookings" fill="var(--accent-amber)" radius={2} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card-surface p-4">
          <h2 className="mb-3 text-base font-medium">Maintenance frequency</h2>
          <div className="h-64">
            {lineData.length === 0 ? (
              <EmptyState title="No maintenance history yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
                  />
                  <Line type="monotone" dataKey="requests" stroke="var(--accent-amber)" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="card-surface p-4">
          <h2 className="mb-3 text-base font-medium">Resource booking heatmap (30 days)</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-xs">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left text-secondary">Day</th>
                  {HEAT_HOURS.map((hour) => (
                    <th key={hour} className="px-1 py-1 text-center text-secondary">
                      {String(hour).padStart(2, "0")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {WEEKDAYS.map((label, weekday) => (
                  <tr key={label}>
                    <td className="px-2 py-1 text-secondary">{label}</td>
                    {HEAT_HOURS.map((hour) => {
                      const count = heatLookup.get(`${weekday}-${hour}`) ?? 0;
                      return (
                        <td key={`${weekday}-${hour}`} className="px-1 py-1">
                          <div
                            className="grid h-7 place-items-center rounded border border-line"
                            style={{ background: heatColor(count, heatMax) }}
                            title={`${label} ${hour}:00 — ${count} bookings`}
                          >
                            {count || ""}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h2 className="mb-3 text-base font-medium">Department-wise allocations</h2>
          <DataTable headers={["Department", "Active", "Overdue"]}>
            {(deptAlloc?.items ?? []).length === 0 ? (
              <TableRow>
                <td className="px-4 py-3 text-secondary" colSpan={3}>
                  No active department allocations.
                </td>
              </TableRow>
            ) : (
              (deptAlloc?.items ?? []).map((item) => (
                <TableRow key={`${item.department_id ?? "none"}-${item.department_name}`}>
                  <td className="px-4 py-3">{item.department_name}</td>
                  <td className="px-4 py-3">{item.active_allocations}</td>
                  <td className="px-4 py-3">{item.overdue_allocations}</td>
                </TableRow>
              ))
            )}
          </DataTable>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div>
          <h2 className="mb-3 text-base font-medium">Most used</h2>
          <DataTable headers={["Asset", "Allocations", "Bookings", "Status"]}>
            {(usage?.most_used ?? []).map((item) => (
              <TableRow key={`used-${item.asset_id}`}>
                <td className="px-4 py-3">
                  {item.tag} <span className="text-secondary">{item.name}</span>
                </td>
                <td className="px-4 py-3">{item.allocation_count}</td>
                <td className="px-4 py-3">{item.booking_count}</td>
                <td className="px-4 py-3">
                  <StatusPill value={item.status} />
                </td>
              </TableRow>
            ))}
          </DataTable>
        </div>
        <div>
          <h2 className="mb-3 text-base font-medium">Idle assets</h2>
          <DataTable headers={["Asset", "Status"]}>
            {(usage?.idle ?? []).length === 0 ? (
              <TableRow>
                <td className="px-4 py-3 text-secondary" colSpan={2}>
                  No idle available assets.
                </td>
              </TableRow>
            ) : (
              (usage?.idle ?? []).map((item) => (
                <TableRow key={`idle-${item.asset_id}`}>
                  <td className="px-4 py-3">
                    {item.tag} <span className="text-secondary">{item.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill value={item.status} />
                  </td>
                </TableRow>
              ))
            )}
          </DataTable>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-medium">Due for retirement</h2>
        <DataTable headers={["Asset", "Condition", "Acquired", "Reason"]}>
          {(retirement?.items ?? []).length === 0 ? (
            <TableRow>
              <td className="px-4 py-3 text-secondary" colSpan={4}>
                No retirement candidates.
              </td>
            </TableRow>
          ) : (
            (retirement?.items ?? []).map((item) => (
              <TableRow key={item.asset_id}>
                <td className="px-4 py-3">
                  {item.tag} <span className="text-secondary">{item.name}</span>
                </td>
                <td className="px-4 py-3">
                  <StatusPill value={item.condition} />
                </td>
                <td className="px-4 py-3 text-secondary">{item.acquisition_date ?? "—"}</td>
                <td className="px-4 py-3 text-secondary">{item.reason}</td>
              </TableRow>
            ))
          )}
        </DataTable>
      </section>
    </div>
  );
}
