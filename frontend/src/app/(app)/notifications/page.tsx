"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, TableRow } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { buttonClass, secondaryButtonClass } from "@/components/shared/FormField";
import { StatusPill } from "@/components/shared/StatusPill";
import { apiFetch, type ActivityLog, type AppNotification } from "@/lib/api";

const POLL_MS = 25_000;

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Activity & notifications</h1>
          <p className="text-sm text-secondary">Polling every 25s. {unread} unread.</p>
        </div>
        <div className="flex gap-2">
          <button className={secondaryButtonClass} type="button" onClick={() => load()}>
            Refresh
          </button>
          <button className={buttonClass} type="button" onClick={() => markAllRead()} disabled={unread === 0}>
            Mark all read
          </button>
        </div>
      </header>

      {error ? <p className="text-sm text-red">{error}</p> : null}

      <section>
        <h2 className="mb-3 text-base font-medium">Notifications</h2>
        {notifications.length === 0 ? (
          <EmptyState title="No notifications yet" description="Allocate, transfer, book, or raise maintenance to generate events." />
        ) : (
          <DataTable headers={["Message", "Type", "Status", "When", ""]}>
            {notifications.map((row) => (
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
                <td className="px-4 py-3 text-secondary">{row.actor_id ?? "system"}</td>
                <td className="px-4 py-3 text-secondary">{new Date(row.created_at).toLocaleString()}</td>
              </TableRow>
            ))}
          </DataTable>
        )}
      </section>
    </div>
  );
}
