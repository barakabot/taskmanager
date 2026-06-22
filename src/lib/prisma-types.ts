// Re-usable Prisma payload types with common includes
import { Prisma } from "@prisma/client";

// Member with group, supervisor, and managedGroup included
export type MemberWithRelations = Prisma.MemberGetPayload<{
  include: {
    group: true;
    supervisor: true;
    managedGroup: true;
  };
}>;

// Member with group, supervisor, and task count
export type MemberWithCount = Prisma.MemberGetPayload<{
  include: {
    group: true;
    supervisor: true;
    _count: { select: { tasks: true } };
  };
}>;

// Task with full relations
export type TaskWithRelations = Prisma.TaskGetPayload<{
  include: {
    assignee: true;
    group: true;
    referer: true;
    approver: true;
  };
}>;

// Task with logs
export type TaskWithLogs = Prisma.TaskGetPayload<{
  include: {
    assignee: true;
    group: true;
    referer: true;
    approver: true;
    logs: { orderBy: { createdAt: "desc" }; take: 30 };
  };
}>;

// OrgGroup with manager and counts
export type GroupWithManager = Prisma.OrgGroupGetPayload<{
  include: {
    manager: true;
    _count: { select: { members: true; taskTemplates: true; tasks: true } };
  };
}>;

// TaskSchedule with template, assignee, and override
export type ScheduleWithRelations = Prisma.TaskScheduleGetPayload<{
  include: {
    taskTemplate: { include: { group: true } };
    assignee: true;
    overrideAssignee: true;
  };
}>;

// TaskTemplate with group and schedule count
export type TemplateWithRelations = Prisma.TaskTemplateGetPayload<{
  include: {
    group: true;
    _count: { select: { schedules: true } };
  };
}>;