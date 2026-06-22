import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeTask } from "@/lib/serialize";
import { getCurrentMember, getVisibleMemberIds, canManage } from "@/lib/auth";
import { STATUSES, PRIORITIES } from "@/lib/constants";

// GET /api/tasks?status=&groupId=&priority=&source=&overdue=1
export async function GET(req: NextRequest) {
  try {
    const me = await getCurrentMember();
    if (!me) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const groupId = searchParams.get("groupId");
    const priority = searchParams.get("priority");
    const source = searchParams.get("source");
    const overdue = searchParams.get("overdue") === "1";

    // Role-based visibility
    const visibleIds = await getVisibleMemberIds(me);

    const where: Record<string, unknown> = {
      assigneeId: { in: visibleIds },
    };

    // MANAGER sees tasks of group members (already handled by getVisibleMemberIds)
    // SUPER_ADMIN sees all (already handled by getVisibleMemberIds)

    if (status) where.status = status;
    if (groupId) where.groupId = groupId;
    if (priority) where.priority = priority;
    if (source) where.source = source;

    const tasks = await db.task.findMany({
      where,
      include: { assignee: true, group: true, referer: true, approver: true },
      orderBy: { deadline: "asc" },
    });

    let result = tasks.map(serializeTask);
    if (overdue) {
      const now = Date.now();
      result = result.filter(
        (t) => t.status !== "DONE" && new Date(t.deadline).getTime() < now
      );
    }

    return NextResponse.json({ tasks: result });
  } catch (error) {
    console.error("Tasks GET error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

// POST /api/tasks — MANAGER, SUPERVISOR, or SPECIALIST can create for subordinates/self
export async function POST(req: NextRequest) {
  try {
    const me = await getCurrentMember();
    if (!me) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }

    const body = await req.json();
    const {
      title,
      description,
      assigneeId,
      priority,
      deadline,
      startTime,
      link,
      groupId,
      source,
      letterNumber,
      letterDate,
      refererId,
    } = body ?? {};

    if (!title || !assigneeId || !deadline || !groupId) {
      return NextResponse.json(
        { error: "فیلدهای ضروری ناقص است. عنوان، مسئول، ددلاین و مجموعه الزامی است." },
        { status: 400 }
      );
    }

    // Validate priority
    if (priority && !PRIORITIES.some((p) => p.key === priority)) {
      return NextResponse.json({ error: "اولویت نامعتبر است." }, { status: 400 });
    }

    // Validate source
    const taskSource = source || "MANUAL";
    if (!["MANUAL", "REFERRED"].includes(taskSource)) {
      return NextResponse.json({ error: "منبع تسک نامعتبر است." }, { status: 400 });
    }

    // Referred task validation
    if (taskSource === "REFERRED") {
      if (!letterNumber || !letterDate || !refererId) {
        return NextResponse.json(
          { error: "برای تسک ارجاعی، شماره نامه، تاریخ نامه و مرجع الزامی است." },
          { status: 400 }
        );
      }
    }

    // Check assignee exists and is in the correct group
    const assignee = await db.member.findUnique({
      where: { id: assigneeId },
      include: { group: true },
    });
    if (!assignee) {
      return NextResponse.json({ error: "مسئول یافت نشد." }, { status: 400 });
    }

    // Check group exists
    const group = await db.orgGroup.findUnique({ where: { id: groupId } });
    if (!group) {
      return NextResponse.json({ error: "مجموعه یافت نشد." }, { status: 400 });
    }

    // Role-based creation rules
    if (me.role === "SPECIALIST") {
      // Specialist can only create for themselves
      if (assigneeId !== me.id) {
        return NextResponse.json(
          { error: "کارشناس تنها می‌تواند برای خود تسک ثبت کند." },
          { status: 403 }
        );
      }
    } else if (me.role === "SUPERVISOR") {
      // Supervisor can create for self and subordinates
      if (assigneeId !== me.id && assignee.supervisorId !== me.id) {
        return NextResponse.json(
          { error: "سرپرست تنها می‌تواند برای خود یا زیردستان تسک ثبت کند." },
          { status: 403 }
        );
      }
      // Supervisor's group must match
      if (me.groupId !== groupId) {
        return NextResponse.json(
          { error: "شما نمی‌توانید برای مجموعه دیگر تسک ثبت کنید." },
          { status: 403 }
        );
      }
    } else if (me.role === "MANAGER") {
      // Manager can create for any group member
      if (assignee.groupId !== me.managedGroup?.id) {
        return NextResponse.json(
          { error: "مسئول باید عضو مجموعه شما باشد." },
          { status: 403 }
        );
      }
    }

    // Generate next code with retry on unique constraint (race-condition safe)
    const deadlineDate = new Date(deadline);
    const startDate = startTime ? new Date(startTime) : null;

    const MAX_RETRIES = 5;
    let task: Awaited<ReturnType<typeof db.task.create>> | null = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Use interactive transaction to read-then-write atomically
        task = await db.$transaction(async (tx) => {
          const lastTask = await tx.task.findFirst({
            select: { code: true },
            orderBy: { createdAt: "desc" },
          });
          let nextNum = 1;
          if (lastTask?.code) {
            const match = lastTask.code.match(/TSK-(\d+)/);
            if (match) nextNum = parseInt(match[1], 10) + 1;
          }
          const code = `TSK-${String(nextNum).padStart(4, "0")}`;

          return tx.task.create({
            data: {
              code,
              title: String(title).trim(),
              description: description ?? null,
              groupId,
              assigneeId,
              priority: priority || "MEDIUM",
              deadline: deadlineDate,
              startTime: startDate,
              link: link ?? null,
              status: "PENDING",
              source: taskSource,
              letterNumber: taskSource === "REFERRED" ? letterNumber : null,
              letterDate: taskSource === "REFERRED" ? letterDate : null,
              refererId: taskSource === "REFERRED" ? refererId : null,
              approvalStatus: taskSource === "REFERRED" ? "PENDING_APPROVAL" : null,
            },
            include: { assignee: true, group: true, referer: true, approver: true },
          });
        });
        break; // success
      } catch (err: unknown) {
        // If unique constraint on code fails, retry
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("Unique") && attempt < MAX_RETRIES - 1) {
          continue;
        }
        lastError = err;
      }
    }

    if (!task) {
      console.error("Task create retry failed:", lastError);
      return NextResponse.json({ error: "خطا در تولید کد تسک. دوباره تلاش کنید." }, { status: 500 });
    }

    await db.followUpLog.create({
      data: {
        taskId: task.id,
        type: "STATUS_CHANGE",
        message: `تسک توسط ${me.name} ثبت شد.`,
      },
    });

    return NextResponse.json({ task: serializeTask(task as Parameters<typeof serializeTask>[0]) }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "خطای سرور";
    console.error("Tasks POST error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}