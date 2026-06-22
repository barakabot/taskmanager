import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth";

// POST /api/auth/login
export async function POST(req: NextRequest) {
  try {
    const { handle, password } = await req.json();
    if (!handle || !password) {
      return NextResponse.json(
        { error: "هندل و رمز عبور الزامی است." },
        { status: 400 }
      );
    }

    const member = await db.member.findUnique({
      where: { handle: handle.trim() },
      include: { group: true, supervisor: true },
    });

    if (!member || member.password !== password) {
      return NextResponse.json(
        { error: "هندل یا رمز عبور نادرست است." },
        { status: 401 }
      );
    }

    await db.member.update({
      where: { id: member.id },
      data: { lastLoginAt: new Date() },
    });

    const res = NextResponse.json({
      member: {
        id: member.id,
        name: member.name,
        handle: member.handle,
        role: member.role,
        groupId: member.groupId,
        groupName: member.group?.name ?? null,
        supervisorId: member.supervisorId,
      },
    });

    res.cookies.set(SESSION_COOKIE, member.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return res;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}