"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, TableRow } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusPill } from "@/components/shared/StatusPill";
import { buttonClass, secondaryButtonClass } from "@/components/shared/FormField";
import {
  apiFetch,
  type Allocation,
  type AppNotification,
  type Asset,
  type DashboardSummary,
  type User,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/roles";

const POLL_MS = 25_000;

export default function DashboardPage() {
  const { user } = useAuth();
  const canSeeKpis = can(user?.role, "dashboard_kpis");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [returns, setReturns] = useState<
    { id: number; asset: string; holder: string; due: string; status: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [nextSummary, nextNotifications, allocations, assets, employees] = await Promise.all([
      canSeeKpis ? apiFetch<DashboardSummary>("/reports/summary").catch(() => null) : Promise.resolve(null),
      apiFetch<AppNotification[]>("/notifications?unread_only=true&limit=5").catch(() => [] as AppNotification[]),
      apiFetch<Allocation[]>("/allocations?status=active").catch(() => [] as Allocation[]),
      apiFetch<Asset[]>("/assets").catch(() => [] as Asset[]),
      apiFetch<User[]>("/employees").catch(() => [] as User[]),
    ]);

    if (nextSummary) setSummary(nextSummary);
    else if (!canSeeKpis) setSummary(null);
    setNotifications(nextNotifications);

    const today = new Date().toISOString().slice(0, 10);
    const upcoming = [...allocations]
      .filter((row) => row.expected_return_date)
      .sort((a, b) => String(a.expected_return_date).localeCompare(String(b.expected_return_date)))
      .slice(0, 8)
      .map((allocation) => {
        const asset = assets.find((row) => row.id === allocation.asset_id);
        const holder = employees.find((row) => row.id === allocation.holder_user_id);
        const due = allocation.expected_return_date!;
        return {
          id: allocation.id,
          asset: asset ? `${asset.tag} ${asset.name}` : `Asset #${allocation.asset_id}`,
          holder: holder?.name ?? (allocation.holder_user_id ? `#${allocation.holder_user_id}` : "—"),
          due,
          status: due < today || allocation.status === "overdue" ? "overdue" : "active",
        };
      });
    setReturns(upcoming);
    setLoading(false);
  }, [canSeeKpis]);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => {
      load();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const kpis = summary
    ? [
        { label: "Available assets", value: summary.available, accentColor: "green" as const },
        { label: "Allocated assets", value: summary.allocated, accentColor: "blue" as const },
        { label: "Under maintenance", value: summary.maintenance, accentColor: "amber" as const },
        { label: "Bookings today", value: summary.bookings_today, accentColor: "blue" as const },
        { label: "Pending transfers", value: summary.pending_transfers, accentColor: "amber" as const },
        { label: "Due this week", value: summary.due_this_week, accentColor: "red" as const },
      ]
    : [];

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-secondary">
            {loading
              ? "Loading operational status…"
              : canSeeKpis
                ? "Live KPIs from /reports — refreshes every 25s."
                : "Notifications and returns for your account. Full KPIs require manager access."}
          </p>
        </div>
        {summary ? (
          <div className="text-xs text-secondary">
            {summary.overdue_allocations} overdue · {summary.returned_this_week} returned this week ·{" "}
            {summary.unread_notifications} unread
          </div>
        ) : null}
      </header>

      {canSeeKpis ? (
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} accentColor={kpi.accentColor} />
        ))}
      </section>
      ) : (
        <EmptyState
          title="KPI dashboard requires manager access"
          description="Employees still see notifications and upcoming returns below."
        />
      )}

      <section className="grid gap-6 xl:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-medium">Unread notifications</h2>
            <a href="/notifications" className="text-xs text-secondary hover:text-primary">
              View all
            </a>
          </div>
          {notifications.length === 0 ? (
            <EmptyState title="No unread notifications" description="Workflow events will appear here." />
          ) : (
            <DataTable headers={["Message", "Type", "When"]}>
              {notifications.map((row) => (
                <TableRow key={row.id}>
                  <td className="px-4 py-3">{row.message}</td>
                  <td className="px-4 py-3">
                    <StatusPill value={row.type} />
                  </td>
                  <td className="px-4 py-3 text-secondary">{new Date(row.created_at).toLocaleString()}</td>
                </TableRow>
              ))}
            </DataTable>
          )}
        </div>
        <div>
          <h2 className="mb-3 text-base font-medium">Upcoming returns</h2>
          <DataTable headers={["Asset", "Holder", "Due", "Status"]}>
            {returns.length === 0 ? (
              <TableRow>
                <td className="px-4 py-3 text-secondary" colSpan={4}>
                  No upcoming returns scheduled.
                </td>
              </TableRow>
            ) : (
              returns.map((row) => (
                <TableRow key={row.id} className={row.status === "overdue" ? "bg-red-bg/30" : ""}>
                  <td className="px-4 py-3">{row.asset}</td>
                  <td className="px-4 py-3 text-secondary">{row.holder}</td>
                  <td className="px-4 py-3 text-secondary">{row.due}</td>
                  <td className="px-4 py-3">
                    <StatusPill value={row.status} />
                  </td>
                </TableRow>
              ))
            )}
          </DataTable>
        </div>
      </section>

      <div className="flex gap-2">
        <button className={secondaryButtonClass} type="button" onClick={() => load()}>
          Refresh now
        </button>
        {canSeeKpis ? (
          <a className={buttonClass} href="/reports">
            Open reports
          </a>
        ) : null}
      </div>
    </div>
  );
}
