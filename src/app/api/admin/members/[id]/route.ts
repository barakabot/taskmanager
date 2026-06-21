import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeMember } from "@/lib/serialize";
import { DEPARTMENTS } from "@/lib/constants";
import { getCurrentMember } from "@/lib/auth";

// PATCH /api/admin/members/[id] — update member (manager only)
// body: { name?, handle?, password?, department?, role? }
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
  const { name, handle, password, department, role, subDepartmentId, action } = body ?? {};

  const existing = await db.member.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "کاربر یافت نشد." }, { status: 404 });
  }

  // Dedicated reset-password action
  if (action === "resetPassword") {
    const newPwd = (password || "1234").trim();
    const updated = await db.member.update({
      where: { id },
      data: { password: newPwd },
      include: { _count: { select: { tasks: true } }, subDepartment: true },
    });
    return NextResponse.json({
      member: serializeMember(updated, 0, true),
      newPassword: newPwd,
    });
  }

  const data: Record<string, unknown> = {};
  if (name) data.name = String(name).trim();
  if (handle) {
    const normalized = String(handle).trim().startsWith("@")
      ? String(handle).trim()
      : `@${String(handle).trim()}`;
    if (normalized !== existing.handle) {
      const dup = await db.member.findUnique({ where: { handle: normalized } });
      if (dup && dup.id !== id) {
        return NextResponse.json({ error: "این هندل قبلاً ثبت شده است." }, { status: 400 });
      }
      data.handle = normalized;
    }
  }
  if (password) data.password = String(password).trim();
  const newDept = department && DEPARTMENTS.some((d) => d.key === department) ? department : null;
  if (newDept) {
    data.department = newDept;
    // If department changes, clear the old sub-department (it belongs to the old dept)
    if (newDept !== existing.department) {
      data.subDepartmentId = null;
    }
  }
  if (role && (role === "MANAGER" || role === "MEMBER")) data.role = role;

  // Sub-department (may be null to clear, or a valid id belonging to the dept)
  if (subDepartmentId !== undefined) {
    if (subDepartmentId === null || subDepartmentId === "") {
      data.subDepartmentId = null;
    } else {
      const sub = await db.subDepartment.findUnique({ where: { id: subDepartmentId } });
      const effectiveDept = (data.department as string) ?? existing.department;
      if (!sub || sub.department !== effectiveDept) {
        return NextResponse.json(
          { error: "زیرمجموعه انتخاب‌شده متعلق به این بخش نیست." },
          { status: 400 }
        );
      }
      data.subDepartmentId = sub.id;
    }
  }

  const updated = await db.member.update({
    where: { id },
    data,
    include: { _count: { select: { tasks: true } }, subDepartment: true },
  });

  const activeCount = await db.task.count({
    where: { assigneeId: id, status: { not: "DONE" } },
  });

  return NextResponse.json({ member: serializeMember(updated, activeCount, true) });
}

// DELETE /api/admin/members/[id] — delete member (manager only)
// Refuses if the member still has active tasks.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getCurrentMember();
  if (!me) return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
  if (me.role !== "MANAGER")
    return NextResponse.json({ error: "دسترسی فقط برای مدیر." }, { status: 403 });

  const { id } = await params;
  if (id === me.id) {
    return NextResponse.json(
      { error: "نمی‌توانید حساب خودتان را حذف کنید." },
      { status: 400 }
    );
  }

  const target = await db.member.findUnique({
    where: { id },
    include: { _count: { select: { tasks: true } } },
  });
  if (!target) {
    return NextResponse.json({ error: "کاربر یافت نشد." }, { status: 404 });
  }

  const activeCount = await db.task.count({
    where: { assigneeId: id, status: { not: "DONE" } },
  });
  if (activeCount > 0) {
    return NextResponse.json(
      {
        error: `این کاربر ${activeCount} تسک فعال دارد. ابتدا تسک‌ها را به شخص دیگری منتقل کنید یا تکمیل کنید.`,
      },
      { status: 400 }
    );
  }

  await db.member.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
