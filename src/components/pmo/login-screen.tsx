"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { usePMOStore } from "@/lib/pmo-store";
import {
  ShieldCheck,
  LogIn,
  User,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const DEMO_ACCOUNTS = [
  { label: "مدیر", handle: "@manager", password: "admin", role: "MANAGER" },
  { label: "علی محمدی (فانتزی)", handle: "@ali", password: "1234", role: "MEMBER" },
  { label: "حسین احمدی (غیرفانتزی)", handle: "@hossein", password: "1234", role: "MEMBER" },
  { label: "رضا قاسمی (BI)", handle: "@reza", password: "1234", role: "MEMBER" },
];

export function LoginScreen() {
  const setMember = usePMOStore((s) => s.setMember);
  const setAuthLoading = usePMOStore((s) => s.setAuthLoading);
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
        body: JSON.stringify({ handle: handle.trim(), password: password.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "ورود ناموفق بود.");
        return;
      }
      setMember(data.member);
      setAuthLoading(false);
      toast.success(`خوش آمدید، ${data.member.name}!`);
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
          <h1 className="text-xl font-bold">PMO Agent</h1>
          <p className="text-sm text-muted-foreground mt-1">
            واحد برنامه‌ریزی سازمان — ورود به سامانه
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
                  placeholder="@manager"
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
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                    a.role === "MANAGER"
                      ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                      : "hover:bg-muted/50"
                  )}
                >
                  <div className="font-medium">{a.label}</div>
                  <div className="text-muted-foreground mt-0.5" dir="ltr">
                    {a.handle} / {a.password}
                  </div>
                </button>
              ))}
            </div>

            <p className="text-[11px] text-muted-foreground mt-4 flex items-start gap-1.5">
              <Sparkles className="h-3 w-3 mt-0.5 shrink-0" />
              هر کاربر فقط تسک‌های خودش را می‌بیند. مدیر به همه تسک‌ها، گزارش‌ها و پنل
              مدیریت دسترسی دارد.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
