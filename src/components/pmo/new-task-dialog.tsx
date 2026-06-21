"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  DEPARTMENTS,
  PRIORITIES,
  type DepartmentKey,
  type PriorityKey,
} from "@/lib/constants";
import { deptClasses, deptDot } from "./badges";
import type { SerializedMember } from "@/lib/serialize";
import { useQuery } from "@tanstack/react-query";
import { formatJalaliLong, toPersianDigits, toGregorian, toEnglishDigits } from "@/lib/jalali";
import { CalendarClock, Check, ChevronLeft, ChevronRight, Plus, User, PlayCircle, CalendarRange } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}

const STEPS = [
  { key: "title", label: "عنوان تسک" },
  { key: "department", label: "بخش" },
  { key: "assignee", label: "مسئول" },
  { key: "priority", label: "اولویت" },
  { key: "schedule", label: "زمان‌بندی" },
] as const;

export function NewTaskDialog({ open, onOpenChange, onCreated }: Props) {
  const [step, setStep] = React.useState(0);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [department, setDepartment] = React.useState<DepartmentKey | null>(null);
  const [subDepartmentId, setSubDepartmentId] = React.useState<string | null>(null);
  const [assigneeId, setAssigneeId] = React.useState<string | null>(null);
  const [priority, setPriority] = React.useState<PriorityKey | null>(null);
  const [link, setLink] = React.useState("");
  const [startDate, setStartDate] = React.useState<Date | null>(null);
  const [startTime, setStartTime] = React.useState("09:00");
  const [deadlineDate, setDeadlineDate] = React.useState<Date | null>(null);
  const [deadlineTime, setDeadlineTime] = React.useState("18:00");
  const [busy, setBusy] = React.useState(false);

  const { data: membersData } = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const r = await fetch("/api/members");
      return (await r.json()) as { members: SerializedMember[] };
    },
  });

  // Sub-departments for the selected department
  const { data: subDeptsData } = useQuery({
    queryKey: ["sub-departments", department],
    queryFn: async () => {
      if (!department) return { subDepartments: [] };
      const r = await fetch(`/api/sub-departments?department=${department}`);
      return (await r.json()) as {
        subDepartments: { id: string; name: string; department: string }[];
      };
    },
    enabled: !!department,
  });
  const subDepts = subDeptsData?.subDepartments ?? [];

  // Reset on close
  React.useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep(0);
        setTitle("");
        setDescription("");
        setDepartment(null);
        setSubDepartmentId(null);
        setAssigneeId(null);
        setPriority(null);
        setLink("");
        setStartDate(null);
        setStartTime("09:00");
        setDeadlineDate(null);
        setDeadlineTime("18:00");
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  const members = (membersData?.members ?? []).filter(
    (m) => m.role === "MEMBER" && (!department || m.department === department)
  );

  const canNext = () => {
    switch (STEPS[step].key) {
      case "title":
        return title.trim().length > 1;
      case "department":
        return !!department;
      case "assignee":
        return !!assigneeId;
      case "priority":
        return !!priority;
      case "schedule":
        return !!deadlineDate;
    }
  };

  function next() {
    if (step < STEPS.length - 1 && canNext()) setStep((s) => s + 1);
  }
  function back() {
    if (step > 0) setStep((s) => s - 1);
  }

  async function submit() {
    if (!canNext() || !department || !assigneeId || !priority || !deadlineDate) return;
    setBusy(true);
    try {
      const [dhh, dmm] = deadlineTime.split(":").map((n) => parseInt(toEnglishDigits(n), 10));
      const d = new Date(deadlineDate);
      d.setHours(dhh || 18, dmm || 0, 0, 0);

      // Build optional start datetime
      let startISO: string | undefined;
      if (startDate) {
        const [shh, smm] = startTime.split(":").map((n) => parseInt(toEnglishDigits(n), 10));
        const s = new Date(startDate);
        s.setHours(shh || 9, smm || 0, 0, 0);
        if (s.getTime() >= d.getTime()) {
          toast.error("زمان شروع باید قبل از ددلاین باشد.");
          setBusy(false);
          return;
        }
        startISO = s.toISOString();
      }

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          department,
          subDepartmentId: subDepartmentId || undefined,
          assigneeId,
          priority,
          deadline: d.toISOString(),
          startTime: startISO,
          link: link.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? "خطا در ثبت تسک");
      }
      const data = await res.json();
      const assignee = membersData?.members.find((m) => m.id === assigneeId);
      toast.success(
        `✅ تسک «${title.trim()}» با شناسه ${data.task.code} برای ${assignee?.name ?? ""} در بخش ثبت شد.`
      );
      onCreated();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ثبت تسک ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  const finalDeadline = deadlineDate
    ? (() => {
        const [hh, mm] = deadlineTime.split(":").map((n) => parseInt(toEnglishDigits(n), 10));
        const d = new Date(deadlineDate);
        d.setHours(hh || 18, mm || 0, 0, 0);
        return d;
      })()
    : null;

  const finalStart = startDate
    ? (() => {
        const [hh, mm] = startTime.split(":").map((n) => parseInt(toEnglishDigits(n), 10));
        const d = new Date(startDate);
        d.setHours(hh || 9, mm || 0, 0, 0);
        return d;
      })()
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            ثبت تسک جدید
          </DialogTitle>
          <DialogDescription>
            فرآیند ساخت تسک توسط مدیر — ۵ مرحله. هیچ تسکی بدون ددلاین ثبت نمی‌شود.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-1 px-1 overflow-x-auto">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.key}>
              <button
                onClick={() => {
                  // allow going back to completed steps
                  if (i <= step) setStep(i);
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs whitespace-nowrap transition-colors",
                  i === step
                    ? "bg-primary text-primary-foreground"
                    : i < step
                    ? "bg-primary/10 text-primary hover:bg-primary/20"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full text-[10px]",
                    i < step ? "bg-primary text-primary-foreground" : "bg-background/50"
                  )}
                >
                  {i < step ? <Check className="h-3 w-3" /> : toPersianDigits(i + 1)}
                </span>
                {s.label}
              </button>
              {i < STEPS.length - 1 && (
                <div className="h-px flex-1 min-w-2 bg-border" />
              )}
            </React.Fragment>
          ))}
        </div>

        <ScrollArea className="flex-1 scroll-area-pmo -mx-1 px-1">
          <div className="py-2 space-y-4">
            {STEPS[step].key === "title" && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="title">عنوان تسک *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="مثلاً: تأمین کالکشن فانتزی پاییز"
                    autoFocus
                  />
                </div>
                <div>
                  <Label htmlFor="desc">توضیحات (اختیاری)</Label>
                  <Textarea
                    id="desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="توضیحات تکمیلی تسک..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="link">لینک مرتبط (اختیاری)</Label>
                  <Input
                    id="link"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://..."
                    dir="ltr"
                  />
                </div>
              </div>
            )}

            {STEPS[step].key === "department" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>بخش مربوطه را انتخاب کنید *</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {DEPARTMENTS.map((d) => (
                      <button
                        key={d.key}
                        onClick={() => {
                          setDepartment(d.key);
                          setSubDepartmentId(null);
                          setAssigneeId(null);
                        }}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border p-3 text-right text-sm transition-all",
                          department === d.key
                            ? "ring-2 ring-primary border-primary"
                            : "hover:border-primary/40 hover:bg-muted/50",
                          deptClasses[d.color]
                        )}
                      >
                        <span className={cn("h-2.5 w-2.5 rounded-full", deptDot[d.color])} />
                        <span className="flex-1 font-medium">{d.label}</span>
                        {department === d.key && <Check className="h-4 w-4" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sub-department picker (optional, appears when department has sub-units) */}
                {department && subDepts.length > 0 && (
                  <div className="space-y-2 pt-2 border-t">
                    <Label className="text-xs text-muted-foreground">
                      زیرمجموعه (اختیاری)
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setSubDepartmentId(null)}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-xs transition-all",
                          !subDepartmentId
                            ? "bg-primary text-primary-foreground border-primary"
                            : "hover:bg-muted"
                        )}
                      >
                        بدون زیرمجموعه
                      </button>
                      {subDepts.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setSubDepartmentId(s.id)}
                          className={cn(
                            "rounded-md border px-2.5 py-1 text-xs transition-all",
                            subDepartmentId === s.id
                              ? "bg-primary text-primary-foreground border-primary"
                              : "hover:bg-muted"
                          )}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {STEPS[step].key === "assignee" && (
              <div className="space-y-2">
                <Label>
                  شخص مسئول را انتخاب کنید{" "}
                  {department && (
                    <span className="text-muted-foreground text-xs">
                      (فیلتر شده بر اساس بخش)
                    </span>
                  )}
                </Label>
                {!department && (
                  <p className="text-xs text-muted-foreground">
                    ابتدا یک بخش انتخاب کنید. برای دیدن همه اعضا، بخش را پاک کنید.
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {members.length === 0 && (
                    <p className="text-sm text-muted-foreground col-span-full">
                      عضوی در این بخش یافت نشد.
                    </p>
                  )}
                  {members.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setAssigneeId(m.id)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border p-3 text-right text-sm transition-all",
                        assigneeId === m.id
                          ? "ring-2 ring-primary border-primary"
                          : "hover:border-primary/40 hover:bg-muted/50"
                      )}
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                        {m.name.charAt(0)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{m.name}</div>
                        <div className="text-xs text-muted-foreground" dir="ltr">
                          {m.handle}
                        </div>
                      </div>
                      {assigneeId === m.id && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {STEPS[step].key === "priority" && (
              <div className="space-y-2">
                <Label>اولویت تسک را مشخص کنید *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => setPriority(p.key)}
                      className={cn(
                        "rounded-lg border p-4 text-center transition-all",
                        priority === p.key
                          ? "ring-2 ring-primary border-primary"
                          : "hover:border-primary/40 hover:bg-muted/50",
                        p.key === "HIGH" && "border-rose-200",
                        p.key === "MEDIUM" && "border-amber-200",
                        p.key === "LOW" && "border-slate-200"
                      )}
                    >
                      <div className="text-lg font-bold">{p.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {STEPS[step].key === "schedule" && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  زمان شروع و ددلاین تسک را مشخص کنید. زمان شروع اختیاری است ولی ددلاین
                  الزامی است. زمان‌سنجی بر اساس Asia/Tehran است.
                </p>

                {/* Start time (optional) */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <PlayCircle className="h-4 w-4 text-sky-500" />
                    زمان شروع (اختیاری)
                  </Label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-right font-normal"
                          >
                            <CalendarRange className="h-4 w-4" />
                            {startDate
                              ? formatJalaliLong(startDate)
                              : "انتخاب تاریخ شروع..."}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={startDate ?? undefined}
                            onSelect={(d) => {
                              if (d) {
                                setStartDate(d);
                                // If no deadline yet, clear; if deadline before start, leave for validation
                              }
                            }}
                            disabled={(d) => {
                              const today = new Date(new Date().setHours(0, 0, 0, 0));
                              if (d < today) return true;
                              if (deadlineDate && d > deadlineDate) return true;
                              return false;
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="w-full sm:w-32">
                      <Input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        dir="ltr"
                      />
                    </div>
                    {startDate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() => setStartDate(null)}
                      >
                        حذف
                      </Button>
                    )}
                  </div>
                </div>

                {/* Deadline (required) */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <CalendarClock className="h-4 w-4 text-rose-500" />
                    ددلاین (تاریخ و ساعت دقیق) *
                  </Label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-right font-normal"
                          >
                            <CalendarClock className="h-4 w-4" />
                            {deadlineDate
                              ? formatJalaliLong(deadlineDate)
                              : "انتخاب تاریخ ددلاین..."}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={deadlineDate ?? undefined}
                            onSelect={(d) => d && setDeadlineDate(d)}
                            disabled={(d) => {
                              const today = new Date(new Date().setHours(0, 0, 0, 0));
                              if (d < today) return true;
                              if (startDate && d < startDate) return true;
                              return false;
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="w-full sm:w-32">
                      <Input
                        type="time"
                        value={deadlineTime}
                        onChange={(e) => setDeadlineTime(e.target.value)}
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>

                {/* Summary preview */}
                {(startDate || deadlineDate) && (
                  <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1.5">
                    {finalStart && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <PlayCircle className="h-3.5 w-3.5 text-sky-500" />
                          شروع:
                        </span>
                        <span className="font-medium nums-fa">
                          {formatJalaliLong(finalStart)} —{" "}
                          {toPersianDigits(
                            `${String(finalStart.getHours()).padStart(2, "0")}:${String(
                              finalStart.getMinutes()
                            ).padStart(2, "0")}`
                          )}
                        </span>
                      </div>
                    )}
                    {finalDeadline && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <CalendarClock className="h-3.5 w-3.5 text-rose-500" />
                          ددلاین:
                        </span>
                        <span className="font-medium nums-fa">
                          {formatJalaliLong(finalDeadline)} —{" "}
                          {toPersianDigits(
                            `${String(finalDeadline.getHours()).padStart(2, "0")}:${String(
                              finalDeadline.getMinutes()
                            ).padStart(2, "0")}`
                          )}
                        </span>
                      </div>
                    )}
                    {finalStart && finalDeadline && (
                      <div className="flex items-center justify-between pt-1.5 border-t">
                        <span className="text-muted-foreground">مدت زمان:</span>
                        <span className="font-medium nums-fa text-primary">
                          {toPersianDigits(
                            Math.max(
                              1,
                              Math.round(
                                (finalDeadline.getTime() - finalStart.getTime()) / 3600000
                              )
                            )
                          )}{" "}
                          ساعت
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex !flex-row !justify-between gap-2 border-t pt-4">
          <Button variant="ghost" onClick={back} disabled={step === 0}>
            <ChevronRight className="h-4 w-4" />
            قبلی
          </Button>
          <div className="flex gap-2">
            {step < STEPS.length - 1 ? (
              <Button onClick={next} disabled={!canNext()}>
                بعدی
                <ChevronLeft className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={submit} disabled={!canNext() || busy}>
                {busy ? "در حال ثبت..." : "ثبت تسک"}
                <Check className="h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
