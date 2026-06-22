import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/auth";

// POST /api/schedules/bulk
// Body: { schedules: Array<{taskName, dayOfWeek, startTime, endTime, assigneeHandle, groupId}> }
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
    const { schedules } = body ?? {};

    if (!Array.isArray(schedules) || schedules.length === 0) {
      return NextResponse.json(
        { error: "لیست زمان‌بندی‌ها الزامی است." },
        { status: 400 }
      );
    }

    let created = 0;
    const errors: string[] = [];

    for (let i = 0; i < schedules.length; i++) {
      const row = schedules[i];
      const { taskName, dayOfWeek, startTime, endTime, assigneeHandle, groupId } = row;

      if (!taskName || !startTime || !endTime || !assigneeHandle || !groupId) {
        errors.push(`ردیف ${i + 1}: فیلدهای ضروری ناقص است.`);
        continue;
      }

      try {
        // Validate group
        const group = await db.orgGroup.findUnique({ where: { id: groupId } });
        if (!group) {
          errors.push(`ردیف ${i + 1}: مجموعه یافت نشد.`);
          continue;
        }

        // MANAGER: only their group
        if (me.role === "MANAGER" && groupId !== me.managedGroup?.id) {
          errors.push(`ردیف ${i + 1}: دسترسی به مجموعه غیرمجاز.`);
          continue;
        }

        // Find assignee by handle
        const assignee = await db.member.findUnique({
          where: { handle: assigneeHandle },
        });
        if (!assignee) {
          errors.push(`ردیف ${i + 1}: عضو با هندل ${assigneeHandle} یافت نشد.`);
          continue;
        }

        // Find or create template
        let template = await db.taskTemplate.findFirst({
          where: { name: String(taskName).trim(), groupId },
        });

        if (!template) {
          template = await db.taskTemplate.create({
            data: {
              name: String(taskName).trim(),
              groupId,
              priority: "MEDIUM",
            },
          });
        }

        // Check for duplicate schedule
        const existing = await db.taskSchedule.findFirst({
          where: {
            taskTemplateId: template.id,
            dayOfWeek: dayOfWeek !== null ? Number(dayOfWeek) : null,
            specificDate: null,
            assigneeId: assignee.id,
            startTime: String(startTime),
            endTime: String(endTime),
          },
        });

        if (existing) {
          // Update existing instead of creating duplicate
          continue;
        }

        await db.taskSchedule.create({
          data: {
            taskTemplateId: template.id,
            dayOfWeek: dayOfWeek !== null && dayOfWeek !== undefined ? Number(dayOfWeek) : null,
            specificDate: null,
            startTime: String(startTime),
            endTime: String(endTime),
            assigneeId: assignee.id,
          },
        });

        created++;
      } catch (err) {
        errors.push(`ردیف ${i + 1}: خطای داخلی.`);
      }
    }

    return NextResponse.json({ created, errors }, { status: 201 });
  } catch (error) {
    console.error("Schedules bulk error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}