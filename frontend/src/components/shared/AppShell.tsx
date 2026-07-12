"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "@/components/shared/Sidebar";
import { useAuth } from "@/lib/auth";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, pathname, router, user]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 animate-pulse rounded-2xl bg-brand-bg shadow-[var(--shadow-pin)]" />
          <p className="text-sm text-secondary">Loading console…</p>
        </div>
      </div>
    );
  }
  if (!user) return null;

  return (
    <>
      <Sidebar />
      <main className="min-h-screen max-w-[100vw] overflow-x-hidden px-4 py-5 sm:px-6 lg:ml-[260px] lg:max-w-[calc(100vw-260px)] lg:px-8 lg:py-7">
        <div className="page-shell mx-auto w-full min-w-0 max-w-[1600px]">{children}</div>      </main>
    </>
  );
}
