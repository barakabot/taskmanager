"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DepartmentBadge, PriorityBadge, StatusBadge, ReasonBadge } from "./badges";
import { TaskDetailSheet } from "./task-detail-sheet";
import type { SerializedMember } from "@/lib/serialize";
import type { SerializedTask } from "@/lib/serialize";
import {
  formatJalaliLong,
  formatTime,
  toPersianDigits,
  isOverdue,
  isToday,
  daysBetween,
} from "@/lib/jalali";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  User,
  CalendarClock,
  AlertOctagon,
} from "lucide-react";
import { FOLLOW_UP_REASONS } from "@/lib/constants";
import { usePMOStore } from "@/lib/pmo-store";

export function MyTasksView() {
  const queryClient = useQueryClient();
  const me = usePMOStore((s) => s.member);
  const isManager = me?.role === "MANAGER";
  const [selected, setSelected] = React.useState<SerializedTask | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [showReasonFor, setShowReasonFor] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const { data: membersData } = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const r = await fetch("/api/members");
      return (await r.json()) as { members: SerializedMember[] };
    },
    enabled: isManager,
  });

  // Managers can pick any member to preview; members are locked to themselves.
  const members = (membersData?.members ?? []).filter((m) => m.role === "MEMBER");
  const [memberId, setMemberId] = React.useState<string>(me?.id ?? "");

  React.useEffect(() => {
    if (me && !isManager) setMemberId(me.id);
  }, [me, isManager]);

  const { data, isLoading } = useQuery({
    queryKey: ["tasks", "mytasks", memberId, me?.id],
    queryFn: async () => {
      // For members, the API ignores assigneeId and returns own tasks.
      // For managers, assigneeId filters to the selected member.
      const params = new URLSearchParams();
      if (isManager && memberId) params.set("assigneeId", memberId);
      const r = await fetch(`/api/tasks?${params.toString()}`);
      if (r.status === 401) return { tasks: [] as SerializedTask[] };
      return (await r.json()) as { tasks: SerializedTask[] };
    },
    enabled: !!me,
  });

  const member = isManager
    ? members.find((m) => m.id === memberId) ?? members[0]
    : me;
  const tasks = data?.tasks ?? [];
  const active = tasks.filter((t) => t.status !== "DONE");
  const done = tasks.filter((t) => t.status === "DONE");
  const overdueTasks = active.filter((t) => isOverdue(new Date(t.deadline), t.status));
  const todayTasks = active.filter((t) => isToday(new Date(t.deadline)));

  async function quickUpdate(task: SerializedTask, status: string) {
    setBusyId(task.id);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast.success(
        status === "STARTED" ? "🟢 شروع کردم." : status === "DONE" ? "✅ انجام شد." : "وضعیت به‌روزرسانی شد."
      );
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
    } catch {
      toast.error("به‌روزرسانی ناموفق بود.");
    } finally {
      setBusyId(null);
    }
  }

  async function quickReason(task: SerializedTask, reason: string) {
    setBusyId(task.id);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followUpReason: reason, status: "BLOCKED" }),
      });
      if (!res.ok) throw new Error();
      toast.success("علت عدم انجام ثبت شد.");
      setShowReasonFor(null);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch {
      toast.error("ثبت علت ناموفق بود.");
    } finally {
      setBusyId(null);
    }
  }

  function openTask(t: SerializedTask) {
    setSelected(t);
    setSheetOpen(true);
  }

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Member picker */}
      <div className="flex items-center gap-3 flex-wrap">
        {isManager ? (
          <>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">پیش‌نمایش کاربر:</span>
            </div>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="انتخاب کاربر..." />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} — {m.handle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{me?.name}</span>
            <span className="text-xs text-muted-foreground" dir="ltr">{me?.handle}</span>
          </div>
        )}
        {member && <DepartmentBadge department={member.department} />}
        <div className="flex items-center gap-1.5 mr-auto text-xs">
          <span className="rounded-md bg-sky-100 text-sky-700 px-2 py-0.5 nums-fa dark:bg-sky-950/40 dark:text-sky-300">
            فعال: {toPersianDigits(active.length)}
          </span>
          <span className="rounded-md bg-rose-100 text-rose-700 px-2 py-0.5 nums-fa dark:bg-rose-950/40 dark:text-rose-300">
            عقب‌افتاده: {toPersianDigits(overdueTasks.length)}
          </span>
          <span className="rounded-md bg-emerald-100 text-emerald-700 px-2 py-0.5 nums-fa dark:bg-emerald-950/40 dark:text-emerald-300">
            انجام‌شده: {toPersianDigits(done.length)}
          </span>
        </div>
      </div>

      {member && (todayTasks.length > 0 || overdueTasks.length > 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
          <span className="font-medium text-amber-800 dark:text-amber-200">🌅 گزارش کارهای روزانه شما</span>
          <span className="text-amber-700/80 dark:text-amber-300/80 mr-2">
            — {toPersianDigits(todayTasks.length)} تسک برای امروز و {toPersianDigits(overdueTasks.length)} تسک عقب‌افتاده دارید.
          </span>
        </div>
      )}

      <ScrollArea className="flex-1 scroll-area-pmo">
        <div className="space-y-4 pb-4">
          {isLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          )}

          {!isLoading && active.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-500" />
                <p>🎉 هیچ تسک فعالی ندارید. عالی!</p>
              </CardContent>
            </Card>
          )}

          {active.map((task) => {
            const dl = new Date(task.deadline);
            const overdue = isOverdue(dl, task.status);
            const today = isToday(dl);
            const days = daysBetween(dl, new Date());
            return (
              <Card
                key={task.id}
                className={cn(
                  "overflow-hidden",
                  overdue && "border-r-4 border-r-rose-500",
                  today && !overdue && "border-r-4 border-r-amber-500"
                )}
              >
                <CardContent className="p-4">
                  <div
                    className="cursor-pointer"
                    onClick={() => openTask(task)}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-muted-foreground">
                            {task.code}
                          </span>
                          {task.status !== "DONE" && overdue && (
                            <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                              🔴 عقب‌افتاده ({toPersianDigits(Math.abs(days))} روز)
                            </span>
                          )}
                        </div>
                        <h4 className="font-medium leading-6 mb-2">{task.title}</h4>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <DepartmentBadge department={task.department} />
                          <PriorityBadge priority={task.priority} />
                          <StatusBadge status={task.status} />
                          {task.followUpReason && <ReasonBadge reason={task.followUpReason} />}
                        </div>
                      </div>
                      <div className="text-left shrink-0">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                          <CalendarClock className="h-3 w-3" />
                          <span className="nums-fa">{formatJalaliLong(dl)}</span>
                        </div>
                        <div className="text-sm font-medium nums-fa">
                          {toPersianDigits(formatTime(dl))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick action bar — mirrors bot inline keyboard */}
                  {showReasonFor === task.id ? (
                    <div className="mt-3 pt-3 border-t space-y-2">
                      <p className="text-xs text-muted-foreground">
                        علت عدم انجام را انتخاب کنید تا در گزارش مدیر ثبت شود:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {FOLLOW_UP_REASONS.map((r) => (
                          <Button
                            key={r.key}
                            size="sm"
                            variant="outline"
                            disabled={busyId === task.id}
                            onClick={() => quickReason(task, r.key)}
                            className="h-8 justify-start text-xs"
                          >
                            {r.label}
                          </Button>
                        ))}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => setShowReasonFor(null)}
                      >
                        انصراف
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground ml-1">
                        👇 وضعیت خود را مشخص کنید:
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === task.id || task.status === "STARTED"}
                        onClick={() => quickUpdate(task, "STARTED")}
                        className="h-7 text-xs border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                      >
                        <PlayCircle className="h-3.5 w-3.5" />
                        🟢 شروع کردم
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === task.id}
                        onClick={() => setShowReasonFor(task.id)}
                        className="h-7 text-xs border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        🟡 در انتظار اطلاعات
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === task.id}
                        onClick={() => setShowReasonFor(task.id)}
                        className="h-7 text-xs border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                      >
                        <AlertOctagon className="h-3.5 w-3.5" />
                        🔴 انجام نمی‌شود
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === task.id}
                        onClick={() => quickUpdate(task, "DONE")}
                        className="h-7 text-xs border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 mr-auto"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        انجام شد
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {done.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                انجام‌شده‌ها ({toPersianDigits(done.length)})
              </h3>
              <div className="space-y-1.5 opacity-70">
                {done.slice(0, 10).map((task) => (
                  <Card key={task.id} className="cursor-pointer" onClick={() => openTask(task)}>
                    <CardContent className="p-3 flex items-center gap-2 text-sm">
                      <span className="font-mono text-xs text-muted-foreground">{task.code}</span>
                      <span className="flex-1 line-clamp-1">{task.title}</span>
                      <StatusBadge status={task.status} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <TaskDetailSheet
        task={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
          queryClient.invalidateQueries({ queryKey: ["members"] });
        }}
      />
    </div>
  );
}
