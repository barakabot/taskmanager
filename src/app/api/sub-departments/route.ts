import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeSubDepartment } from "@/lib/serialize";
import { DEPARTMENTS } from "@/lib/constants";
import { getCurrentMember } from "@/lib/auth";

// GET /api/sub-departments?department=FANTASY
// Any authenticated user can list sub-departments (needed for the New Task picker).
export async function GET(req: NextRequest) {
  const me = await getCurrentMember();
  if (!me) {
    return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const department = searchParams.get("department");

  const where: Record<string, unknown> = {};
  if (department) where.department = department;

  const subs = await db.subDepartment.findMany({
    where,
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ subDepartments: subs.map(serializeSubDepartment) });
}

// POST /api/sub-departments — MANAGER ONLY creates a sub-department
export async function POST(req: NextRequest) {
  const me = await getCurrentMember();
  if (!me) {
    return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
  }
  if (me.role !== "MANAGER") {
    return NextResponse.json(
      { error: "تنها مدیر می‌تواند زیرمجموعه ایجاد کند." },
      { status: 403 }
    );
  }
  const body = await req.json();
  const { name, department } = body ?? {};
  if (!name || !department) {
    return NextResponse.json(
      { error: "نام و بخش الزامی است." },
      { status: 400 }
    );
  }
  if (!DEPARTMENTS.some((d) => d.key === department)) {
    return NextResponse.json({ error: "بخش نامعتبر است." }, { status: 400 });
  }

  // Prevent duplicate names within the same department
  const existing = await db.subDepartment.findFirst({
    where: { name: String(name).trim(), department },
  });
  if (existing) {
    return NextResponse.json(
      { error: "این زیرمجموعه قبلاً در این بخش ثبت شده است." },
      { status: 400 }
    );
  }

  const sub = await db.subDepartment.create({
    data: { name: String(name).trim(), department },
  });
  return NextResponse.json({ subDepartment: serializeSubDepartment(sub) });
}
