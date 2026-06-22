import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeSchedule } from "@/lib/serialize";
import { getCurrentMember } from "@/lib/auth";

// GET /api/schedules — filtered by group
export async function GET() {
  try {
    const me = await getCurrentMember();
    if (!me) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }

    const where: Record<string, unknown> = {};
    if (me.role !== "SUPER_ADMIN") {
      const targetGroupId = me.role === "MANAGER" ? me.managedGroup?.id : me.groupId;
      where.taskTemplate = { groupId: targetGroupId };
    }

    const schedules = await db.taskSchedule.findMany({
      where,
      include: {
        taskTemplate: { include: { group: true } },
        assignee: true,
        overrideAssignee: true,
      },
      orderBy: [
        { dayOfWeek: "asc" },
        { startTime: "asc" },
      ],
    });

    return NextResponse.json({
      schedules: schedules.map(serializeSchedule),
    });
  } catch (error) {
    console.error("Schedules GET error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

// POST /api/schedules — create a new schedule
export async function POST(req: NextRequest) {
  try {
    const me = await getCurrentMember();
    if (!me) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }

    if (me.role === "SPECIALIST") {
      return NextResponse.json(
        { error: "کارشناس نمی‌تواند زمان‌بندی ایجاد کند." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      taskTemplateId,
      dayOfWeek,
      specificDate,
      startTime,
      endTime,
      assigneeId,
    } = body ?? {};

    if (!taskTemplateId || !startTime || !endTime || !assigneeId) {
      return NextResponse.json(
        { error: "الگو، ساعت شروع، ساعت پایان و مسئول الزامی است." },
        { status: 400 }
      );
    }

    if (dayOfWeek === undefined && !specificDate) {
      return NextResponse.json(
        { error: "روز هفته یا تاریخ خاص الزامی است." },
        { status: 400 }
      );
    }

    // Validate template exists and is in accessible group
    const template = await db.taskTemplate.findUnique({
      where: { id: taskTemplateId },
      include: { group: true },
    });

    if (!template) {
      return NextResponse.json({ error: "الگو یافت نشد." }, { status: 400 });
    }

    if (me.role === "MANAGER" && template.groupId !== me.managedGroup?.id) {
      return NextResponse.json(
        { error: "مدیر تنها می‌تواند برای الگوهای مجموعه خود زمان‌بندی ایجاد کند." },
        { status: 403 }
      );
    }

    // Validate assignee
    const assignee = await db.member.findUnique({ where: { id: assigneeId } });
    if (!assignee) {
      return NextResponse.json({ error: "مسئول یافت نشد." }, { status: 400 });
    }

    const schedule = await db.taskSchedule.create({
      data: {
        taskTemplateId,
        dayOfWeek: dayOfWeek !== undefined ? Number(dayOfWeek) : null,
        specificDate: specificDate ?? null,
        startTime: String(startTime),
        endTime: String(endTime),
        assigneeId,
      },
      include: {
        taskTemplate: { include: { group: true } },
        assignee: true,
        overrideAssignee: true,
      },
    });

    return NextResponse.json(
      { schedule: serializeSchedule(schedule) },
      { status: 201 }
    );
  } catch (error) {
    console.error("Schedules POST error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

// PATCH /api/schedules/[id] — handled in [id]/route.ts