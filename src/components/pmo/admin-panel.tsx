"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DepartmentBadge } from "./badges";
import {
  MemberDialog,
  ResetPasswordDialog,
  DeleteMemberDialog,
} from "./member-dialog";
import type { SerializedMember } from "@/lib/serialize";
import { DEPARTMENTS } from "@/lib/constants";
import { toPersianDigits, formatJalaliDate, formatTime } from "@/lib/jalali";
import {
  UserPlus,
  Search,
  KeyRound,
  Pencil,
  Trash2,
  Crown,
  Shield,
  Users,
  CheckCircle2,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminPanelView() {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [deptFilter, setDeptFilter] = React.useState("ALL");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SerializedMember | null>(null);
  const [resetTarget, setResetTarget] = React.useState<SerializedMember | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<SerializedMember | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "members"],
    queryFn: async () => {
      const r = await fetch("/api/admin/members");
      if (r.status === 401 || r.status === 403) {
        return { members: [] as SerializedMember[] };
      }
      return (await r.json()) as { members: SerializedMember[] };
    },
  });

  const members = (data?.members ?? []).filter((m) => {
    if (deptFilter !== "ALL" && m.department !== deptFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (
        !m.name.toLowerCase().includes(q) &&
        !m.handle.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const stats = React.useMemo(() => {
    const all = data?.members ?? [];
    return {
      total: all.length,
      managers: all.filter((m) => m.role === "MANAGER").length,
      active: all.reduce((a, b) => a + b.activeCount, 0),
      tasks: all.reduce((a, b) => a + b.taskCount, 0),
    };
  }, [data]);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin", "members"] });
    queryClient.invalidateQueries({ queryKey: ["members"] });
  }

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(m: SerializedMember) {
    setEditing(m);
    setDialogOpen(true);
  }

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="کل اعضا" value={stats.total} icon={<Users className="h-4 w-4" />} tone="slate" />
        <StatCard label="مدیران" value={stats.managers} icon={<Crown className="h-4 w-4" />} tone="amber" />
        <StatCard label="تسک‌های فعال" value={stats.active} icon={<ClipboardCheck className="h-4 w-4" />} tone="sky" />
        <StatCard label="کل تسک‌ها" value={stats.tasks} icon={<CheckCircle2 className="h-4 w-4" />} tone="emerald" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو بر اساس نام یا هندل..."
            className="pr-8"
          />
        </div>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه بخش‌ها</SelectItem>
            {DEPARTMENTS.map((d) => (
              <SelectItem key={d.key} value={d.key}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={openNew} className="shrink-0">
          <UserPlus className="h-4 w-4" />
          افزودن کاربر
        </Button>
      </div>

      {/* Members table */}
      <div className="flex-1 rounded-lg border overflow-hidden">
        <ScrollArea className="h-full scroll-area-pmo">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="min-w-[160px]">کاربر</TableHead>
                <TableHead className="w-[120px]">هندل</TableHead>
                <TableHead className="w-[130px]">بخش</TableHead>
                <TableHead className="w-[90px]">نقش</TableHead>
                <TableHead className="w-[110px]">رمز عبور</TableHead>
                <TableHead className="w-[80px] text-center">تسک</TableHead>
                <TableHead className="w-[80px] text-center">فعال</TableHead>
                <TableHead className="w-[130px]">آخرین ورود</TableHead>
                <TableHead className="w-[140px] text-center">عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                [1, 2, 3].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={9}>
                      <Skeleton className="h-8" />
                    </TableCell>
                  </TableRow>
                ))}
              {!isLoading && members.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                    کاربری یافت نشد.
                  </TableCell>
                </TableRow>
              )}
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                        {m.name.charAt(0)}
                      </span>
                      <span className="font-medium">{m.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm" dir="ltr">
                    {m.handle}
                  </TableCell>
                  <TableCell>
                    <DepartmentBadge department={m.department} />
                  </TableCell>
                  <TableCell>
                    {m.role === "MANAGER" ? (
                      <Badge className="gap-1 bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300">
                        <Crown className="h-3 w-3" />
                        مدیر
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <Shield className="h-3 w-3" />
                        عضو
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded nums-fa" dir="ltr">
                      {m.password ?? "••••"}
                    </code>
                  </TableCell>
                  <TableCell className="text-center nums-fa">{toPersianDigits(m.taskCount)}</TableCell>
                  <TableCell className="text-center">
                    <span
                      className={cn(
                        "nums-fa font-medium",
                        m.activeCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                      )}
                    >
                      {toPersianDigits(m.activeCount)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground nums-fa">
                    {m.lastLoginAt
                      ? `${formatJalaliDate(new Date(m.lastLoginAt))} ${toPersianDigits(
                          formatTime(new Date(m.lastLoginAt))
                        )}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title="ویرایش"
                        onClick={() => openEdit(m)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title="تغییر رمز"
                        onClick={() => setResetTarget(m)}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        title="حذف"
                        onClick={() => setDeleteTarget(m)}
                        disabled={m.role === "MANAGER"}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      <MemberDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={refresh}
        editing={editing}
      />
      <ResetPasswordDialog
        open={!!resetTarget}
        onOpenChange={(v) => !v && setResetTarget(null)}
        member={resetTarget}
        onDone={() => refresh()}
      />
      <DeleteMemberDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        member={deleteTarget}
        onDone={refresh}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "slate" | "amber" | "sky" | "emerald";
}) {
  const toneClasses = {
    slate: "text-slate-600 bg-slate-100 dark:bg-slate-800/50 dark:text-slate-300",
    amber: "text-amber-700 bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300",
    sky: "text-sky-700 bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300",
    emerald: "text-emerald-700 bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300",
  }[tone];
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className={cn("h-7 w-7 rounded-md flex items-center justify-center", toneClasses)}>
            {icon}
          </span>
        </div>
        <div className="text-2xl font-bold nums-fa">{toPersianDigits(value)}</div>
      </CardContent>
    </Card>
  );
}
