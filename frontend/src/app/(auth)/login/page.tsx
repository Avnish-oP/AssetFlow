"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { buttonClass, FormField, inputClass, secondaryButtonClass } from "@/components/shared/FormField";
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
    <main className="grid min-h-screen place-items-center bg-bg px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-lg border border-line bg-surface p-6">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="AssetFlow Logo" className="h-10 w-auto" />
          <h1 className="text-xl font-semibold">
            <span className="text-heading">Asset</span>
            <span className="text-blue">Flow</span>
          </h1>
        </div>
        <p className="mt-1 text-sm text-secondary">Sign in to the operations console</p>
        <div className="mt-6 grid gap-4">
          <FormField label="Email">
            <input
              className={inputClass}
              name="email"
              type="email"
              defaultValue="admin@assetflow.dev"
              required
            />
          </FormField>
          <FormField label="Password">
            <input className={inputClass} name="password" type="password" defaultValue="password" required />
          </FormField>
        </div>
        {error ? <p className="mt-3 text-sm text-red">{error}</p> : null}
        <button disabled={isSubmitting} className={`${buttonClass} mt-6 w-full`}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
        <p className="mt-3 text-xs text-muted">Demo seed: admin@assetflow.dev / password</p>
        <div className="mt-4 flex justify-between text-xs text-secondary">
          <button type="button" className="text-secondary hover:text-primary" onClick={() => setShowForgot((v) => !v)}>
            Forgot password
          </button>
          <Link href="/signup" className="text-green">
            Create account
          </Link>
        </div>

        {showForgot ? (
          <div className="mt-4 grid gap-3 rounded-lg border border-line bg-raised p-3">
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
    </main>
  );
}
