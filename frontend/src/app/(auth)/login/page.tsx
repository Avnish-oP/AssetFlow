"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { buttonClass, FormField, inputClass } from "@/components/shared/FormField";
import { useToast } from "@/components/shared/Toast";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { showToast } = useToast();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      await apiFetch("/auth/forgot-password", { method: "POST", body: "{}" });
      showToast("Password reset stub accepted — check with an admin to reset.", "success");
    } catch {
      showToast("Could not submit reset request", "error");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-bg px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-lg border border-line bg-surface p-6">
        <h1 className="text-xl font-semibold">AssetFlow</h1>
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
          <button type="button" className="text-secondary hover:text-primary" onClick={() => void forgotPassword()}>
            Forgot password
          </button>
          <Link href="/signup" className="text-green">
            Create account
          </Link>
        </div>
      </form>
    </main>
  );
}
