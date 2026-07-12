"use client";

import { useEffect, useMemo, useState } from "react";

import { DataTable, TableRow } from "@/components/shared/DataTable";
import { secondaryButtonClass } from "@/components/shared/FormField";
import { StatusPill } from "@/components/shared/StatusPill";
import { apiFetch, type NotificationItem } from "@/lib/api";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const loadNotifications = async () => {
      try {
        const items = await apiFetch<NotificationItem[]>('/notifications?limit=100');
        if (!alive) {
          return;
        }
        setNotifications(items);
        setLoading(false);
        setError(null);
      } catch {
        if (!alive) {
          return;
        }
        setError('Could not load notifications.');
        setLoading(false);
      }
    };

    void loadNotifications();
    const interval = window.setInterval(() => {
      void loadNotifications();
    }, 30000);

    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, []);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.is_read).length, [notifications]);

  async function markRead(notificationId: number) {
    await apiFetch<NotificationItem>(`/notifications/${notificationId}/read`, { method: 'PATCH' });
    setNotifications((current) => current.map((item) => (item.id === notificationId ? { ...item, is_read: true } : item)));
  }

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Notifications</h1>
          <p className="text-sm text-secondary">
            {loading ? 'Loading notification feed…' : `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}.`}
          </p>
        </div>
        <button type="button" className={secondaryButtonClass} onClick={() => window.location.reload()}>
          Refresh now
        </button>
      </header>

      {error ? <p className="rounded-lg border border-red bg-red-bg px-4 py-3 text-sm text-red">{error}</p> : null}

      <DataTable headers={["Type", "Message", "Recipient", "Status", "Created", "Action"]}>
        {notifications.length === 0 ? (
          <TableRow>
            <td className="px-4 py-3 text-secondary" colSpan={6}>
              No notifications yet. The overdue scanner will populate this feed when it flags stale allocations or bookings.
            </td>
          </TableRow>
        ) : (
          notifications.map((notification) => (
            <TableRow key={notification.id} className={notification.is_read ? 'opacity-70' : ''}>
              <td className="px-4 py-3">
                <StatusPill value={notification.type} />
              </td>
              <td className="px-4 py-3 text-secondary">{notification.message}</td>
              <td className="px-4 py-3">
                <div className="font-medium text-primary">{notification.user_name ?? `User #${notification.user_id}`}</div>
                <div className="text-xs text-muted">{notification.user_email}</div>
              </td>
              <td className="px-4 py-3">
                <StatusPill value={notification.is_read ? 'read' : 'unread'} />
              </td>
              <td className="px-4 py-3 text-secondary">{new Date(notification.created_at).toLocaleString()}</td>
              <td className="px-4 py-3">
                {!notification.is_read ? (
                  <button type="button" className={secondaryButtonClass} onClick={() => void markRead(notification.id)}>
                    Mark read
                  </button>
                ) : (
                  <span className="text-xs text-muted">Done</span>
                )}
              </td>
            </TableRow>
          ))
        )}
      </DataTable>
    </div>
  );
}

