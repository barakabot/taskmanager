import type { Task, Member, FollowUpLog } from "@prisma/client";

// Serialize a task + assignee into a plain JSON-safe object.
export type SerializedTask = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  department: string;
  assigneeId: string;
  assigneeName: string;
  assigneeHandle: string;
  priority: string;
  status: string;
  deadline: string; // ISO
  link: string | null;
  followUpReason: string | null;
  startedAt: string | null;
  doneAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function serializeTask(
  task: Task & { assignee: Member | null }
): SerializedTask {
  return {
    id: task.id,
    code: task.code,
    title: task.title,
    description: task.description,
    department: task.department,
    assigneeId: task.assigneeId,
    assigneeName: task.assignee?.name ?? "—",
    assigneeHandle: task.assignee?.handle ?? "—",
    priority: task.priority,
    status: task.status,
    deadline: task.deadline.toISOString(),
    link: task.link,
    followUpReason: task.followUpReason,
    startedAt: task.startedAt ? task.startedAt.toISOString() : null,
    doneAt: task.doneAt ? task.doneAt.toISOString() : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export type SerializedMember = {
  id: string;
  name: string;
  handle: string;
  department: string;
  role: string;
  taskCount: number;
  activeCount: number;
  password?: string; // only included in admin contexts
  lastLoginAt: string | null;
};

export function serializeMember(
  member: Member & { _count?: { tasks: number } },
  activeCount: number,
  includePassword = false
): SerializedMember {
  return {
    id: member.id,
    name: member.name,
    handle: member.handle,
    department: member.department,
    role: member.role,
    taskCount: member._count?.tasks ?? 0,
    activeCount,
    ...(includePassword ? { password: member.password } : {}),
    lastLoginAt: member.lastLoginAt ? member.lastLoginAt.toISOString() : null,
  };
}

export type SerializedLog = {
  id: string;
  type: string;
  message: string;
  reason: string | null;
  createdAt: string;
};

export function serializeLog(log: FollowUpLog): SerializedLog {
  return {
    id: log.id,
    type: log.type,
    message: log.message,
    reason: log.reason,
    createdAt: log.createdAt.toISOString(),
  };
}
