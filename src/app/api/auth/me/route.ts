import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/auth";

// GET /api/auth/me
export async function GET() {
  try {
    const member = await getCurrentMember();
    if (!member) {
      return NextResponse.json({ member: null }, { status: 401 });
    }
    return NextResponse.json({
      member: {
        id: member.id,
        name: member.name,
        handle: member.handle,
        role: member.role,
        groupId: member.groupId,
        groupName: member.group?.name ?? null,
        supervisorId: member.supervisorId,
        supervisorName: member.supervisor?.name ?? null,
      },
    });
  } catch (error) {
    console.error("Me error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}