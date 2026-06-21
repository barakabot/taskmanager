"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import {
  DepartmentBadge,
  PriorityBadge,
} from "./badges";
import type { SerializedTask } from "@/lib/serialize";
import {
  formatJalaliDate,
  formatTime,
  toPersianDigits,
  isOverdue,
  isToday,
  daysBetween,
} from "@/lib/jalali";
import { CalendarClock, Link2, AlertTriangle, GripVertical, PlayCircle } from "lucide-react";

interface Props {
  task: SerializedTask;
  onClick?: () => void;
  className?: string;
  compact?: boolean;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
}

export function TaskCard({
  task,
  onClick,
  className,
  compact,
  dragHandleProps,
  isDragging,
}: Props) {
  const dl = new Date(task.deadline);
  const st = task.startTime ? new Date(task.startTime) : null;
  const overdue = isOverdue(dl, task.status);
  const today = isToday(dl);
  const days = daysBetween(dl, new Date());
  const notStartedYet = st && task.status === "PENDING" && st.getTime() > Date.now();

  return (
    <Card
      onClick={onClick}
      className={cn(
        "group relative cursor-pointer p-3 transition-all hover:shadow-md hover:border-primary/40",
        isDragging && "opacity-50 rotate-2 shadow-lg",
        overdue && "border-r-4 border-r-rose-500",
        today && !overdue && "border-r-4 border-r-amber-500",
        className
      )}
    >
      <div className="flex items-start gap-2">
        <div
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/50 mt-0.5"
          {...dragHandleProps}
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <span className="font-mono text-[10px] text-muted-foreground">
              {task.code}
            </span>
            {overdue && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-rose-600 dark:text-rose-400 font-medium">
                <AlertTriangle className="h-3 w-3" />
                عقب‌افتاده
                {!today && (
                  <span className="nums-fa">
                    ({toPersianDigits(Math.abs(days))} روز)
                  </span>
                )}
              </span>
            )}
            {notStartedYet && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-sky-600 dark:text-sky-400 font-medium">
                <PlayCircle className="h-3 w-3" />
                شروع از {toPersianDigits(formatJalaliDate(st!))}
              </span>
            )}
          </div>
          <h4 className="text-sm font-medium leading-6 line-clamp-2 mb-2">
            {task.title}
          </h4>
          {!compact && (
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <DepartmentBadge department={task.department} />
              <PriorityBadge priority={task.priority} />
            </div>
          )}
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0">
                {task.assigneeName.charAt(0)}
              </span>
              <span className="truncate">{task.assigneeName}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {st && !compact && (
                <span className="flex items-center gap-1 nums-fa text-sky-600 dark:text-sky-400">
                  <PlayCircle className="h-3 w-3" />
                  {toPersianDigits(formatTime(st))}
                </span>
              )}
              <span
                className={cn(
                  "flex items-center gap-1 nums-fa",
                  overdue
                    ? "text-rose-600 dark:text-rose-400 font-medium"
                    : today
                    ? "text-amber-600 dark:text-amber-400 font-medium"
                    : "text-muted-foreground"
                )}
              >
                <CalendarClock className="h-3 w-3" />
                {formatJalaliDate(dl)}{" "}
                <span className="opacity-70">
                  {toPersianDigits(formatTime(dl))}
                </span>
              </span>
            </div>
          </div>
          {task.link && (
            <div className="mt-2 flex items-center gap-1 text-xs text-primary">
              <Link2 className="h-3 w-3" />
              <span className="truncate" dir="ltr">
                لینک
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
