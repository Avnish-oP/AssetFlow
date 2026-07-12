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

  if (loading) return <div className="grid min-h-screen place-items-center text-sm text-secondary">Loading</div>;
  if (!user) return null;

  return (
    <>
      <Sidebar />
      <main className="min-h-screen bg-bg px-4 py-5 sm:px-6 lg:ml-[248px] lg:p-8">{children}</main>
    </>
  );
}
