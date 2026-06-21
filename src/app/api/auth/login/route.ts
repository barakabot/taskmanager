import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth";

// POST /api/auth/login
// body: { handle, password }
export async function POST(req: NextRequest) {
  const { handle, password } = await req.json();
  if (!handle || !password) {
    return NextResponse.json(
      { error: "هندل و رمز عبور الزامی است." },
      { status: 400 }
    );
  }

  const normalized = handle.trim().toLowerCase();
  const member = await db.member.findFirst({
    where: {
      OR: [{ handle: { equals: normalized } }, { handle: { equals: handle.trim() } }],
    },
  });

  // Try exact match first (handles preserve case for @handle)
  const exact = await db.member.findUnique({ where: { handle: handle.trim() } });
  const target = exact ?? member;

  if (!target || target.password !== password) {
    return NextResponse.json(
      { error: "هندل یا رمز عبور نادرست است." },
      { status: 401 }
    );
  }

  await db.member.update({
    where: { id: target.id },
    data: { lastLoginAt: new Date() },
  });

  const res = NextResponse.json({
    member: {
      id: target.id,
      name: target.name,
      handle: target.handle,
      department: target.department,
      role: target.role,
    },
  });
  res.cookies.set(SESSION_COOKIE, target.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return res;
}
