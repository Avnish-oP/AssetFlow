"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, TableRow } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { KpiCard } from "@/components/shared/KpiCard";
import { PageHeader } from "@/components/shared/PageHeader";
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
  const canWriteAssets = can(user?.role, "assets_write");
  const canRaise = can(user?.role, "maintenance_raise");
  const canBook = can(user?.role, "bookings");
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
    <div className="grid gap-7 pt-14 lg:pt-0">
      <PageHeader
        title="Dashboard"
        description={
          loading
            ? "Loading operational status…"
            : canSeeKpis
              ? "Your live ops board — KPIs refresh every 25s."
              : "Notifications and returns for your account. Full KPIs require manager access."
        }
        meta={
          summary
            ? `${summary.overdue_allocations} overdue · ${summary.returned_this_week} returned this week · ${summary.unread_notifications} unread`
            : undefined
        }
        actions={
          <>
            <button className={secondaryButtonClass} type="button" onClick={() => load()}>
              Refresh
            </button>
            {canSeeKpis ? (
              <a className={buttonClass} href="/reports">
                Open reports
              </a>
            ) : null}
          </>
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
        {canWriteAssets ? (
          <a className={buttonClass} href="/assets">
            + Register asset
          </a>
        ) : null}
        {canBook ? (
          <a className={secondaryButtonClass} href="/bookings">
            Book resource
          </a>
        ) : null}
        {canRaise ? (
          <a className={secondaryButtonClass} href="/maintenance">
            Raise maintenance
          </a>
        ) : null}
      </section>

      <section className="pin-board">
        <div className="pin-item card-surface pin-wash-sky p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-xl tracking-tight">Unread notifications</h2>
            <a href="/notifications" className="text-xs font-medium text-secondary hover:text-primary">
              View all
            </a>
          </div>
          {notifications.length === 0 ? (
            <EmptyState title="No unread notifications" description="Workflow events will appear here." />
          ) : (
            <ul className="space-y-3">
              {notifications.map((row) => (
                <li key={row.id} className="rounded-2xl border border-line/80 bg-surface/80 p-3.5 shadow-[var(--shadow-sm)]">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm leading-snug text-primary">{row.message}</p>
                    <StatusPill value={row.type} />
                  </div>
                  <p className="mt-2 text-[11px] text-muted">{new Date(row.created_at).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="pin-item card-surface pin-wash-sand p-5">
          <h2 className="mb-4 font-display text-xl tracking-tight">Upcoming returns</h2>
          {returns.length === 0 ? (
            <p className="text-sm text-secondary">No upcoming returns scheduled.</p>
          ) : (
            <ul className="space-y-3">
              {returns.map((row) => (
                <li
                  key={row.id}
                  className={`rounded-2xl border border-line/80 bg-surface/80 p-3.5 shadow-[var(--shadow-sm)] ${
                    row.status === "overdue" ? "border-red/20 bg-red-bg/40" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-primary">{row.asset}</p>
                      <p className="mt-0.5 text-xs text-secondary">{row.holder}</p>
                    </div>
                    <StatusPill value={row.status} />
                  </div>
                  <p className="mt-2 text-[11px] tabular-nums text-muted">Due {row.due}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="pin-item card-surface pin-wash-mist p-5">
          <h2 className="mb-2 font-display text-xl tracking-tight">Quick lane</h2>
          <p className="mb-4 text-sm text-secondary">Jump into the workflows you use most.</p>
          <div className="flex flex-col gap-2">
            {canWriteAssets ? (
              <a className={buttonClass} href="/assets">
                Register asset
              </a>
            ) : null}
            {canBook ? (
              <a className={secondaryButtonClass} href="/bookings">
                Book resource
              </a>
            ) : null}
            {canRaise ? (
              <a className={secondaryButtonClass} href="/maintenance">
                Raise maintenance
              </a>
            ) : null}
            {canSeeKpis ? (
              <a className={secondaryButtonClass} href="/reports">
                Browse reports
              </a>
            ) : null}
          </div>
          {!canWriteAssets && !canBook && !canRaise && !canSeeKpis ? (
            <DataTable headers={["Hint"]}>
              <TableRow>
                <td className="px-4 py-3 text-secondary">Your role has view access — check notifications for updates.</td>
              </TableRow>
            </DataTable>
          ) : null}
        </div>
      </section>
    </div>
  );
}
