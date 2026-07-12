"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { apiFetch, type AppNotification } from "@/lib/api";
import { canSeeNav } from "@/lib/roles";

const items: { label: string; href: string; icon: React.ReactNode }[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
        <path d="M2 2h5v5H2V2Zm7 0h5v3H9V2ZM2 9h5v5H2V9Zm7-2h5v7H9V7Z" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
  },
  {
    label: "Organization Setup",
    href: "/org-setup",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
        <path d="M2.5 13.5V6L8 2.5 13.5 6v7.5H9.5V9H6.5v4.5H2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Assets",
    href: "/assets",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
        <path d="M3 4.5 8 2l5 2.5v7L8 14l-5-2.5v-7Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M3 4.5 8 7l5-2.5M8 7v7" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
  },
  {
    label: "Allocation & Transfer",
    href: "/allocations",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
        <path d="M2 5h9M8 2l3 3-3 3M14 11H5M8 8l-3 3 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Resource Booking",
    href: "/bookings",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
        <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Maintenance",
    href: "/maintenance",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
        <path d="M10.5 2.5a3 3 0 0 1 3 3L9.8 9.2 6.8 6.2l3.7-3.7ZM6.2 7.2 2.5 13.5l6.3-3.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Audit",
    href: "/audits",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
        <path d="M4 2.5h6.5L13 5v8.5H4v-11Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M10.5 2.5V5H13M6 8h4M6 10.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Reports",
    href: "/reports",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
        <path d="M3 12.5V8.5M7 12.5V5.5M11 12.5V3.5M2 13.5h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Notifications",
    href: "/notifications",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
        <path d="M4 6.5a4 4 0 1 1 8 0c0 2.2 1 3.2 1 3.2H3S4 8.7 4 6.5ZM6.5 13h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

function initials(name?: string) {
  if (!name) return "U";
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = () => {
      apiFetch<AppNotification[]>("/notifications?unread_only=true&limit=50")
        .then((rows) => {
          if (!cancelled) setUnread(rows.length);
        })
        .catch(() => {
          if (!cancelled) setUnread(0);
        });
    };
    load();
    const timer = window.setInterval(load, 25_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [user]);

  return (
    <>
      <button type="button" aria-label="Toggle navigation" aria-expanded={open} className="fixed left-4 top-4 z-50 grid size-10 place-items-center rounded-lg border border-line bg-surface text-heading shadow-sm lg:hidden" onClick={() => setOpen((value) => !value)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg></button>
      {open && <button type="button" aria-label="Close navigation" className="fixed inset-0 z-30 bg-primary/20 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[248px] -translate-x-full flex-col border-r border-line bg-surface shadow-xl transition-transform lg:translate-x-0 lg:shadow-none ${open ? "translate-x-0" : ""}`}>
      <div className="border-b border-line px-4 py-5">
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-amber-bg text-xs font-semibold text-heading">AF</div>
          <div>
            <div className="text-lg font-semibold leading-tight text-heading">AssetFlow</div>
            <div className="text-xs text-secondary">Operations console</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-2 py-4">
        {items
          .filter((item) => canSeeNav(user?.role, item.href))
          .map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2.5 border-l-[3px] px-3 py-2 text-sm transition ${
                active
                  ? "rounded-r-md border-heading bg-raised text-primary"
                  : "rounded-md border-transparent text-secondary hover:bg-raised hover:text-primary"
              }`}
            >
              <span className={active ? "text-heading" : "text-muted"}>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.href === "/notifications" && unread > 0 ? (
                <span className="rounded-full bg-green-bg px-1.5 py-0.5 text-[10px] font-medium text-green">
                  {unread}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-line p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-green-bg text-xs font-semibold text-green">
            {initials(user?.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-primary">{user?.name ?? "Demo user"}</div>
            <span className="mt-0.5 inline-flex rounded-full border border-line bg-raised px-2 py-0.5 text-[11px] text-secondary">
              {user?.role ?? "employee"}
            </span>
          </div>
        </div>
        <button
          className="mt-3 text-xs text-secondary hover:text-primary"
          onClick={() => {
            logout();
            router.push("/login");
          }}
        >
          Sign out
        </button>
      </div>
      </aside>
    </>
  );
}
