"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { buttonClass, FormField, inputClass } from "@/components/shared/FormField";
import { useToast } from "@/components/shared/Toast";
import { apiFetch } from "@/lib/api";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { showToast } = useToast();
  const [token, setToken] = useState(params.get("token") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, new_password: password }),
      });
      showToast("Password updated — sign in", "success");
      router.push("/login");
    } catch (err) {
      const detail = (err as { detail?: unknown })?.detail;
      setError(typeof detail === "string" ? detail : "Could not reset password");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-bg px-4">
      <form onSubmit={submit} className="card-surface w-full max-w-sm p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Reset password</h1>
        <p className="mt-1 text-sm text-secondary">Paste the reset token and choose a new password.</p>
        <div className="mt-6 grid gap-4">
          <FormField label="Reset token">
            <textarea
              className={`${inputClass} h-24 py-2 font-mono text-xs`}
              value={token}
              onChange={(event) => setToken(event.target.value)}
              required
            />
          </FormField>
          <FormField label="New password">
            <input
              className={inputClass}
              type="password"
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </FormField>
        </div>
        {error ? <p className="mt-3 text-sm text-red">{error}</p> : null}
        <button disabled={isSubmitting} className={`${buttonClass} mt-6 w-full`}>
          {isSubmitting ? "Updating..." : "Update password"}
        </button>
        <p className="mt-4 text-center text-xs text-secondary">
          <Link href="/login" className="text-green">
            Back to sign in
          </Link>
        </p>
      </form>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="grid min-h-screen place-items-center text-secondary">Loading…</main>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
