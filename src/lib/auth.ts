import { cookies } from "next/headers";
import { db } from "@/lib/db";
import type { MemberWithRelations } from "@/lib/prisma-types";

export const SESSION_COOKIE = "tm_session";

// Simple in-memory cache for getCurrentMember (per-request lifecycle in serverless)
const memberCache = new Map<string, { member: MemberWithRelations; ts: number }>();
const CACHE_TTL = 5_000; // 5 seconds

export async function getCurrentMember(): Promise<MemberWithRelations | null> {
  const store = await cookies();
  const memberId = store.get(SESSION_COOKIE)?.value;
  if (!memberId) return null;

  // Check cache
  const cached = memberCache.get(memberId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.member;
  }

  const member = await db.member.findUnique({
    where: { id: memberId },
    include: { group: true, supervisor: true, managedGroup: true },
  });

  if (member) {
    memberCache.set(memberId, { member, ts: Date.now() });
  }

  return member ?? null;
}

// Invalidate cache when member is updated
export function invalidateMemberCache(memberId?: string) {
  if (memberId) {
    memberCache.delete(memberId);
  } else {
    memberCache.clear();
  }
}

export async function requireAuth(): Promise<MemberWithRelations> {
  const member = await getCurrentMember();
  if (!member) {
    const err = new Error("UNAUTHORIZED") as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  return member;
}

export async function requireRole(...roles: string[]): Promise<MemberWithRelations> {
  const member = await requireAuth();
  if (!roles.includes(member.role)) {
    const err = new Error("FORBIDDEN") as Error & { status?: number };
    err.status = 403;
    throw err;
  }
  return member;
}

// Get all member IDs that the current member can see (self + subordinates recursively)
// Optimized: single recursive query instead of N+1
export async function getVisibleMemberIds(member: MemberWithRelations): Promise<string[]> {
  if (member.role === "SUPER_ADMIN") {
    // For SUPER_ADMIN, use a lightweight select-only query
    const all = await db.member.findMany({ select: { id: true } });
    return all.map((m) => m.id);
  }

  // MANAGER: see all members in their managed group
  if (member.role === "MANAGER" && member.managedGroup?.id) {
    const groupMembers = await db.member.findMany({
      where: { groupId: member.managedGroup.id },
      select: { id: true },
    });
    return groupMembers.map((m) => m.id);
  }

  // SUPERVISOR: see self + all recursive subordinates
  // Single query to get all members under this supervisor chain
  const ids: string[] = [member.id];

  // Get all members whose supervisor chain includes this member
  // We do this iteratively to handle arbitrary depth
  let currentLevelIds = [member.id];
  while (currentLevelIds.length > 0) {
    const nextLevel = await db.member.findMany({
      where: { supervisorId: { in: currentLevelIds } },
      select: { id: true },
    });
    currentLevelIds = nextLevel.map((m) => m.id);
    if (currentLevelIds.length > 0) {
      ids.push(...currentLevelIds);
    }
  }

  return ids;
}

// Check if member can manage another member
export function canManage(manager: MemberWithRelations, targetRoleId: string): boolean {
  const hierarchy: Record<string, string[]> = {
    SUPER_ADMIN: ["SUPER_ADMIN", "MANAGER", "SUPERVISOR", "SPECIALIST"],
    MANAGER: ["SUPERVISOR", "SPECIALIST"],
    SUPERVISOR: ["SPECIALIST"],
    SPECIALIST: [],
  };
  return hierarchy[manager.role]?.includes(targetRoleId) ?? false;
}

// Type-safe error status check
export function isHttpError(error: unknown, status: number): boolean {
  return error instanceof Error && (error as Error & { status?: number }).status === status;
}