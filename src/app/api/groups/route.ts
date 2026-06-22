import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeGroup } from "@/lib/serialize";
import { requireRole } from "@/lib/auth";

// GET /api/groups — SUPER_ADMIN and MANAGER can access
export async function GET() {
  try {
    const me = await requireRole("SUPER_ADMIN", "MANAGER");

    const groups = await db.orgGroup.findMany({
      include: {
        manager: true,
        _count: { select: { members: true, taskTemplates: true, tasks: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ groups: groups.map(serializeGroup) });
  } catch (error: unknown) {
    if (error instanceof Error && error.status === 401) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }
    if (error instanceof Error && error.status === 403) {
      return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    }
    console.error("Groups GET error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

// POST /api/groups — SUPER_ADMIN only
export async function POST(req: NextRequest) {
  try {
    const me = await requireRole("SUPER_ADMIN");
    const body = await req.json();
    const { name, code } = body ?? {};

    if (!name || !code) {
      return NextResponse.json(
        { error: "نام و کد مجموعه الزامی است." },
        { status: 400 }
      );
    }

    // Check uniqueness of code
    const existing = await db.orgGroup.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json(
        { error: "این کد مجموعه قبلاً ثبت شده است." },
        { status: 400 }
      );
    }

    const group = await db.orgGroup.create({
      data: {
        name: String(name).trim(),
        code: String(code).trim(),
      },
      include: {
        manager: true,
        _count: { select: { members: true, taskTemplates: true, tasks: true } },
      },
    });

    return NextResponse.json({ group: serializeGroup(group) }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && error.status === 401) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }
    if (error instanceof Error && error.status === 403) {
      return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    }
    console.error("Groups POST error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}