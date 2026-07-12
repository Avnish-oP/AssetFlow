"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { buttonClass, FormField, inputClass, secondaryButtonClass } from "@/components/shared/FormField";
import { ThemeSwitcher } from "@/components/shared/ThemeSwitcher";
import { useToast } from "@/components/shared/Toast";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { showToast } = useToast();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("admin@assetflow.dev");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const data = new FormData(event.currentTarget);
    try {
      await login(String(data.get("email")), String(data.get("password")));
      const next = new URL(window.location.href).searchParams.get("next");
      router.push(next ?? "/dashboard");
    } catch {
      setError("Invalid email or password");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function forgotPassword() {
    try {
      const result = await apiFetch<{ message: string; reset_token?: string | null }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: forgotEmail }),
      });
      if (result.reset_token) {
        showToast("Reset token issued — set a new password", "success");
        router.push(`/reset-password?token=${encodeURIComponent(result.reset_token)}`);
      } else {
        showToast(result.message, "success");
      }
    } catch {
      showToast("Could not submit reset request", "error");
    }
  }

  return (
    <main className="auth-panel relative grid min-h-screen lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative hidden flex-col justify-between p-10 lg:flex xl:p-14">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-brand-bg">
            <img src="/logo.svg" alt="" className="h-7 w-auto" />
          </div>
          <div className="font-display text-xl tracking-tight text-primary">
            Asset<span className="text-brand">Flow</span>
          </div>
        </div>

        <div className="animate-fade-up">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">Enterprise asset console</p>
          <h1 className="mt-4 max-w-lg font-display text-[2.85rem] leading-[1.08] tracking-tight text-primary">
            Clarity for every asset in the building.
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-secondary">
            Allocations, bookings, maintenance, and audits — one calm board with status that stays readable.
          </p>

          <div className="mt-10 grid max-w-lg grid-cols-2 gap-3">
            <div className="mood-tile pin-wash-mist p-4">
              <div className="text-[11px] uppercase tracking-[0.12em] text-secondary">Pulse</div>
              <div className="mt-2 font-display text-3xl text-primary">Live KPIs</div>
            </div>
            <div className="mood-tile pin-wash-blush p-4">
              <div className="text-[11px] uppercase tracking-[0.12em] text-secondary">Risk</div>
              <div className="mt-2 font-display text-3xl text-primary">Overdues</div>
            </div>
            <div className="mood-tile pin-wash-sky col-span-2 p-4">
              <div className="text-[11px] uppercase tracking-[0.12em] text-secondary">Workflows</div>
              <div className="mt-2 font-display text-2xl text-primary">Transfers · Bookings · Maintenance</div>
            </div>          </div>
        </div>

        <p className="text-xs text-muted">Demo · admin@assetflow.dev / password</p>
      </section>

      <section className="relative grid place-items-center px-4 py-10 sm:px-8">
        <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
          <ThemeSwitcher />
        </div>
        <form onSubmit={submit} className="card-surface animate-fade-up w-full max-w-[420px] p-8">
          <div className="flex items-center gap-2.5 lg:hidden">
            <img src="/logo.svg" alt="AssetFlow Logo" className="h-9 w-auto" />
            <h1 className="font-display text-xl tracking-tight">
              Asset<span className="text-brand">Flow</span>
            </h1>
          </div>
          <h2 className="font-display text-2xl tracking-tight text-primary max-lg:mt-5">Sign in</h2>
          <p className="mt-1.5 text-sm text-secondary">Access your operations console</p>
          <div className="mt-6 grid gap-4">
            <FormField label="Email">
              <input className={inputClass} name="email" type="email" defaultValue="admin@assetflow.dev" required />
            </FormField>
            <FormField label="Password">
              <input className={inputClass} name="password" type="password" defaultValue="password" required />
            </FormField>
          </div>
          {error ? <p className="mt-3 text-sm text-red">{error}</p> : null}
          <button disabled={isSubmitting} className={`${buttonClass} mt-6 w-full`}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
          <div className="mt-4 flex justify-between text-xs text-secondary">
            <button type="button" className="hover:text-primary" onClick={() => setShowForgot((v) => !v)}>
              Forgot password
            </button>
            <Link href="/signup" className="font-medium text-brand hover:brightness-110">
              Create account
            </Link>
          </div>

          {showForgot ? (
            <div className="mt-4 grid gap-3 rounded-2xl border border-line bg-raised/70 p-4">
              <FormField label="Account email">
                <input
                  className={inputClass}
                  type="email"
                  value={forgotEmail}
                  onChange={(event) => setForgotEmail(event.target.value)}
                  required
                />
              </FormField>
              <button type="button" className={secondaryButtonClass} onClick={() => void forgotPassword()}>
                Send reset token
              </button>
            </div>
          ) : null}
        </form>
      </section>
    </main>
  );
}
