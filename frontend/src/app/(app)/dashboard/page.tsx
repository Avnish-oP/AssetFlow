"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DataTable, TableRow } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { KpiCard } from "@/components/shared/KpiCard";
import { PageHeader, Panel, SectionHeader } from "@/components/shared/Layout";import { StatusPill } from "@/components/shared/StatusPill";
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
  const canWriteAssets = can(user?.role, "assets_write");
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
        { label: "Assets Available", value: summary.available, accentColor: "blue" as const },
        { label: "Assets Allocated", value: summary.allocated, accentColor: "blue" as const },
        { label: "Maintenance Today", value: summary.maintenance, accentColor: "amber" as const },
        { label: "Active Bookings", value: summary.bookings_today, accentColor: "blue" as const },
        { label: "Pending Transfers", value: summary.pending_transfers, accentColor: "amber" as const },
        { label: "Upcoming Returns", value: summary.due_this_week, accentColor: "red" as const },
      ]
    : [];

  return (
    <div className="mx-auto grid max-w-[1600px] gap-6">      <PageHeader
        title="Dashboard"
        description={
          loading
            ? "Loading operational status..."
            : canSeeKpis
              ? "Live KPIs from reports, refreshed every 25 seconds."
              : "Notifications and returns for your account. Full KPIs require manager access."
        }
        status={
          summary ? (
            <span className="text-xs text-secondary">
              {summary.overdue_allocations} overdue · {summary.returned_this_week} returned this week ·{" "}
              {summary.unread_notifications} unread
            </span>
          ) : null        }
        actions={
          <>
            <button className={secondaryButtonClass} type="button" onClick={() => load()}>
              Refresh
            </button>
            {canWriteAssets ? <Link className={buttonClass} href="/assets">Register asset</Link> : null}
            {canSeeKpis ? <Link className={buttonClass} href="/reports">Open reports</Link> : null}          </>
        }
      />

      {canSeeKpis ? (
        <section className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} accentColor={kpi.accentColor} />
          ))}
        </section>
      ) : (
        <EmptyState
          title="KPI board requires manager access"
          description="Employees still see notifications and upcoming returns below."
        />
      )}

      {summary && summary.overdue_allocations > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[20px] border border-red/15 bg-red-bg px-5 py-4 text-sm shadow-[var(--shadow-sm)]">
          <span className="font-medium text-red">{summary.overdue_allocations} assets overdue for return</span>
          <span className="text-secondary">— pinned for follow-up</span>
        </div>
      ) : null}

      <section className="flex flex-wrap gap-2">
        {can(user?.role, "bookings") ? (          <a className={secondaryButtonClass} href="/bookings">
            Book resource
          </a>
        ) : null}
        {can(user?.role, "maintenance_raise") ? (          <a className={secondaryButtonClass} href="/maintenance">
            Raise maintenance
          </a>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel>
          <SectionHeader
            title="Unread notifications"
            actions={<a href="/notifications" className="text-xs text-secondary hover:text-primary">View all</a>}
          />
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
        </Panel>
        <Panel>
          <SectionHeader title="Upcoming returns" />
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
        </Panel>      </section>
    </div>
  );
}
