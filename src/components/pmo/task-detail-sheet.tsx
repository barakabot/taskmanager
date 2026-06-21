"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  DepartmentBadge,
  PriorityBadge,
  StatusBadge,
  ReasonBadge,
} from "./badges";
import { FOLLOW_UP_REASONS, STATUSES } from "@/lib/constants";
import type { SerializedTask, SerializedLog } from "@/lib/serialize";
import {
  formatJalaliLong,
  formatTime,
  formatJalaliDate,
  toPersianDigits,
  isOverdue,
  daysBetween,
} from "@/lib/jalali";
import {
  Clock,
  User,
  Link2,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  CalendarClock,
  History,
  FileArchive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  task: SerializedTask | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdated: () => void;
}

export function TaskDetailSheet({ task, open, onOpenChange, onUpdated }: Props) {
  const [logs, setLogs] = React.useState<SerializedLog[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [showReasonPicker, setShowReasonPicker] = React.useState(false);
  const [showArchivePrompt, setShowArchivePrompt] = React.useState(false);

  React.useEffect(() => {
    if (!task) return;
    setShowReasonPicker(false);
    setShowArchivePrompt(false);
    fetch(`/api/tasks/${task.id}`)
      .then((r) => r.json())
      .then((d) => setLogs(d.logs ?? []))
      .catch(() => setLogs([]));
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
          ? "🟢 شروع کردم — وضعیت به‌روزرسانی شد."
          : status === "DONE"
          ? "✅ تسک به‌عنوان انجام‌شده ثبت شد."
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
      toast.success("علت عدم انجام ثبت شد و در گزارش مدیر لحاظ خواهد شد.");
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
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="font-mono text-xs">
              {task.code}
            </Badge>
            {overdue && (
              <Badge className="bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300">
                🔴 عقب‌افتاده
              </Badge>
            )}
          </div>
          <SheetTitle className="text-xl text-right leading-7">
            {task.title}
          </SheetTitle>
          <SheetDescription className="sr-only">جزئیات تسک</SheetDescription>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <DepartmentBadge department={task.department} />
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} />
            {task.followUpReason && <ReasonBadge reason={task.followUpReason} />}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 scroll-area-pmo">
          <div className="px-6 py-5 space-y-5">
            {/* Meta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <MetaRow
                icon={<User className="h-4 w-4" />}
                label="مسئول"
                value={`${task.assigneeName} (${task.assigneeHandle})`}
              />
              <MetaRow
                icon={<CalendarClock className="h-4 w-4" />}
                label="ددلاین (تاریخ انجام)"
                value={`${formatJalaliLong(dl)} — ${toPersianDigits(
                  formatTime(dl)
                )}`}
                highlight={overdue}
              />
              {task.startTime && (
                <MetaRow
                  icon={<PlayCircle className="h-4 w-4" />}
                  label="زمان شروع برنامه‌ریزی‌شده"
                  value={`${formatJalaliLong(new Date(task.startTime))} — ${toPersianDigits(
                    formatTime(new Date(task.startTime))
                  )}`}
                />
              )}
              <MetaRow
                icon={<Clock className="h-4 w-4" />}
                label="زمان ثبت تسک"
                value={`${formatJalaliDate(new Date(task.createdAt))} ${toPersianDigits(
                  formatTime(new Date(task.createdAt))
                )}`}
              />
              {task.startedAt && (
                <MetaRow
                  icon={<PlayCircle className="h-4 w-4" />}
                  label="شروع واقعی کار"
                  value={`${formatJalaliDate(new Date(task.startedAt))} ${toPersianDigits(
                    formatTime(new Date(task.startedAt))
                  )}`}
                />
              )}
              {task.doneAt && (
                <MetaRow
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  label="انجام شده در"
                  value={`${formatJalaliDate(new Date(task.doneAt))} ${toPersianDigits(
                    formatTime(new Date(task.doneAt))
                  )}`}
                />
              )}
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
                {toPersianDigits(Math.abs(daysBetween(dl, new Date())))} روز از
                ددلاین گذشته است.
              </div>
            )}

            <Separator />

            {/* Action panel: simulates bot inline keyboard */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <MessageSquare className="h-4 w-4" />
                اعلام وضعیت
              </div>
              <p className="text-xs text-muted-foreground">
                لطفاً وضعیت خود را مشخص کنید. این دکمه‌ها معادل دکمه‌های اینلاین ربات
                هستند.
              </p>

              {showArchivePrompt ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
                  <div className="flex items-start gap-2 text-sm text-emerald-800 dark:text-emerald-200">
                    <FileArchive className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">✅ تسک انجام شد.</p>
                      <p className="mt-1 text-emerald-700/80 dark:text-emerald-300/80">
                        آخرین تغییرات یا فایل را ارسال کنید تا در آرشیو قرار گیرد.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => {
                          setShowArchivePrompt(false);
                          toast.success("ثبت شد. (در نسخه ربات فایل قابل ارسال است.)");
                        }}
                      >
                        تأیید
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <ActionButton
                    disabled={busy || task.status === "STARTED" || task.status === "DONE"}
                    onClick={() => updateStatus("STARTED")}
                    active={task.status === "STARTED"}
                    className="border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
                  >
                    <PlayCircle className="h-4 w-4" />
                    شروع کردم
                  </ActionButton>
                  <ActionButton
                    disabled={busy || task.status === "DONE"}
                    onClick={() => setShowReasonPicker((v) => !v)}
                    active={task.status === "BLOCKED"}
                    className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    انجام نمی‌شود
                  </ActionButton>
                  <ActionButton
                    disabled={busy || task.status === "DONE"}
                    onClick={() => updateStatus("DONE")}
                    active={task.status === "DONE"}
                    className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    انجام شد
                  </ActionButton>
                </div>
              )}

              {showReasonPicker && (
                <div className="rounded-lg border border-dashed p-3 space-y-2 bg-muted/30">
                  <p className="text-xs font-medium text-muted-foreground">
                    علت عدم انجام را انتخاب کنید تا در گزارش مدیر ثبت شود:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {FOLLOW_UP_REASONS.map((r) => (
                      <Button
                        key={r.key}
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => setReason(r.key)}
                        className="justify-start"
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
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                    <div className="flex-1">
                      <p className="text-foreground/90">{log.message}</p>
                      <p className="text-muted-foreground mt-0.5 nums-fa">
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
            "nums-fa",
            highlight && "text-rose-600 dark:text-rose-400 font-medium"
          )}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function ActionButton({
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
