"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { buttonClass, FormField, inputClass } from "@/components/shared/FormField";
import { ThemeSwitcher } from "@/components/shared/ThemeSwitcher";
import { useAuth } from "@/lib/auth";

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password"));
    if (password !== String(data.get("confirm"))) {
      setError("Passwords do not match");
      setIsSubmitting(false);
      return;
    }
    try {
      await signup(String(data.get("name")), String(data.get("email")), password);
      router.push("/dashboard");
    } catch {
      setError("Unable to create account");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-panel relative grid min-h-screen place-items-center px-4 py-10">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeSwitcher />
      </div>
      <form onSubmit={submit} className="card-surface animate-fade-up w-full max-w-[440px] p-8">
        <div className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="AssetFlow Logo" className="h-9 w-auto" />
          <h1 className="font-display text-2xl tracking-tight">Create account</h1>
        </div>
        <p className="mt-1.5 text-sm text-secondary">New users start with employee access</p>
        <div className="mt-6 grid gap-4">
          <FormField label="Name">
            <input className={inputClass} name="name" required />
          </FormField>
          <FormField label="Email">
            <input className={inputClass} name="email" type="email" required />
          </FormField>
          <FormField label="Password">
            <input className={inputClass} name="password" type="password" minLength={6} required />
          </FormField>
          <FormField label="Confirm password">
            <input className={inputClass} name="confirm" type="password" minLength={6} required />
          </FormField>
        </div>
        {error ? <p className="mt-3 text-sm text-red">{error}</p> : null}
        <button disabled={isSubmitting} className={`${buttonClass} mt-6 w-full`}>
          {isSubmitting ? "Creating account..." : "Sign up"}
        </button>
        <Link href="/login" className="mt-4 block text-center text-xs font-medium text-brand hover:brightness-110">
          Back to sign in
        </Link>
      </form>
    </main>
  );
}
