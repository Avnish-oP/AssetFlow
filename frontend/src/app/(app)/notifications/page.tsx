"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, TableRow } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { buttonClass, secondaryButtonClass } from "@/components/shared/FormField";
import { PageHeader, SectionHeader, SegmentedControl } from "@/components/shared/Layout";
import { StatusPill } from "@/components/shared/StatusPill";
import { apiFetch, type ActivityLog, type AppNotification } from "@/lib/api";

const TABS = [
  { id: "all", label: "All" },
  { id: "alert", label: "Alerts", types: ["overdue_return", "audit_discrepancy"] },
  { id: "approval", label: "Approvals", types: ["transfer_approved", "transfer_rejected", "maintenance_approved", "maintenance_rejected"] },
  { id: "booking", label: "Bookings", types: ["booking_confirmed", "booking_cancelled", "booking_reminder", "booking_ended"] },
  { id: "maintenance", label: "Maintenance", types: ["maintenance_approved", "maintenance_rejected", "maintenance_resolved"] },
] as const;

const POLL_MS = 25_000;

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [nextNotifications, nextActivity] = await Promise.all([
        apiFetch<AppNotification[]>("/notifications?limit=50"),
        apiFetch<ActivityLog[]>("/notifications/activity").catch(() => [] as ActivityLog[]),
      ]);
      setNotifications(nextNotifications);
      setActivity(nextActivity);
    } catch (err) {
      const detail = (err as { detail?: unknown })?.detail;
      setError(typeof detail === "string" ? detail : "Could not load notifications");
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => {
      load();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  async function markRead(id: number) {
    await apiFetch(`/notifications/${id}/read`, { method: "PATCH" });
    await load();
  }

  async function markAllRead() {
    await apiFetch("/notifications/read-all", { method: "POST" });
    await load();
  }

  const unread = notifications.filter((row) => !row.is_read).length;
  const activeTabDef = TABS.find((t) => t.id === activeTab) ?? TABS[0];
  const filteredNotifications =
    activeTab === "all" || !("types" in activeTabDef)
      ? notifications
      : notifications.filter((row) => (activeTabDef as { types: readonly string[] }).types.includes(row.type));

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Activity & notifications"
        description={`Polling every 25 seconds. ${unread} unread.`}
        actions={
          <>
          <button className={secondaryButtonClass} type="button" onClick={() => load()}>
            Refresh
          </button>
          <button className={buttonClass} type="button" onClick={() => markAllRead()} disabled={unread === 0}>
            Mark all read
          </button>
          </>
        }
      />

      {error ? <p className="text-sm text-red">{error}</p> : null}

      <section>
        <SectionHeader
          title="Notifications"
          actions={
            <SegmentedControl
              value={activeTab}
              options={TABS}
              onChange={setActiveTab}
              getBadge={(tab) =>
                tab === "all" && unread > 0 ? (
                  <span className="ml-1.5 rounded-full bg-red px-1.5 py-0.5 text-[10px] text-white">{unread}</span>
                ) : null
              }
            />
          }
        />
        {filteredNotifications.length === 0 ? (
          <EmptyState title="No notifications in this category" description="Switch to All to see everything." />
        ) : (
          <DataTable headers={["Message", "Type", "Status", "When", ""]}>
            {filteredNotifications.map((row) => (
              <TableRow key={row.id} className={row.is_read ? "" : "bg-green-bg/20"}>
                <td className="px-4 py-3">{row.message}</td>
                <td className="px-4 py-3">
                  <StatusPill value={row.type} />
                </td>
                <td className="px-4 py-3 text-secondary">{row.is_read ? "Read" : "Unread"}</td>
                <td className="px-4 py-3 text-secondary">{new Date(row.created_at).toLocaleString()}</td>
                <td className="px-4 py-3">
                  {!row.is_read ? (
                    <button className="text-xs text-green hover:underline" type="button" onClick={() => markRead(row.id)}>
                      Mark read
                    </button>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
              </TableRow>
            ))}
          </DataTable>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-medium">Activity log</h2>
        {activity.length === 0 ? (
          <EmptyState title="No activity yet" description="Managers see a cross-system activity stream here." />
        ) : (
          <DataTable headers={["Action", "Entity", "Actor", "When"]}>
            {activity.map((row) => (
              <TableRow key={row.id}>
                <td className="px-4 py-3">{row.action.replaceAll("_", " ")}</td>
                <td className="px-4 py-3 text-secondary">
                  {row.entity_type}
                  {row.entity_id != null ? ` #${row.entity_id}` : ""}
                </td>
                <td className="px-4 py-3 text-secondary">{row.actor_name ?? (row.actor_id ? `#${row.actor_id}` : "system")}</td>
                <td className="px-4 py-3 text-secondary">{new Date(row.created_at).toLocaleString()}</td>
              </TableRow>
            ))}
          </DataTable>
        )}
      </section>
    </div>
  );
}
