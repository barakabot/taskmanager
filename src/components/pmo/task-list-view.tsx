"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  STATUSES,
  PRIORITIES,
  TASK_SOURCES,
  FOLLOW_UP_REASONS,
  APPROVAL_STATUSES,
  approvalStatusByKey,
  statusByKey,
  priorityByKey,
  sourceByKey,
} from "@/lib/constants";
import type { SerializedTask, SerializedLog } from "@/lib/serialize";
import {
  toPersianDigits,
  isOverdue,
  formatJalaliDate,
  formatJalaliLong,
  formatTime,
  daysBetween,
} from "@/lib/jalali";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Circle,
  PlayCircle,
  FileText,
  Eye,
  Search,
  Filter,
  CalendarClock,
  User,
  Link2,
  History,
  MessageSquare,
  FileArchive,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Badge helpers                                                      */
/* ------------------------------------------------------------------ */

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  LOW: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700",
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700",
  STARTED: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
  BLOCKED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
  DONE: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
};

const SOURCE_STYLES: Record<string, string> = {
  MANUAL: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700",
  SCHEDULED: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
  REFERRED: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
};

function PriorityBadge({ priority }: { priority: string }) {
  const p = priorityByKey(priority);
  if (!p) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        PRIORITY_STYLES[p.key]
      )}
    >
      {p.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = statusByKey(status);
  if (!s) return null;
  const Icon =
    s.key === "DONE"
      ? CheckCircle2
      : s.key === "STARTED"
        ? Clock
        : s.key === "BLOCKED"
          ? AlertTriangle
          : Circle;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        STATUS_STYLES[s.key]
      )}
    >
      <Icon className="h-3 w-3" />
      {s.label}
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  if (source === "REFERRED") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
          SOURCE_STYLES.REFERRED
        )}
      >
        <FileText className="h-3 w-3" />
        نامه‌ای
      </span>
    );
  }
  const s = sourceByKey(source);
  if (!s) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        SOURCE_STYLES[source] ?? SOURCE_STYLES.MANUAL
      )}
    >
      {s.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  TaskListView                                                       */
/* ------------------------------------------------------------------ */

export function TaskListView() {
  const queryClient = useQueryClient();

  // Filters
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [priorityFilter, setPriorityFilter] = React.useState<string>("all");
  const [sourceFilter, setSourceFilter] = React.useState<string>("all");
  const [groupFilter, setGroupFilter] = React.useState<string>("all");

  // Detail sheet
  const [detailTask, setDetailTask] = React.useState<SerializedTask | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  // Build query params
  const queryParams = React.useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (priorityFilter !== "all") params.set("priority", priorityFilter);
    if (sourceFilter !== "all") params.set("source", sourceFilter);
    if (groupFilter !== "all") params.set("groupId", groupFilter);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [statusFilter, priorityFilter, sourceFilter, groupFilter]);

  // Fetch tasks
  const { data: tasksData, isLoading } = useQuery({
    queryKey: [
      "tasks",
      "filtered",
      statusFilter,
      priorityFilter,
      sourceFilter,
      groupFilter,
    ],
    queryFn: async () => {
      const r = await fetch(`/api/tasks${queryParams}`);
      if (!r.ok) return { tasks: [] as SerializedTask[] };
      return (await r.json()) as { tasks: SerializedTask[] };
    },
  });
  const tasks = tasksData?.tasks ?? [];

  // Client-side search
  const filteredTasks = React.useMemo(() => {
    if (!search.trim()) return tasks;
    const q = search.trim().toLowerCase();
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        t.assigneeName.toLowerCase().includes(q)
    );
  }, [tasks, search]);

  // Derive unique groups from fetched tasks
  const uniqueGroups = React.useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => {
      if (t.groupId) set.add(t.groupId);
    });
    // Create name->id map from the tasks
    const map = new Map<string, string>();
    tasks.forEach((t) => {
      if (t.groupName && t.groupId && !map.has(t.groupId)) {
        map.set(t.groupId, t.groupName);
      }
    });
    return { ids: Array.from(set), names: map };
  }, [tasks]);

  function openDetail(task: SerializedTask) {
    setDetailTask(task);
    setDetailOpen(true);
  }

  function refreshAfterUpdate() {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* ---- Toolbar ---- */}
      <Card className="shrink-0 p-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="جستجو در عنوان یا کد..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-8 h-9 text-sm"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Group */}
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="w-auto min-w-[110px] h-9 text-xs">
                <SelectValue placeholder="مجموعه" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه مجموعه‌ها</SelectItem>
                {Array.from(uniqueGroups.names.entries()).map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-auto min-w-[110px] h-9 text-xs">
                <SelectValue placeholder="وضعیت" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Priority */}
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-auto min-w-[100px] h-9 text-xs">
                <SelectValue placeholder="اولویت" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه اولویت‌ها</SelectItem>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Source */}
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-auto min-w-[100px] h-9 text-xs">
                <SelectValue placeholder="منبع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه منابع</SelectItem>
                {TASK_SOURCES.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Count */}
          <div className="text-xs text-muted-foreground whitespace-nowrap hidden sm:block">
            {toPersianDigits(filteredTasks.length)} تسک
          </div>
        </div>
      </Card>

      {/* ---- Table ---- */}
      <Card className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex items-center justify-center h-full py-16">
            <div className="text-center text-sm text-muted-foreground">
              <Filter className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>تسکی یافت نشد.</p>
              <p className="text-xs mt-1">
                فیلترها را تغییر دهید یا جستجوی دیگری انجام دهید.
              </p>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs whitespace-nowrap w-[90px]">کد</TableHead>
                  <TableHead className="text-xs whitespace-nowrap min-w-[160px]">عنوان</TableHead>
                  <TableHead className="text-xs whitespace-nowrap hidden md:table-cell">مجموعه</TableHead>
                  <TableHead className="text-xs whitespace-nowrap hidden md:table-cell">مسئول</TableHead>
                  <TableHead className="text-xs whitespace-nowrap hidden lg:table-cell">اولویت</TableHead>
                  <TableHead className="text-xs whitespace-nowrap hidden lg:table-cell">منبع</TableHead>
                  <TableHead className="text-xs whitespace-nowrap">وضعیت</TableHead>
                  <TableHead className="text-xs whitespace-nowrap hidden xl:table-cell">ددلاین</TableHead>
                  <TableHead className="text-xs whitespace-nowrap w-16 text-center">عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map((task) => {
                  const overdue = isOverdue(new Date(task.deadline), task.status);
                  return (
                    <TableRow key={task.id} className="group">
                      <TableCell className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {task.code}
                      </TableCell>
                      <TableCell
                        className="text-sm font-medium max-w-[200px] sm:max-w-[280px] cursor-pointer truncate"
                        onClick={() => openDetail(task)}
                      >
                        <span className="hover:text-primary transition-colors">
                          {task.title}
                        </span>
                        {overdue && (
                          <span className="inline-flex items-center gap-0.5 mr-1.5 text-[10px] text-rose-600 dark:text-rose-400">
                            <AlertTriangle className="h-2.5 w-2.5" />
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground hidden md:table-cell whitespace-nowrap">
                        {task.groupName}
                      </TableCell>
                      <TableCell className="text-xs hidden md:table-cell whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[9px] font-bold shrink-0">
                            {task.assigneeName.charAt(0)}
                          </span>
                          <span className="truncate max-w-[100px]">{task.assigneeName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <PriorityBadge priority={task.priority} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <SourceBadge source={task.source} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={task.status} />
                      </TableCell>
                      <TableCell className="hidden xl:table-cell whitespace-nowrap">
                        <span
                          className={cn(
                            "text-xs",
                            overdue
                              ? "text-rose-600 dark:text-rose-400 font-medium"
                              : "text-muted-foreground"
                          )}
                        >
                          {formatJalaliDate(new Date(task.deadline))}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openDetail(task)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        )}
      </Card>

      {/* ---- Task Detail Sheet ---- */}
      <TaskDetailSheet
        key={detailTask?.id ?? "closed"}
        task={detailTask}
        open={detailOpen}
        onOpenChange={(v) => {
          setDetailOpen(v);
          if (!v) setDetailTask(null);
        }}
        onUpdated={refreshAfterUpdate}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TaskDetailSheet — full detail with status change & logs             */
/* ------------------------------------------------------------------ */

function TaskDetailSheet({
  task,
  open,
  onOpenChange,
  onUpdated,
}: {
  task: SerializedTask | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdated: () => void;
}) {
  const [logs, setLogs] = React.useState<SerializedLog[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [showReasonPicker, setShowReasonPicker] = React.useState(false);
  const [showArchivePrompt, setShowArchivePrompt] = React.useState(false);

  React.useEffect(() => {
    if (!task) return;
    let cancelled = false;
    fetch(`/api/tasks/${task.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setLogs(d.logs ?? []);
      })
      .catch(() => {
        if (!cancelled) setLogs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [task]);

  if (!task) return null;

  const overdue = isOverdue(new Date(task.deadline), task.status);
  const dl = new Date(task.deadline);

  async function updateStatus(status: string) {
    if (!task) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLogs(data.logs ?? []);
      toast.success(
        status === "STARTED"
          ? "شروع کردم — وضعیت به‌روزرسانی شد."
          : status === "DONE"
            ? "تسک به‌عنوان انجام‌شده ثبت شد."
            : "وضعیت به‌روزرسانی شد."
      );
      if (status === "DONE") setShowArchivePrompt(true);
      onUpdated();
    } catch {
      toast.error("به‌روزرسانی وضعیت ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function setReason(reason: string) {
    if (!task) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followUpReason: reason, status: "BLOCKED" }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLogs(data.logs ?? []);
      toast.success("علت عدم انجام ثبت شد.");
      setShowReasonPicker(false);
      onUpdated();
    } catch {
      toast.error("ثبت علت ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-full sm:max-w-lg p-0 flex flex-col"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="outline" className="font-mono text-[11px]">
              {task.code}
            </Badge>
            {overdue && (
              <Badge className="bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 text-[11px]">
                عقب‌افتاده
              </Badge>
            )}
            {task.approvalStatus && (
              <ApprovalBadge approvalStatus={task.approvalStatus} />
            )}
          </div>
          <SheetTitle className="text-lg text-right leading-7">
            {task.title}
          </SheetTitle>
          <SheetDescription className="sr-only">جزئیات تسک</SheetDescription>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} />
            <SourceBadge source={task.source} />
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-5 py-4 space-y-4">
            {/* Referred task info */}
            {task.source === "REFERRED" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5 mb-2">
                  <FileText className="h-3.5 w-3.5" />
                  اطلاعات نامه ارجاع
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <MetaItem label="شماره نامه" value={task.letterNumber ?? "—"} />
                  <MetaItem label="تاریخ نامه" value={task.letterDate ?? "—"} />
                  <MetaItem label="مرجع" value={task.refererName ?? "—"} />
                  <MetaItem
                    label="وضعیت تأیید"
                    value={task.approvalStatusLabel ?? "—"}
                  />
                </div>
              </div>
            )}

            {/* Meta fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <MetaRow
                icon={<User className="h-4 w-4" />}
                label="مسئول"
                value={`${task.assigneeName} (${task.assigneeHandle})`}
              />
              <MetaRow
                icon={<CalendarClock className="h-4 w-4" />}
                label="ددلاین"
                value={`${formatJalaliLong(dl)} — ${toPersianDigits(formatTime(dl))}`}
                highlight={overdue}
              />
              {task.startTime && (
                <MetaRow
                  icon={<PlayCircle className="h-4 w-4" />}
                  label="زمان شروع"
                  value={`${formatJalaliLong(new Date(task.startTime))} — ${toPersianDigits(formatTime(new Date(task.startTime)))}`}
                />
              )}
              <MetaRow
                icon={<Clock className="h-4 w-4" />}
                label="تاریخ ثبت"
                value={`${formatJalaliDate(new Date(task.createdAt))} ${toPersianDigits(formatTime(new Date(task.createdAt)))}`}
              />
              {task.startedAt && (
                <MetaRow
                  icon={<PlayCircle className="h-4 w-4" />}
                  label="شروع واقعی"
                  value={`${formatJalaliDate(new Date(task.startedAt))} ${toPersianDigits(formatTime(new Date(task.startedAt)))}`}
                />
              )}
              {task.doneAt && (
                <MetaRow
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  label="انجام شده در"
                  value={`${formatJalaliDate(new Date(task.doneAt))} ${toPersianDigits(formatTime(new Date(task.doneAt)))}`}
                />
              )}
              <MetaRow
                icon={<Circle className="h-4 w-4" />}
                label="مجموعه"
                value={task.groupName ?? "—"}
              />
              <MetaRow
                icon={<FileText className="h-4 w-4" />}
                label="منبع"
                value={task.sourceLabel}
              />
            </div>

            {task.description && (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm leading-6">
                {task.description}
              </div>
            )}

            {task.link && (
              <a
                href={task.link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <Link2 className="h-4 w-4" />
                لینک مرتبط
              </a>
            )}

            {overdue && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
                این تسک{" "}
                {toPersianDigits(
                  Math.abs(daysBetween(dl, new Date()))
                )}{" "}
                روز از ددلاین گذشته است.
              </div>
            )}

            <Separator />

            {/* Action buttons */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <MessageSquare className="h-4 w-4" />
                اعلام وضعیت
              </div>

              {showArchivePrompt ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
                  <div className="flex items-start gap-2 text-sm text-emerald-800 dark:text-emerald-200">
                    <FileArchive className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">تسک انجام شد.</p>
                      <p className="mt-1 text-emerald-700/80 dark:text-emerald-300/80">
                        آخرین تغییرات یا فایل را ارسال کنید تا در آرشیو قرار گیرد.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => {
                          setShowArchivePrompt(false);
                          toast.success("ثبت شد.");
                        }}
                      >
                        تأیید
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <ActionBtn
                    disabled={
                      busy ||
                      task.status === "STARTED" ||
                      task.status === "DONE"
                    }
                    onClick={() => updateStatus("STARTED")}
                    active={task.status === "STARTED"}
                    className="border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
                  >
                    <PlayCircle className="h-4 w-4" />
                    شروع کردم
                  </ActionBtn>
                  <ActionBtn
                    disabled={busy || task.status === "DONE"}
                    onClick={() => setShowReasonPicker(true)}
                    active={task.status === "BLOCKED"}
                    className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    انجام نمی‌شود
                  </ActionBtn>
                  <ActionBtn
                    disabled={busy || task.status === "DONE"}
                    onClick={() => updateStatus("DONE")}
                    active={task.status === "DONE"}
                    className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    انجام شد
                  </ActionBtn>
                </div>
              )}

              {showReasonPicker && (
                <div className="rounded-lg border border-dashed p-3 space-y-2 bg-muted/30">
                  <p className="text-xs font-medium text-muted-foreground">
                    علت عدم انجام را انتخاب کنید:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {FOLLOW_UP_REASONS.map((r) => (
                      <Button
                        key={r.key}
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => setReason(r.key)}
                        className="justify-start text-xs"
                      >
                        {r.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Activity log */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <History className="h-4 w-4" />
                تاریخچه فعالیت
              </div>
              <div className="space-y-2">
                {logs.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    هنوز فعالیتی ثبت نشده است.
                  </p>
                )}
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-2 text-xs"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                    <div className="flex-1">
                      <p className="text-foreground/90">{log.message}</p>
                      <p className="text-muted-foreground mt-0.5">
                        {formatJalaliDate(new Date(log.createdAt))}{" "}
                        {toPersianDigits(formatTime(new Date(log.createdAt)))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                      */
/* ------------------------------------------------------------------ */

function ApprovalBadge({ approvalStatus }: { approvalStatus: string }) {
  const a = approvalStatusByKey(approvalStatus);
  if (!a) return null;
  const colorMap: Record<string, string> = {
    PENDING_APPROVAL:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
    APPROVED:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
    REJECTED:
      "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium",
        colorMap[approvalStatus] ?? colorMap.PENDING_APPROVAL
      )}
    >
      {a.label}
    </span>
  );
}

function MetaItem({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className={cn("text-xs", warn && "text-rose-600 dark:text-rose-400 font-medium")}>
        {value}
      </p>
    </div>
  );
}

function MetaRow({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div
          className={cn(
            highlight && "text-rose-600 dark:text-rose-400 font-medium"
          )}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function ActionBtn({
  children,
  active,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { active?: boolean }) {
  return (
    <Button
      size="sm"
      variant="outline"
      className={cn(
        "justify-center gap-1.5 text-xs h-9",
        active && "ring-2 ring-offset-1 ring-current/30",
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
}
