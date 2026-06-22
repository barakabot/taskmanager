"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useTMStore, type ViewKey } from "@/lib/pmo-store";
import {
  ShieldCheck,
  LogIn,
  User,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

const DEMO_ACCOUNTS = [
  {
    label: "مدیر کل",
    handle: "@admin",
    password: "admin",
    role: "SUPER_ADMIN" as const,
    color: "border-rose-200 bg-rose-50 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/30 dark:hover:bg-rose-950/50",
  },
  {
    label: "مدیر فانتزی",
    handle: "@mgr1",
    password: "admin",
    role: "MANAGER" as const,
    color: "border-amber-200 bg-amber-50 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:hover:bg-amber-950/50",
  },
  {
    label: "سرپرست",
    handle: "@sup1",
    password: "1234",
    role: "SUPERVISOR" as const,
    color: "border-sky-200 bg-sky-50 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/30 dark:hover:bg-sky-950/50",
  },
  {
    label: "کارشناس",
    handle: "@ali",
    password: "1234",
    role: "SPECIALIST" as const,
    color: "hover:bg-muted/50",
  },
];

const ROLE_VIEW_MAP: Record<string, ViewKey> = {
  SUPER_ADMIN: "admin",
  MANAGER: "overview",
  SUPERVISOR: "overview",
  SPECIALIST: "mytasks",
};

export function LoginScreen() {
  const setMember = useTMStore((s) => s.setMember);
  const setAuthLoading = useTMStore((s) => s.setAuthLoading);
  const setView = useTMStore((s) => s.setView);
  const [handle, setHandle] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPwd, setShowPwd] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function login(e?: React.FormEvent) {
    e?.preventDefault();
    if (!handle.trim() || !password.trim()) {
      toast.error("هندل و رمز عبور را وارد کنید.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: handle.trim(),
          password: password.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "ورود ناموفق بود.");
        return;
      }
      const m = data.member;
      setMember(m);
      setView(ROLE_VIEW_MAP[m.role] ?? "overview");
      setAuthLoading(false);
      toast.success(`خوش آمدید، ${m.name}!`);
    } catch {
      toast.error("خطا در ارتباط با سرور.");
    } finally {
      setBusy(false);
    }
  }

  function quickLogin(h: string, p: string) {
    setHandle(h);
    setPassword(p);
    setTimeout(() => login(), 50);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-background">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-6">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-2xl font-bold mb-3 shadow-lg">
            پ
          </div>
          <h1 className="text-xl font-bold">سیستم مدیریت تسک</h1>
          <p className="text-sm text-muted-foreground mt-1">
            ورود به سامانه مدیریت تسک‌های سازمانی
          </p>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-primary" />
              ورود به حساب
            </CardTitle>
            <CardDescription>
              برای دسترسی به تسک‌ها، هندل و رمز عبور خود را وارد کنید.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={login} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="handle" className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  هندل کاربری
                </Label>
                <Input
                  id="handle"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="@admin"
                  dir="ltr"
                  className="text-left"
                  autoComplete="username"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5" />
                  رمز عبور
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••"
                    dir="ltr"
                    className="text-left pl-9"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPwd ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={busy}>
                <LogIn className="h-4 w-4" />
                {busy ? "در حال ورود..." : "ورود"}
              </Button>
            </form>

            <div className="relative my-4">
              <Separator />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="bg-card px-2 text-xs text-muted-foreground">
                  ورود سریع برای دمو
                </span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.handle}
                  onClick={() => quickLogin(a.handle, a.password)}
                  disabled={busy}
                  className={cn(
                    "rounded-lg border p-2 text-right text-xs transition-all hover:shadow-sm",
                    a.color
                  )}
                >
                  <div className="font-medium">{a.label}</div>
                  <div className="text-muted-foreground mt-0.5" dir="ltr">
                    {a.handle} / {a.password}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}