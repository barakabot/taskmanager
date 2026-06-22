import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeTask, serializeLog } from "@/lib/serialize";
import { STATUSES, FOLLOW_UP_REASONS } from "@/lib/constants";
import { getCurrentMember, requireAuth, getVisibleMemberIds, canManage } from "@/lib/auth";

// GET /api/tasks/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await requireAuth();
    const { id } = await params;

    const task = await db.task.findUnique({
      where: { id },
      include: {
        assignee: true,
        group: true,
        referer: true,
        approver: true,
        logs: { orderBy: { createdAt: "desc" }, take: 30 },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "تسک یافت نشد." }, { status: 404 });
    }

    // Check visibility
    const visibleIds = await getVisibleMemberIds(me);
    if (!visibleIds.includes(task.assigneeId)) {
      return NextResponse.json(
        { error: "شما به این تسک دسترسی ندارید." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      task: serializeTask(task),
      logs: task.logs.map(serializeLog),
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.status === 401) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }
    console.error("Task GET error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

// PATCH /api/tasks/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const {
      status,
      followUpReason,
      assigneeId,
      title,
      description,
      priority,
      deadline,
      link,
    } = body ?? {};

    const existing = await db.task.findUnique({
      where: { id },
      include: { assignee: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "تسک یافت نشد." }, { status: 404 });
    }

    // Check visibility
    const visibleIds = await getVisibleMemberIds(me);
    if (!visibleIds.includes(existing.assigneeId)) {
      return NextResponse.json(
        { error: "شما به این تسک دسترسی ندارید." },
        { status: 403 }
      );
    }

    const data: Record<string, unknown> = {};

    // Status change
    if (status && STATUSES.some((s) => s.key === status)) {
      data.status = status;
      if (status === "STARTED" && !existing.startedAt) {
        data.startedAt = new Date();
      }
      if (status === "DONE" && !existing.doneAt) {
        data.doneAt = new Date();
      }
      if (status !== "BLOCKED") {
        data.followUpReason = null;
      }
    }

    // Follow-up reason (only when BLOCKED)
    if (followUpReason && FOLLOW_UP_REASONS.some((r) => r.key === followUpReason)) {
      data.followUpReason = followUpReason;
      data.status = "BLOCKED";
    }

    // Assignee change (only MANAGER or SUPERVISOR)
    if (assigneeId && assigneeId !== existing.assigneeId) {
      if (me.role !== "MANAGER" && me.role !== "SUPERVISOR") {
        return NextResponse.json(
          { error: "تنها مدیر یا سرپرست می‌تواند مسئول را تغییر دهد." },
          { status: 403 }
        );
      }
      const newAssignee = await db.member.findUnique({ where: { id: assigneeId } });
      if (!newAssignee) {
        return NextResponse.json({ error: "مسئول جدید یافت نشد." }, { status: 400 });
      }
      data.assigneeId = assigneeId;
    }

    // Other editable fields
    if (title !== undefined) data.title = String(title).trim();
    if (description !== undefined) data.description = description ?? null;
    if (priority !== undefined && PRIORITIES.some((p) => p.key === priority)) {
      data.priority = priority;
    }
    if (deadline !== undefined) data.deadline = new Date(deadline);
    if (link !== undefined) data.link = link ?? null;

    const updated = await db.task.update({
      where: { id },
      data,
      include: { assignee: true, group: true, referer: true, approver: true },
    });

    // Log status changes
    if (status && status !== existing.status) {
      const statusLabel = STATUSES.find((s) => s.key === status)?.label ?? status;
      await db.followUpLog.create({
        data: {
          taskId: id,
          type: "STATUS_CHANGE",
          message: `${me.name} وضعیت را به «${statusLabel}» تغییر داد.`,
        },
      });
    }

    // Log follow-up reason
    if (followUpReason) {
      const reasonLabel =
        FOLLOW_UP_REASONS.find((r) => r.key === followUpReason)?.label ?? followUpReason;
      await db.followUpLog.create({
        data: {
          taskId: id,
          type: "NOTE",
          message: `${me.name} علت مسدودی را ثبت کرد: ${reasonLabel}`,
          reason: followUpReason,
        },
      });
    }

    // Log assignee change
    if (assigneeId && assigneeId !== existing.assigneeId) {
      const newAssignee = await db.member.findUnique({ where: { id: assigneeId } });
      await db.followUpLog.create({
        data: {
          taskId: id,
          type: "NOTE",
          message: `${me.name} مسئول را از ${existing.assignee.name} به ${newAssignee?.name ?? "نامشخص"} تغییر داد.`,
        },
      });
    }

    const logs = await db.followUpLog.findMany({
      where: { taskId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    return NextResponse.json({
      task: serializeTask(updated),
      logs: logs.map(serializeLog),
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.status === 401) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }
    if (error instanceof Error && error.status === 403) {
      return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    }
    console.error("Task PATCH error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

// DELETE /api/tasks/[id] — MANAGER+ only
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await requireAuth();
    const { id } = await params;

    if (me.role !== "MANAGER" && me.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "تنها مدیر یا مدیر کل می‌تواند تسک را حذف کند." },
        { status: 403 }
      );
    }

    const task = await db.task.findUnique({ where: { id } });
    if (!task) {
      return NextResponse.json({ error: "تسک یافت نشد." }, { status: 404 });
    }

    // MANAGER can only delete tasks from their group
    if (me.role === "MANAGER") {
      if (task.groupId !== me.managedGroup?.id) {
        return NextResponse.json(
          { error: "شما تنها می‌توانید تسک‌های مجموعه خود را حذف کنید." },
          { status: 403 }
        );
      }
    }

    await db.task.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if (error instanceof Error && error.status === 401) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }
    if (error instanceof Error && error.status === 403) {
      return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    }
    console.error("Task DELETE error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}