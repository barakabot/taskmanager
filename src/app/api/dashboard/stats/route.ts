import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toJalali, toPersianDigits } from "@/lib/jalali";
import { DEPARTMENTS } from "@/lib/constants";
import { getCurrentMember } from "@/lib/auth";

// GET /api/dashboard/stats
// Aggregated statistics for the BI dashboard (MANAGER ONLY):
//  - counts by status
//  - overdue share per department (pie)
//  - weekly done trend (bar)
//  - delay heatmap by weekday x hour (which day/hour has most overdue)
//  - obstacle analysis (blocked reasons)
export async function GET() {
  const me = await getCurrentMember();
  if (!me) {
    return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
  }
  if (me.role !== "MANAGER") {
    return NextResponse.json(
      { error: "داشبورد هوش تجاری فقط برای مدیر قابل دسترسی است." },
      { status: 403 }
    );
  }

  const tasks = await db.task.findMany({ include: { assignee: true } });
  const now = new Date();
  const nowMs = now.getTime();

  // ---- Status counts ----
  const statusCounts: Record<string, number> = {
    PENDING: 0,
    STARTED: 0,
    BLOCKED: 0,
    DONE: 0,
  };
  for (const t of tasks) statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1;

  // ---- Overdue per department (pie) ----
  const overdueByDept = DEPARTMENTS.map((d) => ({
    key: d.key,
    label: d.label,
    color: d.color,
    value: tasks.filter(
      (t) => t.department === d.key && t.status !== "DONE" && t.deadline.getTime() < nowMs
    ).length,
  }));

  // ---- Weekly done trend (last 8 ISO weeks) ----
  const weekMap = new Map<string, number>();
  for (let i = 7; i >= 0; i--) {
    const ref = new Date(nowMs - i * 7 * 86400000);
    const year = ref.getFullYear();
    const firstJan = new Date(year, 0, 1);
    const week = Math.ceil(((ref.getTime() - firstJan.getTime()) / 86400000 + firstJan.getDay() + 1) / 7);
    const key = `${year}-W${String(week).padStart(2, "0")}`;
    weekMap.set(key, 0);
  }
  for (const t of tasks) {
    if (t.status === "DONE" && t.doneAt) {
      const year = t.doneAt.getFullYear();
      const firstJan = new Date(year, 0, 1);
      const week = Math.ceil(((t.doneAt.getTime() - firstJan.getTime()) / 86400000 + firstJan.getDay() + 1) / 7);
      const key = `${year}-W${String(week).padStart(2, "0")}`;
      if (weekMap.has(key)) weekMap.set(key, (weekMap.get(key) ?? 0) + 1);
    }
  }
  const weeklyDone = Array.from(weekMap.entries()).map(([k, v]) => ({
    week: k.split("-")[1],
    label: toPersianDigits(k.split("-")[1]),
    value: v,
  }));

  // ---- Delay heatmap: weekday (Sat..Fri = 6..5 mapped) x hour bucket ----
  // We bucket deadline hours into: صبح (8-12), ظهر (12-14), عصر (14-18), شب (18-22)
  const hourBuckets = [
    { key: "08-12", label: "۸–۱۲ صبح" },
    { key: "12-14", label: "۱۲–۱۴ ظهر" },
    { key: "14-18", label: "۱۴–۱۸ عصر" },
    { key: "18-22", label: "۱۸–۲۲ شب" },
  ];
  // Persian weekday order: شنبه(6)->..->جمعه(5). We'll map JS getDay() to Persian index.
  // JS: 0=Sun,1=Mon,...,6=Sat. Persian order starts Sat.
  const persianWeekOrder = [6, 0, 1, 2, 3, 4, 5]; // Sat, Sun, Mon, Tue, Wed, Thu, Fri
  const persianWeekLabels = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

  // Initialize heatmap
  const heatmap: Record<string, Record<string, number>> = {};
  for (const dIdx of persianWeekOrder) {
    heatmap[dIdx] = {};
    for (const b of hourBuckets) heatmap[dIdx][b.key] = 0;
  }

  for (const t of tasks) {
    if (t.status === "DONE") continue;
    if (t.deadline.getTime() >= nowMs) continue; // not overdue
    const d = t.deadline;
    const dayIdx = d.getDay();
    const h = d.getHours();
    let bucket: string | null = null;
    if (h >= 8 && h < 12) bucket = "08-12";
    else if (h >= 12 && h < 14) bucket = "12-14";
    else if (h >= 14 && h < 18) bucket = "14-18";
    else if (h >= 18 && h < 22) bucket = "18-22";
    if (bucket) heatmap[dayIdx][bucket] += 1;
  }

  const heatmapRows = persianWeekOrder.map((dIdx, i) => ({
    day: persianWeekLabels[i],
    cells: hourBuckets.map((b) => ({
      bucket: b.key,
      bucketLabel: b.label,
      value: heatmap[dIdx][b.key],
    })),
  }));

  // ---- Obstacle analysis (blocked reasons) ----
  const reasonMap: Record<string, number> = {};
  for (const t of tasks) {
    if (t.status === "BLOCKED" && t.followUpReason) {
      reasonMap[t.followUpReason] = (reasonMap[t.followUpReason] ?? 0) + 1;
    }
  }
  const obstacles = [
    { key: "DEPENDENT_ON_OTHERS", label: "وابسته به شخص دیگر", value: reasonMap["DEPENDENT_ON_OTHERS"] ?? 0 },
    { key: "LACK_OF_INFO", label: "کمبود اطلاعات", value: reasonMap["LACK_OF_INFO"] ?? 0 },
    { key: "HIGH_WORKLOAD", label: "حجم بالای کار", value: reasonMap["HIGH_WORKLOAD"] ?? 0 },
    { key: "TECHNICAL_ISSUE", label: "مشکل فنی", value: reasonMap["TECHNICAL_ISSUE"] ?? 0 },
    { key: "OTHER", label: "سایر", value: reasonMap["OTHER"] ?? 0 },
  ];

  // ---- Department workload summary ----
  const deptSummary = DEPARTMENTS.map((d) => {
    const dt = tasks.filter((t) => t.department === d.key);
    return {
      key: d.key,
      label: d.label,
      color: d.color,
      total: dt.length,
      done: dt.filter((t) => t.status === "DONE").length,
      active: dt.filter((t) => t.status !== "DONE").length,
      overdue: dt.filter((t) => t.status !== "DONE" && t.deadline.getTime() < nowMs).length,
      blocked: dt.filter((t) => t.status === "BLOCKED").length,
    };
  });

  // ---- Today's date in Jalali ----
  const [jy, jm, jd] = toJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const today = `${toPersianDigits(jy)}/${toPersianDigits(String(jm).padStart(2, "0"))}/${toPersianDigits(String(jd).padStart(2, "0"))}`;

  return NextResponse.json({
    today,
    totals: {
      all: tasks.length,
      ...statusCounts,
      overdue: tasks.filter((t) => t.status !== "DONE" && t.deadline.getTime() < nowMs).length,
      todayDue: tasks.filter(
        (t) =>
          t.status !== "DONE" &&
          t.deadline.getFullYear() === now.getFullYear() &&
          t.deadline.getMonth() === now.getMonth() &&
          t.deadline.getDate() === now.getDate()
      ).length,
    },
    overdueByDept,
    weeklyDone,
    hourBuckets,
    heatmapRows,
    obstacles,
    deptSummary,
  });
}
