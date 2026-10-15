"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { mutate } from "@/lib/orderfit-api";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      await mutate("/auth/signin", "POST", { email, password });
      router.replace("/deals");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Sign in failed."); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[#f7f6f5] grid place-items-center p-6"><form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white border border-neutral-200 p-8 space-y-5">
    <div><Link href="/" className="font-bold text-xl">OrderFit</Link><h1 className="text-2xl font-semibold mt-6">Sign in</h1><p className="text-sm text-neutral-600 mt-1">Use your OrderFit account to open saved business orders.</p></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 text-red-800 p-3 text-sm">{error}</p>}
    <label className="block text-sm">Email<input required type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
    <label className="block text-sm">Password<input required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
    <button disabled={busy} className="w-full rounded-lg bg-neutral-900 text-white p-3 disabled:opacity-50">{busy ? "Signing in…" : "Sign in"}</button>
  <p className="text-sm"><Link className="underline" href="/auth/signup">Create an account</Link></p></form></main>;
}
