import { db } from "../src/lib/db";

// Seed demo data for the PMO Organizational Planning unit.
// Run with: bun run prisma/seed.ts

const DEPARTMENTS = ["FANTASY", "NON_FANTASY", "BI", "COMMISSION"] as const;

async function main() {
  console.log("🌱 Seeding PMO database...");

  // Wipe
  await db.followUpLog.deleteMany();
  await db.task.deleteMany();
  await db.member.deleteMany();
  await db.dailyReport.deleteMany();

  // ---- Members ----
  const manager = await db.member.create({
    data: {
      name: "مهندس رضایی",
      handle: "@manager",
      password: "admin",
      department: "BI",
      role: "MANAGER",
    },
  });

  const members = await db.member.createMany({
    data: [
      // Fantasy supply
      { name: "علی محمدی", handle: "@ali", password: "1234", department: "FANTASY", role: "MEMBER" },
      { name: "سارا کریمی", handle: "@sara", password: "1234", department: "FANTASY", role: "MEMBER" },
      // Non-fantasy supply
      { name: "حسین احمدی", handle: "@hossein", password: "1234", department: "NON_FANTASY", role: "MEMBER" },
      { name: "مریم نوری", handle: "@maryam", password: "1234", department: "NON_FANTASY", role: "MEMBER" },
      // BI
      { name: "رضا قاسمی", handle: "@reza", password: "1234", department: "BI", role: "MEMBER" },
      { name: "فاطمه موسوی", handle: "@fateme", password: "1234", department: "BI", role: "MEMBER" },
      // Commission
      { name: "امیر تهرانی", handle: "@amir", password: "1234", department: "COMMISSION", role: "MEMBER" },
      { name: "زهرا شریفی", handle: "@zahra", password: "1234", department: "COMMISSION", role: "MEMBER" },
    ],
  });

  const allMembers = await db.member.findMany({ where: { role: "MEMBER" } });

  // ---- Tasks ----
  const now = new Date();
  const day = 86400000;
  const hour = 3600000;

  const tasks = [
    // Fantasy
    {
      title: "تأمین کالکشن فانتزی پاییز ۱۴۰۳",
      description: "هماهنگی با تأمین‌کنندگان برای کالکشن جدید فانتزی",
      department: "FANTASY",
      assigneeHandle: "@ali",
      priority: "HIGH",
      status: "STARTED",
      deadlineOffsetDays: 0,
      deadlineHour: 18,
      link: "https://example.com/fantasy-q3",
    },
    {
      title: "بررسی کیفیت محصولات فانتزی ورودی",
      department: "FANTASY",
      assigneeHandle: "@sara",
      priority: "MEDIUM",
      status: "PENDING",
      deadlineOffsetDays: 2,
      deadlineHour: 16,
    },
    {
      title: "به‌روزرسانی لیست قیمت‌های فانتزی",
      department: "FANTASY",
      assigneeHandle: "@ali",
      priority: "LOW",
      status: "DONE",
      deadlineOffsetDays: -3,
      deadlineHour: 14,
      doneOffsetDays: -4,
    },
    // Non-fantasy
    {
      title: "سفارش انبار غیرفانتزی هفتگی",
      department: "NON_FANTASY",
      assigneeHandle: "@hossein",
      priority: "HIGH",
      status: "BLOCKED",
      deadlineOffsetDays: -1,
      deadlineHour: 12,
      followUpReason: "DEPENDENT_ON_OTHERS",
    },
    {
      title: "هماهنگی حمل‌ونقل بار غیرفانتزی",
      department: "NON_FANTASY",
      assigneeHandle: "@maryam",
      priority: "MEDIUM",
      status: "STARTED",
      deadlineOffsetDays: 1,
      deadlineHour: 17,
    },
    {
      title: "صورت‌حساب تأمین‌کنندگان غیرفانتزی",
      department: "NON_FANTASY",
      assigneeHandle: "@hossein",
      priority: "LOW",
      status: "DONE",
      deadlineOffsetDays: -5,
      deadlineHour: 15,
      doneOffsetDays: -6,
    },
    {
      title: "بازنگری قراردادهای غیرفانتزی",
      department: "NON_FANTASY",
      assigneeHandle: "@maryam",
      priority: "HIGH",
      status: "BLOCKED",
      deadlineOffsetDays: 0,
      deadlineHour: 18,
      followUpReason: "LACK_OF_INFO",
    },
    // BI
    {
      title: "ساخت داشبورد فروش هفتگی",
      department: "BI",
      assigneeHandle: "@reza",
      priority: "HIGH",
      status: "STARTED",
      deadlineOffsetDays: 0,
      deadlineHour: 19,
      link: "https://example.com/bi-weekly",
    },
    {
      title: "تحلیل ریزش مشتریان فانتزی",
      department: "BI",
      assigneeHandle: "@fateme",
      priority: "MEDIUM",
      status: "PENDING",
      deadlineOffsetDays: 3,
      deadlineHour: 16,
    },
    {
      title: "گزارش پورسانت ماهانه اردیبهشت",
      department: "BI",
      assigneeHandle: "@reza",
      priority: "MEDIUM",
      status: "BLOCKED",
      deadlineOffsetDays: -2,
      deadlineHour: 13,
      followUpReason: "HIGH_WORKLOAD",
    },
    {
      title: "مدل پیش‌بینی تقاضای فانتزی",
      department: "BI",
      assigneeHandle: "@fateme",
      priority: "HIGH",
      status: "DONE",
      deadlineOffsetDays: -7,
      deadlineHour: 18,
      doneOffsetDays: -8,
    },
    // Commission
    {
      title: "محاسبه پورسانت نمایندگان تیر",
      department: "COMMISSION",
      assigneeHandle: "@amir",
      priority: "HIGH",
      status: "STARTED",
      deadlineOffsetDays: 0,
      deadlineHour: 20,
    },
    {
      title: "تسویه حساب پورسانت شعب",
      department: "COMMISSION",
      assigneeHandle: "@zahra",
      priority: "HIGH",
      status: "BLOCKED",
      deadlineOffsetDays: -1,
      deadlineHour: 14,
      followUpReason: "TECHNICAL_ISSUE",
    },
    {
      title: "گزارش مقایسه‌ای پورسانت فصل",
      department: "COMMISSION",
      assigneeHandle: "@amir",
      priority: "LOW",
      status: "PENDING",
      deadlineOffsetDays: 4,
      deadlineHour: 17,
    },
    {
      title: "بایگانی فاکتورهای پورسانت",
      department: "COMMISSION",
      assigneeHandle: "@zahra",
      priority: "LOW",
      status: "DONE",
      deadlineOffsetDays: -6,
      deadlineHour: 12,
      doneOffsetDays: -7,
    },
    // More overdue tasks for richer BI demo
    {
      title: "تحلیل حاشیه سود فانتزی Q2",
      department: "BI",
      assigneeHandle: "@reza",
      priority: "MEDIUM",
      status: "BLOCKED",
      deadlineOffsetDays: -4,
      deadlineHour: 15,
      followUpReason: "DEPENDENT_ON_OTHERS",
    },
    {
      title: "گزارش عملکرد تأمین‌کنندگان فانتزی",
      department: "FANTASY",
      assigneeHandle: "@sara",
      priority: "MEDIUM",
      status: "BLOCKED",
      deadlineOffsetDays: -3,
      deadlineHour: 16,
      followUpReason: "LACK_OF_INFO",
    },
    {
      title: "بررسی تاخیرات ارسال غیرفانتزی",
      department: "NON_FANTASY",
      assigneeHandle: "@hossein",
      priority: "LOW",
      status: "PENDING",
      deadlineOffsetDays: -2,
      deadlineHour: 11,
    },
  ];

  let counter = 1;
  for (const t of tasks) {
    const assignee = allMembers.find((m) => m.handle === t.assigneeHandle)!;
    const deadline = new Date(
      now.getTime() + t.deadlineOffsetDays * day + (t.deadlineHour - now.getHours()) * hour
    );
    const created = new Date(now.getTime() - 5 * day - Math.random() * 3 * day);
    const startedAt =
      t.status === "STARTED" || t.status === "DONE"
        ? new Date(created.getTime() + day)
        : null;
    const doneAt =
      t.status === "DONE" && t.doneOffsetDays !== undefined
        ? new Date(now.getTime() + t.doneOffsetDays * day)
        : null;

    await db.task.create({
      data: {
        code: `TSK-${String(counter).padStart(4, "0")}`,
        title: t.title,
        description: t.description ?? null,
        department: t.department,
        assigneeId: assignee.id,
        priority: t.priority,
        status: t.status,
        deadline,
        link: t.link ?? null,
        followUpReason: t.followUpReason ?? null,
        startedAt,
        doneAt,
        createdAt: created,
        updatedAt: doneAt ?? startedAt ?? created,
      },
    });
    counter++;
  }

  // ---- A couple of follow-up logs ----
  const sampleTask = await db.task.findFirst({ where: { status: "BLOCKED" } });
  if (sampleTask) {
    await db.followUpLog.create({
      data: {
        taskId: sampleTask.id,
        type: "END_OF_DAY_REASON",
        message: "کاربر علت را انتخاب کرد",
        reason: sampleTask.followUpReason,
      },
    });
    await db.followUpLog.create({
      data: {
        taskId: sampleTask.id,
        type: "STATUS_CHANGE",
        message: "وضعیت از «در حال انجام» به «مسدود شده» تغییر کرد",
      },
    });
  }

  console.log(`✅ Seeded ${allMembers.length} members and ${tasks.length} tasks.`);
  console.log(`   Manager: ${manager.name} (${manager.handle})`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
