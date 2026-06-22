import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/auth";
import * as XLSX from "xlsx";

// Persian day name to number mapping
const DAY_MAP: Record<string, number> = {
  "شنبه": 0,
  "یکشنبه": 1,
  "دوشنبه": 2,
  "سه‌شنبه": 3,
  "سه شنبه": 3,
  "چهارشنبه": 4,
  "پنجشنبه": 5,
  "پنج شنبه": 5,
  "جمعه": 6,
};

// POST /api/import/excel
// FormData with file field "file" containing .xlsx
export async function POST(req: NextRequest) {
  try {
    const me = await getCurrentMember();
    if (!me) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }

    if (me.role === "SPECIALIST") {
      return NextResponse.json(
        { error: "کارشناس نمی‌تواند فایل وارد کند." },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "فایل اکسل الزامی است." },
        { status: 400 }
      );
    }

    if (!file.name.endsWith(".xlsx")) {
      return NextResponse.json(
        { error: "فقط فایل‌های .xlsx پشتیبانی می‌شود." },
        { status: 400 }
      );
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });

    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json(
        { error: "فایل اکسل خالی است." },
        { status: 400 }
      );
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
      defval: "",
    });

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "فایل اکسل خالی است." },
        { status: 400 }
      );
    }

    let created = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Expected columns: نام تسک | روز | ساعت شروع | ساعت پایان | هندل مسئول | نام مجموعه
      const taskName = String(row["نام تسک"] || row["taskName"] || "").trim();
      const dayName = String(row["روز"] || row["dayOfWeek"] || "").trim();
      const startTime = String(row["ساعت شروع"] || row["startTime"] || "").trim();
      const endTime = String(row["ساعت پایان"] || row["endTime"] || "").trim();
      const assigneeHandle = String(row["هندل مسئول"] || row["assigneeHandle"] || "").trim();
      const groupName = String(row["نام مجموعه"] || row["groupName"] || "").trim();

      if (!taskName || !dayName || !startTime || !endTime || !assigneeHandle || !groupName) {
        errors.push(`ردیف ${i + 2}: فیلدهای ضروری ناقص است.`);
        continue;
      }

      // Parse day
      const dayOfWeek = DAY_MAP[dayName];
      if (dayOfWeek === undefined) {
        errors.push(`ردیف ${i + 2}: روز نامعتبر "${dayName}".`);
        continue;
      }

      try {
        // Find group by name
        const group = await db.orgGroup.findFirst({
          where: { name: groupName },
        });
        if (!group) {
          errors.push(`ردیف ${i + 2}: مجموعه "${groupName}" یافت نشد.`);
          continue;
        }

        // MANAGER: only their group
        if (me.role === "MANAGER" && group.id !== me.managedGroup?.id) {
          errors.push(`ردیف ${i + 2}: دسترسی به مجموعه "${groupName}" غیرمجاز.`);
          continue;
        }

        // Find assignee by handle
        const assignee = await db.member.findFirst({
          where: { handle: assigneeHandle },
        });
        if (!assignee) {
          errors.push(`ردیف ${i + 2}: عضو "${assigneeHandle}" یافت نشد.`);
          continue;
        }

        // Find or create template
        let template = await db.taskTemplate.findFirst({
          where: { name: taskName, groupId: group.id },
        });

        if (!template) {
          template = await db.taskTemplate.create({
            data: {
              name: taskName,
              groupId: group.id,
              priority: "MEDIUM",
            },
          });
        }

        // Check for duplicate schedule
        const existing = await db.taskSchedule.findFirst({
          where: {
            taskTemplateId: template.id,
            dayOfWeek,
            specificDate: null,
            assigneeId: assignee.id,
            startTime,
            endTime,
          },
        });

        if (!existing) {
          await db.taskSchedule.create({
            data: {
              taskTemplateId: template.id,
              dayOfWeek,
              specificDate: null,
              startTime,
              endTime,
              assigneeId: assignee.id,
            },
          });
          created++;
        }
      } catch (err) {
        errors.push(`ردیف ${i + 2}: خطای داخلی.`);
      }
    }

    return NextResponse.json({ created, errors }, { status: 201 });
  } catch (error) {
    console.error("Excel import error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}