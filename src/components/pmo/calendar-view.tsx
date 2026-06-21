"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import { ShamsiCalendar, isOverdueTask } from "./shamsi-calendar";
import { TaskDetailSheet } from "./task-detail-sheet";
import {
  DepartmentBadge,
  PriorityBadge,
  StatusBadge,
} from "./badges";
import type { SerializedTask, SerializedMember } from "@/lib/serialize";
import {
  formatJalaliLong,
  formatTime,
  toPersianDigits,
  isSameDay,
} from "@/lib/jalali";
import { usePMOStore } from "@/lib/pmo-store";
import {
  CalendarCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function CalendarView() {
  const queryClient = useQueryClient();
  const me = usePMOStore((s) => s.member);
  const isManager = me?.role === "MANAGER";
  const [selected, setSelected] = React.useState<Date | null>(new Date());
  const [selectedTask, setSelectedTask] = React.useState<SerializedTask | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [memberFilter, setMemberFilter] = React.useState<string>("ALL");

  // Members list (for manager filter)
  const { data: membersData } = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const r = await fetch("/api/members");
      return (await r.json()) as { members: SerializedMember[] };
    },
    enabled: isManager,
  });
  const members = (membersData?.members ?? []).filter((m) => m.role === "MEMBER");

  // Tasks (role-scoped server-side)
  const { data, isLoading } = useQuery({
    queryKey: ["tasks", "calendar", memberFilter, me?.id],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (isManager && memberFilter !== "ALL") params.set("assigneeId", memberFilter);
      const r = await fetch(`/api/tasks?${params.toString()}`);
      if (r.status === 401) return { tasks: [] as SerializedTask[] };
      return (await r.json()) as { tasks: SerializedTask[] };
    },
    enabled: !!me,
  });

  const tasks = data?.tasks ?? [];

  // Selected day tasks
  const dayTasks = selected
    ? tasks
        .filter((t) => isSameDay(new Date(t.deadline), selected))
        .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    : [];

  function openTask(t: SerializedTask) {
    setSelectedTask(t);
    setSheetOpen(true);
  }

  const overdueTasks = tasks.filter(isOverdueTask);
  const upcomingTasks = tasks
    .filter((t) => t.status !== "DONE" && new Date(t.deadline).getTime() >= Date.now())
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 8);

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Top toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <CalendarCheck className="h-4 w-4 text-primary" />
            {isManager ? "تقویم تسک‌های واحد" : "تقویم تسک‌های من"}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            تقویم شمسی — تسک‌های آینده و عقب‌افتاده
          </p>
        </div>
        {isManager && (
          <Select value={memberFilter} onValueChange={setMemberFilter}>
            <SelectTrigger className="w-[200px] mr-auto">
              <SelectValue placeholder="همه اعضا" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">همه اعضا</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-3 min-h-0">
        {/* Calendar grid */}
        <Card className="lg:col-span-2 flex flex-col min-h-0">
          <CardContent className="flex-1 p-4 flex flex-col min-h-0">
            {isLoading ? (
              <div className="grid grid-cols-7 gap-1 flex-1">
                {Array.from({ length: 35 }).map((_, i) => (
                  <Skeleton key={i} className="rounded-md" />
                ))}
              </div>
            ) : (
              <ShamsiCalendar
                tasks={tasks}
                onTaskClick={openTask}
                selectedDate={selected}
                onSelectDate={setSelected}
              />
            )}
          </CardContent>
        </Card>

        {/* Side panel: selected day tasks */}
        <Card className="flex flex-col min-h-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary" />
              {selected ? formatJalaliLong(selected) : "انتخاب روز"}
            </CardTitle>
            <CardDescription>
              {toPersianDigits(dayTasks.length)} تسک در این روز
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-3 pt-0 min-h-0">
            <ScrollArea className="h-full scroll-area-pmo">
              <div className="space-y-2">
                {dayTasks.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <Inbox className="h-8 w-8 mx-auto mb-1 opacity-40" />
                    تسکی در این روز نیست.
                  </div>
                )}
                {dayTasks.map((t) => {
                  const overdue = isOverdueTask(t);
                  const dl = new Date(t.deadline);
                  return (
                    <button
                      key={t.id}
                      onClick={() => openTask(t)}
                      className={cn(
                        "w-full text-right rounded-md border p-2.5 hover:shadow-sm hover:border-primary/40 transition-all",
                        overdue && "border-r-2 border-r-rose-500"
                      )}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {t.code}
                        </span>
                        {overdue && <span className="text-[10px] text-rose-600">🔴 عقب‌افتاده</span>}
                        <span className="text-[10px] text-muted-foreground nums-fa mr-auto">
                          {toPersianDigits(formatTime(dl))}
                        </span>
                      </div>
                      <p className="text-sm font-medium line-clamp-2 mb-1.5">{t.title}</p>
                      <div className="flex flex-wrap items-center gap-1">
                        <DepartmentBadge department={t.department} />
                        <PriorityBadge priority={t.priority} />
                        <StatusBadge status={t.status} />
                      </div>
                      {isManager && (
                        <div className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-primary text-[9px] font-bold">
                            {t.assigneeName.charAt(0)}
                          </span>
                          {t.assigneeName}
                          {t.subDepartmentName && (
                            <span className="opacity-70">• {t.subDepartmentName}</span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Bottom: overdue + upcoming quick lists */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48">
        {/* Overdue */}
        <Card className="flex flex-col min-h-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-4 w-4" />
              عقب‌افتاده‌ها
              <span className="text-muted-foreground nums-fa font-normal">
                ({toPersianDigits(overdueTasks.length)})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-3 pt-0 min-h-0">
            <ScrollArea className="h-full scroll-area-pmo max-h-28">
              <div className="space-y-1">
                {overdueTasks.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    معوقی وجود ندارد.
                  </p>
                )}
                {overdueTasks.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => openTask(t)}
                    className="w-full text-right flex items-center gap-2 rounded border border-r-2 border-r-rose-500 p-1.5 text-xs hover:bg-muted/40"
                  >
                    <span>🔴</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{t.code}</span>
                    <span className="flex-1 line-clamp-1">{t.title}</span>
                    <span className="text-muted-foreground nums-fa shrink-0">
                      {toPersianDigits(formatTime(new Date(t.deadline)))}
                    </span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Upcoming */}
        <Card className="flex flex-col min-h-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
              <Clock className="h-4 w-4" />
              آینده
              <span className="text-muted-foreground nums-fa font-normal">
                ({toPersianDigits(upcomingTasks.length)})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-3 pt-0 min-h-0">
            <ScrollArea className="h-full scroll-area-pmo max-h-28">
              <div className="space-y-1">
                {upcomingTasks.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2">تسک آینده‌ای نیست.</p>
                )}
                {upcomingTasks.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => openTask(t)}
                    className="w-full text-right flex items-center gap-2 rounded border p-1.5 text-xs hover:bg-muted/40"
                  >
                    <span className="font-mono text-[10px] text-muted-foreground">{t.code}</span>
                    <span className="flex-1 line-clamp-1">{t.title}</span>
                    <span className="text-muted-foreground nums-fa shrink-0">
                      {toPersianDigits(formatTime(new Date(t.deadline)))}
                    </span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <TaskDetailSheet
        task={selectedTask}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
        }}
      />
    </div>
  );
}
