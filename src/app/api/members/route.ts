import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeMember } from "@/lib/serialize";
import { getCurrentMember } from "@/lib/auth";

// GET /api/members
// Managers get the full team list. Members get only themselves (as a single-item list).
export async function GET() {
  const me = await getCurrentMember();
  if (!me) {
    return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
  }

  if (me.role !== "MANAGER") {
    // Members see only themselves
    const self = await db.member.findUnique({
      where: { id: me.id },
      include: { _count: { select: { tasks: true } } },
    });
    const activeCount = await db.task.count({
      where: { assigneeId: me.id, status: { not: "DONE" } },
    });
    return NextResponse.json({ members: self ? [serializeMember(self, activeCount)] : [] });
  }

  const members = await db.member.findMany({
    include: {
      _count: { select: { tasks: true } },
    },
    orderBy: [{ role: "desc" }, { name: "asc" }],
  });

  // Count active (non-done) tasks per member
  const activeCounts = await db.task.groupBy({
    by: ["assigneeId"],
    where: { status: { not: "DONE" } },
    _count: { _all: true },
  });
  const activeMap = new Map(activeCounts.map((a) => [a.assigneeId, a._count._all]));

  return NextResponse.json({
    members: members.map((m) => serializeMember(m, activeMap.get(m.id) ?? 0)),
  });
}
