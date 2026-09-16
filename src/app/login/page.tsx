"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppState } from "@/components/providers/app-state";

export default function LoginPage() {
  const { signIn, signedIn, ready } = useAppState();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && signedIn) router.replace("/");
  }, [ready, signedIn, router]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    // Demo build: any email and password signs in. The session lives in memory only.
    setTimeout(() => {
      signIn(email || "owner@example.com");
      router.replace("/");
    }, 350);
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo className="text-xl" />
          <p className="text-muted-foreground text-sm">Your restaurant, briefed every morning.</p>
        </div>
        <form onSubmit={submit} className="bg-card flex flex-col gap-4 rounded-xl border p-5 shadow-xs">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" inputMode="email" autoComplete="username" placeholder="you@restaurant.ca" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" size="lg" disabled={busy} className="mt-1 w-full">
            {busy ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-muted-foreground text-center text-xs">Demo environment. Any email and password will sign you in.</p>
        </form>
      </div>
    </div>
  );
}
