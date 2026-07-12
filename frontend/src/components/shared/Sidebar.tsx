"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

const items = [
  ["Dashboard", "/dashboard"],
  ["Organization Setup", "/org-setup"],
  ["Assets", "/assets"],
  ["Allocation & Transfer", "/allocations"],
  ["Resource Booking", "/bookings"],
  ["Maintenance", "/maintenance"],
  ["Audit", "/audits"],
  ["Reports", "/reports"],
  ["Notifications", "/notifications"],
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Toggle navigation"
        aria-expanded={open}
        className="fixed left-4 top-4 z-50 grid size-10 place-items-center rounded-lg border border-line bg-surface text-heading shadow-sm lg:hidden"
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      {open && <button type="button" aria-label="Close navigation" className="fixed inset-0 z-30 bg-primary/20 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[248px] -translate-x-full flex-col border-r border-line bg-surface shadow-xl transition-transform lg:translate-x-0 lg:shadow-none ${open ? "translate-x-0" : ""}`}>
      <div className="border-b border-line px-4 py-5">
        <div className="text-xl font-semibold text-heading">AssetFlow</div>
        <div className="text-xs text-secondary">Operations console</div>
      </div>
      <nav className="flex-1 space-y-1 px-2 py-4">
        {items.map(([label, href]) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-md border-l-[3px] px-3 py-2.5 text-sm transition ${
                active ? "border-heading bg-raised text-primary" : "border-transparent text-secondary hover:bg-raised hover:text-primary"
              }`}
            >
              <NavIcon label={label} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-line p-4">
        <div className="truncate text-sm text-primary">{user?.name ?? "Demo user"}</div>
        <div className="truncate text-xs text-secondary">{user?.role ?? "employee"}</div>
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

function NavIcon({ label }: { label: string }) {
  const paths: Record<string, React.ReactNode> = {
    Dashboard: <path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z" />,
    Assets: <path d="M4 7h16v13H4V7Zm3-3h10v3H7V4Zm2 7h6m-6 4h6" />,
    Notifications: <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-4 shrink-0" aria-hidden="true">{paths[label] ?? <path d="M5 4h14v16H5zM8 8h8m-8 4h8m-8 4h5" />}</svg>;
}

