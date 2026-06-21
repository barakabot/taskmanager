import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeSubDepartment } from "@/lib/serialize";
import { DEPARTMENTS } from "@/lib/constants";
import { getCurrentMember } from "@/lib/auth";

// PATCH /api/sub-departments/[id] — manager only, rename / move
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getCurrentMember();
  if (!me) return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
  if (me.role !== "MANAGER")
    return NextResponse.json({ error: "دسترسی فقط برای مدیر." }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { name, department } = body ?? {};

  const existing = await db.subDepartment.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "زیرمجموعه یافت نشد." }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (name) data.name = String(name).trim();
  if (department && DEPARTMENTS.some((d) => d.key === department)) {
    data.department = department;
  }

  const updated = await db.subDepartment.update({
    where: { id },
    data,
  });
  return NextResponse.json({ subDepartment: serializeSubDepartment(updated) });
}

// DELETE /api/sub-departments/[id] — manager only
// Refuses if members or tasks still reference it.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getCurrentMember();
  if (!me) return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
  if (me.role !== "MANAGER")
    return NextResponse.json({ error: "دسترسی فقط برای مدیر." }, { status: 403 });

  const { id } = await params;
  const ref = await db.subDepartment.findUnique({
    where: { id },
    include: {
      _count: { select: { members: true, tasks: true } },
    },
  });
  if (!ref) {
    return NextResponse.json({ error: "زیرمجموعه یافت نشد." }, { status: 404 });
  }
  if (ref._count.members > 0 || ref._count.tasks > 0) {
    return NextResponse.json(
      {
        error: `این زیرمجموعه به ${ref._count.members} کاربر و ${ref._count.tasks} تسک متصل است. ابتدا آن‌ها را منتقل کنید.`,
      },
      { status: 400 }
    );
  }

  await db.subDepartment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
