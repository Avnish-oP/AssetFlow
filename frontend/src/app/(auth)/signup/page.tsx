"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { buttonClass, FormField, inputClass } from "@/components/shared/FormField";
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
    <main className="grid min-h-screen place-items-center bg-bg px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-lg border border-line bg-surface p-6">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="AssetFlow Logo" className="h-10 w-auto" />
          <h1 className="text-xl font-semibold">
            <span className="text-heading">Create</span> <span className="text-blue">account</span>
          </h1>
        </div>
        <p className="mt-1 text-sm text-secondary">New users start with employee access</p>
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
        <Link href="/login" className="mt-4 block text-center text-xs text-green">
          Back to sign in
        </Link>
      </form>
    </main>
  );
}

