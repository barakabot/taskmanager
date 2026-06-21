import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeTask } from "@/lib/serialize";
import { isSameDay, formatJalaliDate, formatTime, toPersianDigits } from "@/lib/jalali";
import { DEPARTMENTS } from "@/lib/constants";
import { getCurrentMember } from "@/lib/auth";

// GET /api/reports/morning (MANAGER ONLY)
// Simulates the 08:00 cron job: for each member, list tasks whose deadline is today or earlier (and not done).
export async function GET() {
  const me = await getCurrentMember();
  if (!me) {
    return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
  }
  if (me.role !== "MANAGER") {
    return NextResponse.json(
      { error: "گزارش‌های صبحگاهی فقط برای مدیر قابل دسترسی است." },
      { status: 403 }
    );
  }

  const now = new Date();
  const members = await db.member.findMany({
    where: { role: "MEMBER" },
    orderBy: { name: "asc" },
  });

  const allTasks = await db.task.findMany({
    where: { status: { not: "DONE" } },
    include: { assignee: true, subDepartment: true },
    orderBy: { deadline: "asc" },
  });

  const briefings = members.map((m) => {
    const tasks = allTasks.filter((t) => t.assigneeId === m.id);
    const todayTasks = tasks.filter((t) => isSameDay(t.deadline, now));
    const overdueTasks = tasks.filter((t) => t.deadline.getTime() < now.getTime() && !isSameDay(t.deadline, now));
    const dept = DEPARTMENTS.find((d) => d.key === m.department);
    return {
      member: {
        id: m.id,
        name: m.name,
        handle: m.handle,
        department: m.department,
        departmentLabel: dept?.label ?? m.department,
      },
      today: todayTasks.map(serializeTask),
      overdue: overdueTasks.map(serializeTask),
    };
  });

  return NextResponse.json({
    date: formatJalaliDate(now),
    time: formatTime(now),
    briefings: briefings.filter((b) => b.today.length > 0 || b.overdue.length > 0),
    totalActive: allTasks.length,
    summaryNote: `گزارش کارهای روزانه — ${toPersianDigits(briefings.reduce((acc, b) => acc + b.today.length + b.overdue.length, 0))} تسک فعال در ${toPersianDigits(briefings.filter((b) => b.today.length || b.overdue.length).length)} کاربر.`,
  });
}
