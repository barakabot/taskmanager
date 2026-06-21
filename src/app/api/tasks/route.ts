import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeTask } from "@/lib/serialize";
import { DEPARTMENTS } from "@/lib/constants";
import { getCurrentMember } from "@/lib/auth";

// GET /api/tasks?status=&department=&priority=&overdue=&assigneeId=
// Enforces: members only see their own tasks; managers see all.
export async function GET(req: NextRequest) {
  const me = await getCurrentMember();
  if (!me) {
    return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const department = searchParams.get("department");
  const priority = searchParams.get("priority");
  const overdue = searchParams.get("overdue") === "1";
  const assigneeIdParam = searchParams.get("assigneeId");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (department) where.department = department;
  if (priority) where.priority = priority;

  // Role-based visibility: members are locked to their own tasks.
  if (me.role === "MANAGER") {
    if (assigneeIdParam) where.assigneeId = assigneeIdParam;
  } else {
    where.assigneeId = me.id;
  }

  const tasks = await db.task.findMany({
    where,
    include: { assignee: true },
    orderBy: { deadline: "asc" },
  });

  let result = tasks.map(serializeTask);
  if (overdue) {
    const now = Date.now();
    result = result.filter((t) => t.status !== "DONE" && new Date(t.deadline).getTime() < now);
  }

  return NextResponse.json({ tasks: result });
}

// POST /api/tasks — MANAGER ONLY creates a new task
export async function POST(req: NextRequest) {
  const me = await getCurrentMember();
  if (!me) {
    return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
  }
  if (me.role !== "MANAGER") {
    return NextResponse.json(
      { error: "تنها مدیر می‌تواند تسک جدید ثبت کند." },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { title, department, assigneeId, priority, deadline, startTime, link, description } = body ?? {};

  if (!title || !department || !assigneeId || !priority || !deadline) {
    return NextResponse.json(
      { error: "فیلدهای ضروری ناقص است. عنوان، بخش، مسئول، اولویت و ددلاین الزامی است." },
      { status: 400 }
    );
  }
  if (!DEPARTMENTS.some((d) => d.key === department)) {
    return NextResponse.json({ error: "بخش نامعتبر است." }, { status: 400 });
  }

  const assignee = await db.member.findUnique({ where: { id: assigneeId } });
  if (!assignee) {
    return NextResponse.json({ error: "مسئول یافت نشد." }, { status: 400 });
  }

  // Validate that start time (if provided) is before the deadline.
  const deadlineDate = new Date(deadline);
  const startDate = startTime ? new Date(startTime) : null;
  if (startDate && startDate.getTime() >= deadlineDate.getTime()) {
    return NextResponse.json(
      { error: "زمان شروع باید قبل از ددلاین باشد." },
      { status: 400 }
    );
  }

  // Generate next code
  const count = await db.task.count();
  const code = `TSK-${String(count + 1).padStart(4, "0")}`;

  const task = await db.task.create({
    data: {
      code,
      title: String(title).trim(),
      description: description ?? null,
      department,
      assigneeId,
      priority,
      deadline: deadlineDate,
      startTime: startDate,
      link: link ?? null,
      status: "PENDING",
    },
    include: { assignee: true },
  });

  await db.followUpLog.create({
    data: {
      taskId: task.id,
      type: "STATUS_CHANGE",
      message: `تسک توسط مدیر (${me.name}) در حالت «در صف انجام» ثبت شد.`,
    },
  });

  return NextResponse.json({ task: serializeTask(task) });
}
