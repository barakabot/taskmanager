import { cookies } from "next/headers";
import { db } from "@/lib/db";
import type { Member } from "@prisma/client";

export const SESSION_COOKIE = "tm_session";

export async function getCurrentMember(): Promise<Member | null> {
  const store = await cookies();
  const memberId = store.get(SESSION_COOKIE)?.value;
  if (!memberId) return null;
  const member = await db.member.findUnique({
    where: { id: memberId },
    include: { group: true, supervisor: true, managedGroup: true },
  });
  return member ?? null;
}

export async function requireAuth(): Promise<Member> {
  const member = await getCurrentMember();
  if (!member) {
    const err = new Error("UNAUTHORIZED") as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  return member;
}

export async function requireRole(...roles: string[]): Promise<Member> {
  const member = await requireAuth();
  if (!roles.includes(member.role)) {
    const err = new Error("FORBIDDEN") as Error & { status?: number };
    err.status = 403;
    throw err;
  }
  return member;
}

// Get all member IDs that the current member can see (self + subordinates recursively)
export async function getVisibleMemberIds(member: Member): Promise<string[]> {
  if (member.role === "SUPER_ADMIN") {
    const all = await db.member.findMany({ select: { id: true } });
    return all.map((m) => m.id);
  }

  const ids: string[] = [member.id];

  if (member.role === "MANAGER" || member.role === "SUPERVISOR") {
    // Find direct subordinates
    const subordinates = await db.member.findMany({
      where: { supervisorId: member.id },
      select: { id: true },
    });
    for (const sub of subordinates) {
      ids.push(sub.id);
      // If subordinate is also a supervisor, get their subordinates too
      const subSubs = await db.member.findMany({
        where: { supervisorId: sub.id },
        select: { id: true },
      });
      ids.push(...subSubs.map((s) => s.id));
    }
  }

  return [...new Set(ids)];
}

// Check if member can manage another member
export function canManage(manager: Member, targetRoleId: string): boolean {
  const hierarchy: Record<string, string[]> = {
    SUPER_ADMIN: ["SUPER_ADMIN", "MANAGER", "SUPERVISOR", "SPECIALIST"],
    MANAGER: ["SUPERVISOR", "SPECIALIST"],
    SUPERVISOR: ["SPECIALIST"],
    SPECIALIST: [],
  };
  return hierarchy[manager.role]?.includes(targetRoleId) ?? false;
}