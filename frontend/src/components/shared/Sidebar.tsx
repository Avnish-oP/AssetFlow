"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeSwitcher } from "@/components/shared/ThemeSwitcher";
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
      <button
        type="button"
        aria-label="Toggle navigation"
        aria-expanded={open}
        className="fixed left-4 top-4 z-50 grid size-11 place-items-center rounded-2xl border border-line bg-surface/95 text-primary shadow-[var(--shadow-pin)] backdrop-blur lg:hidden"
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      {open ? (
        <button type="button" aria-label="Close navigation" className="fixed inset-0 z-30 bg-primary/25 backdrop-blur-[1px] lg:hidden" onClick={() => setOpen(false)} />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[260px] -translate-x-full flex-col border-r border-line bg-surface/95 shadow-[var(--shadow-pin)] backdrop-blur-md transition-transform duration-300 lg:translate-x-0 ${
          open ? "translate-x-0" : ""
        }`}
      >
        <div className="border-b border-line px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center overflow-hidden rounded-xl bg-brand-bg">
              <img src="/logo.svg" alt="" className="h-7 w-auto" />
            </div>
            <div>
              <div className="font-display text-[1.2rem] leading-none tracking-tight text-primary">
                Asset<span className="text-brand">Flow</span>
              </div>
              <div className="mt-1 text-[11px] text-muted">Enterprise console</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {items
            .filter((item) => canSeeNav(user?.role, item.href))
            .map((item) => {
              const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] transition ${
                    active
                      ? "bg-brand-bg font-medium text-brand"
                      : "text-secondary hover:bg-raised hover:text-primary"
                  }`}
                >
                  {active ? <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-brand" aria-hidden /> : null}
                  <span className={active ? "text-brand" : "text-muted"}>{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {item.href === "/notifications" && unread > 0 ? (
                    <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-brand">{unread}</span>
                  ) : null}
                </Link>
              );
            })}
        </nav>

        <div className="border-t border-line p-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-bg text-xs font-semibold text-brand">
                {initials(user?.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-primary">{user?.name ?? "Demo user"}</div>
                <div className="truncate text-[11px] capitalize text-secondary">
                  {user?.role ?? "employee"}
                </div>
              </div>
            </div>
            
            <div className="flex shrink-0 items-center gap-1.5">
              <ThemeSwitcher compact />
              <button
                className="flex size-8 items-center justify-center rounded-[var(--radius-control)] border border-transparent text-secondary transition hover:border-line-strong hover:bg-raised hover:text-primary"
                onClick={() => {
                  logout();
                  router.push("/login");
                }}
                title="Sign out"
              >
                <svg viewBox="0 0 16 16" fill="none" className="size-3.5" aria-hidden="true">
                  <path d="M6 14H3a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M11 11.5l3.5-3.5L11 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M14.5 8H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
