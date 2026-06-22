import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeGroup } from "@/lib/serialize";
import { requireAuth, requireRole } from "@/lib/auth";

// GET /api/groups/[id] — with members
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await requireAuth();
    const { id } = await params;

    // SUPER_ADMIN and MANAGER can view any group
    if (me.role !== "SUPER_ADMIN" && me.role !== "MANAGER") {
      return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    }

    const group = await db.orgGroup.findUnique({
      where: { id },
      include: {
        manager: true,
        members: {
          include: {
            group: true,
            supervisor: true,
            _count: { select: { tasks: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        _count: { select: { members: true, taskTemplates: true, tasks: true } },
      },
    });

    if (!group) {
      return NextResponse.json({ error: "مجموعه یافت نشد." }, { status: 404 });
    }

    // Count active (non-done) tasks per member
    const memberIds = group.members.map((m) => m.id);
    const activeCounts = await db.task.groupBy({
      by: ["assigneeId"],
      where: {
        assigneeId: { in: memberIds },
        status: { notIn: ["DONE"] },
      },
      _count: { assigneeId: true },
    });

    const activeMap: Record<string, number> = {};
    for (const ac of activeCounts) {
      activeMap[ac.assigneeId] = ac._count.assigneeId;
    }

    // Import serializeMember dynamically to avoid circular deps
    const { serializeMember } = await import("@/lib/serialize");

    return NextResponse.json({
      group: serializeGroup(group),
      members: group.members.map((m) =>
        serializeMember(m, activeMap[m.id] ?? 0)
      ),
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.status === 401) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }
    if (error instanceof Error && error.status === 403) {
      return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    }
    console.error("Group GET error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

// PATCH /api/groups/[id] — SUPER_ADMIN only
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await requireRole("SUPER_ADMIN");
    const { id } = await params;
    const body = await req.json();
    const { name, managerId } = body ?? {};

    const existing = await db.orgGroup.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "مجموعه یافت نشد." }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = String(name).trim();

    // If changing manager, clear old manager's managedGroup first
    if (managerId !== undefined) {
      if (managerId === null) {
        data.managerId = null;
      } else {
        const newManager = await db.member.findUnique({
          where: { id: managerId },
        });
        if (!newManager) {
          return NextResponse.json(
            { error: "عضو یافت نشد." },
            { status: 400 }
          );
        }
        if (newManager.role !== "MANAGER") {
          return NextResponse.json(
            { error: "فقط عضو با نقش مدیر مجموعه می‌تواند مدیر باشد." },
            { status: 400 }
          );
        }
        data.managerId = managerId;
      }
    }

    const updated = await db.orgGroup.update({
      where: { id },
      data,
      include: {
        manager: true,
        _count: { select: { members: true, taskTemplates: true, tasks: true } },
      },
    });

    return NextResponse.json({ group: serializeGroup(updated) });
  } catch (error: unknown) {
    if (error instanceof Error && error.status === 401) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }
    if (error instanceof Error && error.status === 403) {
      return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    }
    console.error("Group PATCH error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}