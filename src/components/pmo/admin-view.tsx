"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTMStore, type ViewKey } from "@/lib/pmo-store";
import { toPersianDigits, formatJalaliLong } from "@/lib/jalali";
import { cn } from "@/lib/utils";
import type { SerializedMember, SerializedGroup, SerializedTask } from "@/lib/serialize";
import {
  Building2,
  Users,
  ListChecks,
  CalendarClock,
  Plus,
  Crown,
  Shield,
  UserCog,
  UserCheck,
  ArrowLeft,
  Clock,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Role color map                                                      */
/* ------------------------------------------------------------------ */

const ROLE_COLORS: Record<string, { bg: string; text: string; bar: string; icon: React.ComponentType<{ className?: string }> }> = {
  SUPER_ADMIN: {
    bg: "bg-rose-100 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-300",
    bar: "bg-rose-500",
    icon: Crown,
  },
  MANAGER: {
    bg: "bg-amber-100 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    bar: "bg-amber-500",
    icon: Shield,
  },
  SUPERVISOR: {
    bg: "bg-sky-100 dark:bg-sky-950/40",
    text: "text-sky-700 dark:text-sky-300",
    bar: "bg-sky-500",
    icon: UserCog,
  },
  SPECIALIST: {
    bg: "bg-slate-100 dark:bg-slate-800/50",
    text: "text-slate-600 dark:text-slate-300",
    bar: "bg-slate-400",
    icon: UserCheck,
  },
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "مدیر کل",
  MANAGER: "مدیر مجموعه",
  SUPERVISOR: "سرپرست",
  SPECIALIST: "کارشناس",
};

/* ------------------------------------------------------------------ */
/*  Stat Card                                                           */
/* ------------------------------------------------------------------ */

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", color)}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="text-2xl font-bold leading-tight nums-fa">{toPersianDigits(value)}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main view                                                           */
/* ------------------------------------------------------------------ */

export function AdminView() {
  const member = useTMStore((s) => s.member);
  const setView = useTMStore((s) => s.setView);

  const { data: groupsData, isLoading: gLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const r = await fetch("/api/groups");
      if (!r.ok) throw new Error("خطا");
      return (await r.json()) as { groups: SerializedGroup[] };
    },
  });

  const { data: membersData, isLoading: mLoading } = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const r = await fetch("/api/members");
      if (!r.ok) throw new Error("خطا");
      return (await r.json()) as { members: SerializedMember[] };
    },
  });

  const { data: tasksData, isLoading: tLoading } = useQuery({
    queryKey: ["tasks", "admin-all"],
    queryFn: async () => {
      const r = await fetch("/api/tasks");
      if (!r.ok) throw new Error("خطا");
      return (await r.json()) as { tasks: SerializedTask[] };
    },
  });

  const { data: schedulesData } = useQuery({
    queryKey: ["schedules"],
    queryFn: async () => {
      const r = await fetch("/api/schedules");
      if (!r.ok) return { schedules: [] };
      return (await r.json()) as { schedules: unknown[] };
    },
  });

  const groups = groupsData?.groups ?? [];
  const members = membersData?.members ?? [];
  const tasks = tasksData?.tasks ?? [];
  const scheduleCount = schedulesData?.schedules?.length ?? 0;

  const isLoading = gLoading || mLoading || tLoading;

  // Role distribution
  const roleDistribution = React.useMemo(() => {
    const counts: Record<string, number> = {
      SUPER_ADMIN: 0,
      MANAGER: 0,
      SUPERVISOR: 0,
      SPECIALIST: 0,
    };
    for (const m of members) {
      if (counts[m.role] !== undefined) counts[m.role]++;
    }
    return counts;
  }, [members]);

  const totalMembers = members.length;
  const maxRoleCount = Math.max(...Object.values(roleDistribution), 1);

  // Recent 5 tasks
  const recentTasks = React.useMemo(() => {
    return [...tasks]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [tasks]);

  if (isLoading) {
    return (
      <div className="space-y-6 p-1">
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      {/* Quick Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          className="gap-1.5"
          onClick={() => setView("groups")}
        >
          <Building2 className="h-4 w-4" />
          افزودن مجموعه
          <ArrowLeft className="h-3 w-3" />
        </Button>
        <Button
          variant="outline"
          className="gap-1.5"
          onClick={() => setView("members")}
        >
          <Users className="h-4 w-4" />
          افزودن کاربر
          <ArrowLeft className="h-3 w-3" />
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Building2} label="مجموعه‌ها" value={groups.length} color="bg-violet-500" />
        <StatCard icon={Users} label="کل اعضا" value={totalMembers} color="bg-emerald-500" />
        <StatCard icon={ListChecks} label="کل تسک‌ها" value={tasks.length} color="bg-sky-500" />
        <StatCard icon={CalendarClock} label="زمان‌بندی‌ها" value={scheduleCount} color="bg-amber-500" />
      </div>

      {/* Role Distribution */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            توزیع نقش‌ها
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(roleDistribution).map(([roleKey, count]) => {
            const rc = ROLE_COLORS[roleKey];
            if (!rc) return null;
            const Icon = rc.icon;
            const pct = totalMembers > 0 ? (count / totalMembers) * 100 : 0;
            return (
              <div key={roleKey} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", rc.text)} />
                    <span className="font-medium">{ROLE_LABELS[roleKey] ?? roleKey}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs font-medium", rc.text)}>
                      {toPersianDigits(count)} نفر
                    </span>
                    <span className="text-xs text-muted-foreground nums-fa">
                      ({toPersianDigits(Math.round(pct))}٪)
                    </span>
                  </div>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", rc.bar)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4" />
            آخرین تسک‌های ثبت‌شده
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              هنوز تسکی ثبت نشده است.
            </p>
          ) : (
            <div className="space-y-2">
              {recentTasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                    {t.assigneeName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.title}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="font-mono">{t.code}</span>
                      <span>·</span>
                      <span>{t.assigneeName}</span>
                      <span>·</span>
                      <span>{t.groupName ?? "—"}</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground shrink-0">
                    {formatJalaliLong(new Date(t.createdAt))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}