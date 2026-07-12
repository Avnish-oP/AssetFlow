"use client";

import { useEffect, useMemo, useState } from "react";
import { DataTable, TableRow } from "@/components/shared/DataTable";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusPill } from "@/components/shared/StatusPill";
import {
  apiFetch,
  type Allocation,
  type Asset,
  type Booking,
  type TransferRequest,
  type User,
} from "@/lib/api";

export default function DashboardPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<Asset[]>("/assets").catch(() => [] as Asset[]),
      apiFetch<Allocation[]>("/allocations?status=active").catch(() => [] as Allocation[]),
      apiFetch<Booking[]>("/bookings").catch(() => [] as Booking[]),
      apiFetch<TransferRequest[]>("/transfers").catch(() => [] as TransferRequest[]),
      apiFetch<User[]>("/employees").catch(() => [] as User[]),
    ]).then(([nextAssets, nextAllocations, nextBookings, nextTransfers, nextEmployees]) => {
      setAssets(nextAssets);
      setAllocations(nextAllocations);
      setBookings(nextBookings);
      setTransfers(nextTransfers);
      setEmployees(nextEmployees);
      setLoading(false);
    });
  }, []);

  const kpis = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const weekAhead = new Date();
    weekAhead.setDate(weekAhead.getDate() + 7);
    const weekIso = weekAhead.toISOString().slice(0, 10);

    return [
      {
        label: "Available assets",
        value: assets.filter((asset) => asset.status === "available").length,
        accentColor: "green" as const,
      },
      {
        label: "Allocated assets",
        value: assets.filter((asset) => asset.status === "allocated").length,
        accentColor: "blue" as const,
      },
      {
        label: "Under maintenance",
        value: assets.filter((asset) => asset.status === "maintenance").length,
        accentColor: "amber" as const,
      },
      {
        label: "Bookings today",
        value: bookings.filter((booking) => booking.start.slice(0, 10) === today && booking.status !== "cancelled").length,
        accentColor: "blue" as const,
      },
      {
        label: "Pending transfers",
        value: transfers.filter((transfer) => transfer.status === "requested" || transfer.status === "approved").length,
        accentColor: "amber" as const,
      },
      {
        label: "Due this week",
        value: allocations.filter(
          (allocation) =>
            allocation.expected_return_date &&
            allocation.expected_return_date >= today &&
            allocation.expected_return_date <= weekIso,
        ).length,
        accentColor: "red" as const,
      },
    ];
  }, [assets, allocations, bookings, transfers]);

  const upcomingReturns = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return [...allocations]
      .filter((allocation) => allocation.expected_return_date)
      .sort((a, b) => String(a.expected_return_date).localeCompare(String(b.expected_return_date)))
      .slice(0, 8)
      .map((allocation) => {
        const asset = assets.find((row) => row.id === allocation.asset_id);
        const holder = employees.find((row) => row.id === allocation.holder_user_id);
        const due = allocation.expected_return_date!;
        const overdue = due < today;
        return {
          id: allocation.id,
          asset: asset ? `${asset.tag} ${asset.name}` : `Asset #${allocation.asset_id}`,
          holder: holder?.name ?? (allocation.holder_user_id ? `#${allocation.holder_user_id}` : "—"),
          due,
          status: overdue ? "overdue" : "active",
        };
      });
  }, [allocations, assets, employees]);

  const recentActivity = useMemo(() => {
    const rows: { event: string; actor: string; status: string }[] = [];
    for (const transfer of transfers.slice(0, 5)) {
      const asset = assets.find((row) => row.id === transfer.asset_id);
      rows.push({
        event: `Transfer ${asset?.tag ?? transfer.asset_id}`,
        actor: employees.find((row) => row.id === transfer.requested_by)?.name ?? `#${transfer.requested_by}`,
        status: transfer.status,
      });
    }
    for (const booking of bookings.slice(0, 3)) {
      const asset = assets.find((row) => row.id === booking.resource_id);
      rows.push({
        event: `${asset?.tag ?? `Resource #${booking.resource_id}`} booked`,
        actor: employees.find((row) => row.id === booking.booked_by)?.name ?? `#${booking.booked_by}`,
        status: booking.status,
      });
    }
    return rows.slice(0, 8);
  }, [transfers, bookings, assets, employees]);

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-secondary">
          {loading ? "Loading operational status…" : "Live operational status across assets, bookings, and returns."}
        </p>
      </header>
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} accentColor={kpi.accentColor} />
        ))}
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-line bg-surface-raised p-4 sm:p-5">
          <h2 className="mb-3 text-base font-medium">Recent activity</h2>
          <DataTable headers={["Event", "Actor", "Status"]}>
            {recentActivity.length === 0 ? (
              <TableRow>
                <td className="px-4 py-3 text-secondary" colSpan={3}>
                  No recent transfers or bookings yet.
                </td>
              </TableRow>
            ) : (
              recentActivity.map((row, index) => (
                <TableRow key={`${row.event}-${index}`}>
                  <td className="px-4 py-3">{row.event}</td>
                  <td className="px-4 py-3 text-secondary">{row.actor}</td>
                  <td className="px-4 py-3">
                    <StatusPill value={row.status} />
                  </td>
                </TableRow>
              ))
            )}
          </DataTable>
        </div>
        <div className="min-w-0 rounded-xl border border-line bg-surface-raised p-4 sm:p-5">
          <h2 className="mb-3 text-base font-medium">Upcoming returns</h2>
          <DataTable headers={["Asset", "Holder", "Due", "Status"]}>
            {upcomingReturns.length === 0 ? (
              <TableRow>
                <td className="px-4 py-3 text-secondary" colSpan={4}>
                  No upcoming returns scheduled.
                </td>
              </TableRow>
            ) : (
              upcomingReturns.map((row) => (
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
    </div>
  );
}
