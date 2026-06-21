import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeTask } from "@/lib/serialize";
import { isSameDay, formatJalaliDate, toPersianDigits } from "@/lib/jalali";
import { FOLLOW_UP_REASONS, DEPARTMENTS } from "@/lib/constants";
import { getCurrentMember } from "@/lib/auth";

// GET /api/reports/evening (MANAGER ONLY)
// Simulates the 19:00 cron job: comprehensive manager report.
export async function GET() {
  const me = await getCurrentMember();
  if (!me) {
    return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
  }
  if (me.role !== "MANAGER") {
    return NextResponse.json(
      { error: "گزارش پایان روز فقط برای مدیر قابل دسترسی است." },
      { status: 403 }
    );
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tasks = await db.task.findMany({
    include: { assignee: true },
    orderBy: { deadline: "asc" },
  });

  const done = tasks.filter(
    (t) => t.status === "DONE" && t.doneAt && isSameDay(t.doneAt, now)
  );
  const inProgress = tasks.filter((t) => t.status === "STARTED");
  const notDoneToday = tasks.filter(
    (t) =>
      t.status !== "DONE" &&
      t.deadline.getTime() < now.getTime() &&
      !isSameDay(t.deadline, now) // overdue from before today
  );
  const dueTodayNotDone = tasks.filter(
    (t) => t.status !== "DONE" && isSameDay(t.deadline, now)
  );

  // Obstacle analysis
  const obstacles = FOLLOW_UP_REASONS.map((r) => ({
    key: r.key,
    label: r.label,
    count: tasks.filter((t) => t.status === "BLOCKED" && t.followUpReason === r.key).length,
  }));

  // Per-department breakdown
  const byDept = DEPARTMENTS.map((d) => {
    const dt = tasks.filter((t) => t.department === d.key);
    return {
      key: d.key,
      label: d.label,
      color: d.color,
      done: dt.filter((t) => t.status === "DONE").length,
      inProgress: dt.filter((t) => t.status === "STARTED").length,
      blocked: dt.filter((t) => t.status === "BLOCKED").length,
      pending: dt.filter((t) => t.status === "PENDING").length,
      overdue: dt.filter((t) => t.status !== "DONE" && t.deadline.getTime() < now.getTime()).length,
    };
  });

  return NextResponse.json({
    date: formatJalaliDate(now),
    done: done.map(serializeTask),
    inProgress: inProgress.map(serializeTask),
    notDone: [...dueTodayNotDone, ...notDoneToday].map(serializeTask),
    obstacles,
    byDept,
    stats: {
      doneCount: done.length,
      inProgressCount: inProgress.length,
      notDoneCount: dueTodayNotDone.length + notDoneToday.length,
      totalBlocked: tasks.filter((t) => t.status === "BLOCKED").length,
    },
    obstacleSummary: obstacles.map((o) => `${o.label}: ${toPersianDigits(o.count)} مورد`).join(" | "),
  });
}
