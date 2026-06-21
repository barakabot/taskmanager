"use client";

import * as React from "react";
import {
  toJalali,
  toGregorian,
  toPersianDigits,
  JALALI_MONTHS,
  PERSIAN_WEEKDAYS_SHORT,
  isSameDay,
  startOfDay,
} from "@/lib/jalali";
import type { SerializedTask } from "@/lib/serialize";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  ChevronLeft,
  CalendarDays,
  AlertTriangle,
} from "lucide-react";

// Build a 6x7 grid of cells for a Jalali month.
// Each cell is a Gregorian Date (so we keep Date semantics consistent).
// Week starts on Saturday (Persian week).
function buildMonthGrid(jYear: number, jMonth: number): (Date | null)[] {
  // First day of the Jalali month, in Gregorian
  const [gy, gm, gd] = toGregorian(jYear, jMonth, 1);
  const first = new Date(gy, gm - 1, gd);
  // JS getDay: 0=Sun ... 6=Sat. Persian week starts Saturday(6).
  // Map: Sat=0, Sun=1, Mon=2, ..., Fri=6
  const persianDayIndex = (first.getDay() + 1) % 7;
  const leadNulls = Array(persianDayIndex).fill(null);

  // Days in the Jalali month:
  // Months 1-6 = 31 days, 7-11 = 30 days, 12 = 29 (or 30 in leap years)
  let daysInMonth: number;
  if (jMonth <= 6) daysInMonth = 31;
  else if (jMonth <= 11) daysInMonth = 30;
  else {
    // Esfand — check leap year (simple heuristic: 29 always works for grid)
    daysInMonth = 29;
    // Detect 30-day Esfand via round-trip: if day 30 converts back validly
    const [gy30, gm30, gd30] = toGregorian(jYear, 12, 30);
    const d30 = new Date(gy30, gm30 - 1, gd30);
    const [vy, vm, vd] = toJalali(d30.getFullYear(), d30.getMonth() + 1, d30.getDate());
    if (vy === jYear && vm === 12 && vd === 30) daysInMonth = 30;
  }

  const cells: (Date | null)[] = [...leadNulls];
  for (let d = 1; d <= daysInMonth; d++) {
    const [y, m, gd] = toGregorian(jYear, jMonth, d);
    cells.push(new Date(y, m - 1, gd));
  }
  // Pad to 42 cells (6 rows)
  while (cells.length < 42) cells.push(null);
  return cells;
}

export function isOverdueTask(t: SerializedTask): boolean {
  return t.status !== "DONE" && new Date(t.deadline).getTime() < Date.now();
}

interface Props {
  tasks: SerializedTask[];
  onTaskClick?: (t: SerializedTask) => void;
  selectedDate?: Date | null;
  onSelectDate?: (d: Date) => void;
}

export function ShamsiCalendar({ tasks, onTaskClick, selectedDate, onSelectDate }: Props) {
  const today = new Date();
  const [jy, jm] = toJalali(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const [viewYear, setViewYear] = React.useState(jy);
  const [viewMonth, setViewMonth] = React.useState(jm);

  const cells = buildMonthGrid(viewYear, viewMonth);

  // Group tasks by deadline day
  const tasksByDay = React.useMemo(() => {
    const map = new Map<string, SerializedTask[]>();
    for (const t of tasks) {
      const d = new Date(t.deadline);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [tasks]);

  function prevMonth() {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }
  function nextMonth() {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }
  function goToday() {
    const [ty, tm] = toJalali(today.getFullYear(), today.getMonth() + 1, today.getDate());
    setViewYear(ty);
    setViewMonth(tm);
  }

  // Stats for current view
  const overdueCount = tasks.filter(isOverdueTask).length;
  const todayTasks = tasks.filter((t) => isSameDay(new Date(t.deadline), today)).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">
            {JALALI_MONTHS[viewMonth - 1]} {toPersianDigits(viewYear)}
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={goToday}
            className="text-xs px-2.5 py-1 rounded-md border hover:bg-muted transition-colors"
          >
            امروز
          </button>
          <button
            onClick={prevMonth}
            className="h-8 w-8 rounded-md border hover:bg-muted transition-colors flex items-center justify-center"
            title="ماه قبل"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={nextMonth}
            className="h-8 w-8 rounded-md border hover:bg-muted transition-colors flex items-center justify-center"
            title="ماه بعد"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-2 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
          عقب‌افتاده
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          امروز
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
          در حال انجام
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
          آینده / در صف
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          انجام‌شده
        </span>
        <span className="mr-auto flex items-center gap-2 nums-fa">
          {overdueCount > 0 && (
            <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
              <AlertTriangle className="h-3 w-3" />
              {toPersianDigits(overdueCount)} عقب‌افتاده
            </span>
          )}
          <span className="text-amber-600 dark:text-amber-400 font-medium">
            {toPersianDigits(todayTasks)} امروز
          </span>
        </span>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {PERSIAN_WEEKDAYS_SHORT.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-medium text-muted-foreground py-1.5"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1 flex-1 min-h-0">
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="rounded-md bg-transparent" />;
          const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
          const dayTasks = tasksByDay.get(key) ?? [];
          const isToday = isSameDay(date, today);
          const isSelected = selectedDate && isSameDay(date, selectedDate);
          const [cy, cm, cd] = toJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
          const inCurrentMonth = cy === viewYear && cm === viewMonth;
          const hasOverdue = dayTasks.some(isOverdueTask);

          return (
            <button
              key={i}
              onClick={() => onSelectDate?.(date)}
              className={cn(
                "relative rounded-md border p-1.5 text-right transition-all hover:shadow-sm flex flex-col gap-1 min-h-[68px]",
                inCurrentMonth ? "bg-card" : "bg-muted/30 opacity-50",
                isToday && "ring-2 ring-amber-400 border-amber-300",
                isSelected && !isToday && "ring-2 ring-primary border-primary",
                hasOverdue && inCurrentMonth && "border-r-2 border-r-rose-500"
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-xs font-medium nums-fa",
                    isToday && "inline-flex items-center justify-center h-5 w-5 rounded-full bg-amber-500 text-white"
                  )}
                >
                  {toPersianDigits(cd)}
                </span>
                {dayTasks.length > 0 && (
                  <span className="text-[10px] text-muted-foreground nums-fa">
                    {toPersianDigits(dayTasks.length)}
                  </span>
                )}
              </div>
              {/* Task dots */}
              {dayTasks.length > 0 && (
                <div className="flex flex-wrap gap-0.5 mt-auto">
                  {dayTasks.slice(0, 4).map((t) => {
                    const color =
                      t.status === "DONE"
                        ? "bg-emerald-500"
                        : isOverdueTask(t)
                        ? "bg-rose-500"
                        : t.status === "STARTED"
                        ? "bg-sky-500"
                        : isToday
                        ? "bg-amber-500"
                        : "bg-slate-400";
                    return (
                      <span
                        key={t.id}
                        className={cn("h-1.5 w-1.5 rounded-full", color)}
                        title={t.title}
                      />
                    );
                  })}
                  {dayTasks.length > 4 && (
                    <span className="text-[9px] text-muted-foreground nums-fa">
                      +{toPersianDigits(dayTasks.length - 4)}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { buildMonthGrid };
