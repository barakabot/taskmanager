import { cookies } from "next/headers";
import { db } from "@/lib/db";
import type { Member } from "@prisma/client";

export const SESSION_COOKIE = "pmo_session";

// Read current member from the httpOnly session cookie.
// Returns null if not authenticated.
export async function getCurrentMember(): Promise<Member | null> {
  const store = await cookies();
  const memberId = store.get(SESSION_COOKIE)?.value;
  if (!memberId) return null;
  const member = await db.member.findUnique({ where: { id: memberId } });
  return member ?? null;
}

export async function requireManager(): Promise<Member | null> {
  const member = await getCurrentMember();
  if (!member || member.role !== "MANAGER") return null;
  return member;
}

export async function requireAuth(): Promise<Member> {
  const member = await getCurrentMember();
  if (!member) {
    // Throw a tagged error the route handler can map to 401
    const err = new Error("UNAUTHORIZED") as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  return member;
}

// Check if a member can access a given task (manager = all, member = own only)
export function canAccessTask(member: Member, taskAssigneeId: string): boolean {
  return member.role === "MANAGER" || taskAssigneeId === member.id;
}
