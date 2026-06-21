import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/auth";

// GET /api/auth/me — returns the currently logged-in member (or 401)
export async function GET() {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ member: null }, { status: 401 });
  }
  return NextResponse.json({
    member: {
      id: member.id,
      name: member.name,
      handle: member.handle,
      department: member.department,
      role: member.role,
    },
  });
}
