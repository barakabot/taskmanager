import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeMember } from "@/lib/serialize";
import { DEPARTMENTS } from "@/lib/constants";
import { getCurrentMember } from "@/lib/auth";

// GET /api/admin/members — full team with passwords (manager only)
export async function GET() {
  const me = await getCurrentMember();
  if (!me) return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
  if (me.role !== "MANAGER")
    return NextResponse.json({ error: "دسترسی فقط برای مدیر." }, { status: 403 });

  const members = await db.member.findMany({
    include: { _count: { select: { tasks: true } } },
    orderBy: [{ role: "desc" }, { name: "asc" }],
  });
  const activeCounts = await db.task.groupBy({
    by: ["assigneeId"],
    where: { status: { not: "DONE" } },
    _count: { _all: true },
  });
  const activeMap = new Map(activeCounts.map((a) => [a.assigneeId, a._count._all]));

  return NextResponse.json({
    members: members.map((m) =>
      serializeMember(m, activeMap.get(m.id) ?? 0, true /* includePassword */)
    ),
  });
}

// POST /api/admin/members — create a new member (manager only)
export async function POST(req: NextRequest) {
  const me = await getCurrentMember();
  if (!me) return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
  if (me.role !== "MANAGER")
    return NextResponse.json({ error: "دسترسی فقط برای مدیر." }, { status: 403 });

  const body = await req.json();
  const { name, handle, password, department, role } = body ?? {};

  if (!name || !handle || !department) {
    return NextResponse.json(
      { error: "نام، هندل و بخش الزامی است." },
      { status: 400 }
    );
  }
  if (!DEPARTMENTS.some((d) => d.key === department)) {
    return NextResponse.json({ error: "بخش نامعتبر است." }, { status: 400 });
  }

  const normalizedHandle = handle.trim().startsWith("@") ? handle.trim() : `@${handle.trim()}`;

  const existing = await db.member.findUnique({ where: { handle: normalizedHandle } });
  if (existing) {
    return NextResponse.json({ error: "این هندل قبلاً ثبت شده است." }, { status: 400 });
  }

  const member = await db.member.create({
    data: {
      name: String(name).trim(),
      handle: normalizedHandle,
      password: (password || "1234").trim(),
      department,
      role: role === "MANAGER" ? "MANAGER" : "MEMBER",
    },
    include: { _count: { select: { tasks: true } } },
  });

  return NextResponse.json({ member: serializeMember(member, 0, true) });
}
