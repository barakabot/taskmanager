"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TaskCard } from "./task-card";
import { TaskDetailSheet } from "./task-detail-sheet";
import { DepartmentBadge, PriorityBadge, StatusBadge, ReasonBadge } from "./badges";
import {
  DEPARTMENTS,
  PRIORITIES,
  STATUSES,
} from "@/lib/constants";
import type { SerializedTask } from "@/lib/serialize";
import {
  formatJalaliDate,
  formatTime,
  toPersianDigits,
  isOverdue,
} from "@/lib/jalali";
import { Search, Filter, X, LayoutGrid, List, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  filters: {
    department: string | null;
    priority: string | null;
    overdueOnly: boolean;
  };
  setFilters: (
    f: { department: string | null; priority: string | null; overdueOnly: boolean }
  ) => void;
  showAssignee?: boolean;
  assigneeFilter?: string | null;
  title?: string;
}

export function TaskListView({
  filters,
  setFilters,
  showAssignee = true,
  assigneeFilter = null,
  title = "لیست تسک‌ها",
}: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [layout, setLayout] = React.useState<"table" | "grid">("table");
  const [selected, setSelected] = React.useState<SerializedTask | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["tasks", "list", assigneeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (assigneeFilter) params.set("assigneeId", assigneeFilter);
      const r = await fetch(`/api/tasks?${params.toString()}`);
      return (await r.json()) as { tasks: SerializedTask[] };
    },
  });

  const tasks = (data?.tasks ?? []).filter((t) => {
    if (filters.department && t.department !== filters.department) return false;
    if (filters.priority && t.priority !== filters.priority) return false;
    if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
    if (
      filters.overdueOnly &&
      !(t.status !== "DONE" && new Date(t.deadline).getTime() < Date.now())
    )
      return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (
        !t.title.toLowerCase().includes(q) &&
        !t.code.toLowerCase().includes(q) &&
        !t.assigneeName.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const activeFilterCount =
    (filters.department ? 1 : 0) +
    (filters.priority ? 1 : 0) +
    (statusFilter !== "ALL" ? 1 : 0) +
    (filters.overdueOnly ? 1 : 0);

  function clearFilters() {
    setFilters({ department: null, priority: null, overdueOnly: false });
    setStatusFilter("ALL");
    setSearch("");
  }

  function openTask(task: SerializedTask) {
    setSelected(task);
    setSheetOpen(true);
  }

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو در عنوان، کد یا نام مسئول..."
            className="pr-8"
          />
        </div>

        <Select
          value={filters.department ?? "ALL"}
          onValueChange={(v) =>
            setFilters({ ...filters, department: v === "ALL" ? null : v })
          }
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="بخش" />
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

        <Select
          value={filters.priority ?? "ALL"}
          onValueChange={(v) =>
            setFilters({ ...filters, priority: v === "ALL" ? null : v })
          }
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="اولویت" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه اولویت‌ها</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p.key} value={p.key}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="وضعیت" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s.key} value={s.key}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={filters.overdueOnly ? "default" : "outline"}
          size="icon"
          onClick={() => setFilters({ ...filters, overdueOnly: !filters.overdueOnly })}
          title="فقط عقب‌افتاده‌ها"
          className={cn(filters.overdueOnly && "bg-rose-600 hover:bg-rose-700")}
        >
          <AlertTriangle className="h-4 w-4" />
        </Button>

        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4" />
            پاک کردن ({toPersianDigits(activeFilterCount)})
          </Button>
        )}

        <div className="flex items-center rounded-md border ml-auto">
          <Button
            variant={layout === "table" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setLayout("table")}
            className="rounded-l-none"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={layout === "grid" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setLayout("grid")}
            className="rounded-r-none"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Result count */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5" />
          {toPersianDigits(tasks.length)} تسک
          {title && <span className="opacity-60">— {title}</span>}
        </span>
      </div>

      {/* Content */}
      {layout === "table" ? (
        <div className="flex-1 rounded-lg border overflow-hidden">
          <ScrollArea className="h-full scroll-area-pmo">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-[90px]">کد</TableHead>
                  <TableHead className="min-w-[200px]">عنوان تسک</TableHead>
                  {showAssignee && <TableHead className="w-[120px]">مسئول</TableHead>}
                  <TableHead className="w-[130px]">بخش</TableHead>
                  <TableHead className="w-[90px]">اولویت</TableHead>
                  <TableHead className="w-[110px]">وضعیت</TableHead>
                  <TableHead className="w-[120px]">شروع</TableHead>
                  <TableHead className="w-[140px]">ددلاین</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      در حال بارگذاری...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && tasks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                      تسکی با این فیلترها یافت نشد.
                    </TableCell>
                  </TableRow>
                )}
                {tasks.map((task) => {
                  const dl = new Date(task.deadline);
                  const st = task.startTime ? new Date(task.startTime) : null;
                  const overdue = isOverdue(dl, task.status);
                  return (
                    <TableRow
                      key={task.id}
                      onClick={() => openTask(task)}
                      className="cursor-pointer"
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {task.code}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {overdue && (
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                          )}
                          <span className="line-clamp-1">{task.title}</span>
                          {task.followUpReason && (
                            <ReasonBadge reason={task.followUpReason} className="hidden xl:inline-flex" />
                          )}
                        </div>
                      </TableCell>
                      {showAssignee && (
                        <TableCell className="text-sm">{task.assigneeName}</TableCell>
                      )}
                      <TableCell>
                        <DepartmentBadge department={task.department} />
                      </TableCell>
                      <TableCell>
                        <PriorityBadge priority={task.priority} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={task.status} />
                      </TableCell>
                      <TableCell className="nums-fa text-xs text-sky-600 dark:text-sky-400">
                        {st
                          ? `${formatJalaliDate(st)} ${toPersianDigits(formatTime(st))}`
                          : "—"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "nums-fa text-xs",
                          overdue && "text-rose-600 dark:text-rose-400 font-medium"
                        )}
                      >
                        {formatJalaliDate(dl)} {toPersianDigits(formatTime(dl))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      ) : (
        <ScrollArea className="flex-1 scroll-area-pmo">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} onClick={() => openTask(task)} />
            ))}
            {!isLoading && tasks.length === 0 && (
              <div className="col-span-full text-center text-muted-foreground py-12">
                تسکی با این فیلترها یافت نشد.
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      <TaskDetailSheet
        task={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
          queryClient.invalidateQueries({ queryKey: ["members"] });
        }}
      />
    </div>
  );
}
