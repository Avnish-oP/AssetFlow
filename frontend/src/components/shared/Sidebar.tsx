"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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

  return (
    <aside className="fixed inset-y-0 left-0 flex w-[220px] flex-col border-r border-line bg-surface">
      <div className="border-b border-line px-4 py-5">
        <div className="text-xl font-semibold">AssetFlow</div>
        <div className="text-xs text-secondary">Operations console</div>
      </div>
      <nav className="flex-1 space-y-1 px-2 py-4">
        {items.map(([label, href]) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`block border-l-[3px] px-3 py-2 text-sm transition ${
                active ? "border-green bg-line-strong text-primary" : "border-transparent text-secondary hover:bg-raised hover:text-primary"
              }`}
            >
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
  );
}

