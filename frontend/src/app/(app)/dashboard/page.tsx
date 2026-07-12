"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { KpiCard } from "@/components/shared/KpiCard";
import { buttonClass, secondaryButtonClass } from "@/components/shared/FormField";
import { StatusPill } from "@/components/shared/StatusPill";
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
      apiFetch<AppNotification[]>("/notifications?unread_only=true&limit=8").catch(() => [] as AppNotification[]),
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
    <div className="grid gap-6 pt-14 lg:pt-0">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-[1.85rem] leading-tight tracking-tight text-primary sm:text-[2rem]">
            Dashboard
          </h1>
          <p className="mt-2 text-sm text-secondary">
            {loading
              ? "Loading operational status…"
              : canSeeKpis
                ? "Your live ops board — KPIs refresh every 25s."
                : "Notifications and returns for your account. Full KPIs require manager access."}
          </p>
          {summary ? (
            <p className="mt-1.5 text-xs text-muted">
              {summary.overdue_allocations} overdue · {summary.returned_this_week} returned this week ·{" "}
              {summary.unread_notifications} unread
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className={secondaryButtonClass} type="button" onClick={() => load()}>
            Refresh
          </button>
          {canSeeKpis ? (
            <Link className={buttonClass} href="/reports">
              Open reports
            </Link>
          ) : null}
        </div>
      </header>

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
        <div className="flex flex-wrap items-center gap-2 rounded-[18px] border border-red/15 bg-red-bg px-5 py-3.5 text-sm">
          <span className="font-medium text-red">{summary.overdue_allocations} assets overdue for return</span>
          <span className="text-secondary">— flagged for follow-up</span>
        </div>
      ) : null}

      <section className="flex flex-wrap gap-2">
        {canWriteAssets ? (
          <Link className={buttonClass} href="/assets">
            + Register asset
          </Link>
        ) : null}
        {canBook ? (
          <Link className={secondaryButtonClass} href="/bookings">
            Book resource
          </Link>
        ) : null}
        {canRaise ? (
          <Link className={secondaryButtonClass} href="/maintenance">
            Raise maintenance
          </Link>
        ) : null}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="card-surface pin-wash-sky min-w-0 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-xl tracking-tight text-primary">Unread notifications</h2>
            <Link href="/notifications" className="text-xs font-medium text-secondary hover:text-primary">
              View all
            </Link>
          </div>
          {notifications.length === 0 ? (
            <EmptyState title="No unread notifications" description="Workflow events will appear here." />
          ) : (
            <ul className="space-y-3">
              {notifications.map((row) => (
                <li
                  key={row.id}
                  className="rounded-2xl border border-line/80 bg-surface/90 p-3.5 shadow-[var(--shadow-sm)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 text-sm leading-snug text-primary">{row.message}</p>
                    <StatusPill value={row.type} />
                  </div>
                  <p className="mt-2 text-[11px] text-muted">{new Date(row.created_at).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid min-w-0 gap-5 content-start">
          <div className="card-surface pin-wash-sand p-5">
            <h2 className="mb-4 font-display text-xl tracking-tight text-primary">Upcoming returns</h2>
            {returns.length === 0 ? (
              <p className="text-sm text-secondary">No upcoming returns scheduled.</p>
            ) : (
              <ul className="space-y-3">
                {returns.map((row) => (
                  <li
                    key={row.id}
                    className={`rounded-2xl border border-line/80 bg-surface/90 p-3.5 shadow-[var(--shadow-sm)] ${
                      row.status === "overdue" ? "border-red/20 bg-red-bg/40" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
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

          <div className="card-surface pin-wash-mist p-5">
            <h2 className="font-display text-xl tracking-tight text-primary">Quick lane</h2>
            <p className="mt-1 mb-4 text-sm text-secondary">Jump into the workflows you use most.</p>
            <div className="flex flex-col gap-2">
              {canWriteAssets ? (
                <Link className={buttonClass} href="/assets">
                  Register asset
                </Link>
              ) : null}
              {canBook ? (
                <Link className={secondaryButtonClass} href="/bookings">
                  Book resource
                </Link>
              ) : null}
              {canRaise ? (
                <Link className={secondaryButtonClass} href="/maintenance">
                  Raise maintenance
                </Link>
              ) : null}
              {canSeeKpis ? (
                <Link className={secondaryButtonClass} href="/reports">
                  Browse reports
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
