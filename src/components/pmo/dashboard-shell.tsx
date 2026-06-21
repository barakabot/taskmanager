"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NewTaskDialog } from "./new-task-dialog";
import { OverviewView } from "./overview-view";
import { KanbanView } from "./kanban-view";
import { TaskListView } from "./task-list-view";
import { CalendarView } from "./calendar-view";
import { BIView } from "./bi-view";
import { ReportsView } from "./reports-view";
import { MyTasksView } from "./my-tasks-view";
import { MembersView } from "./members-view";
import { AdminPanelView } from "./admin-panel";
import { LoginScreen } from "./login-screen";
import { ThemeToggle } from "./theme-toggle";
import { usePMOStore, type ViewKey } from "@/lib/pmo-store";
import type { SerializedTask } from "@/lib/serialize";
import { toPersianDigits, isOverdue, formatJalaliLong } from "@/lib/jalali";
import { departmentByKey } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  LayoutDashboard,
  KanbanSquare,
  ListChecks,
  BarChart3,
  FileBarChart,
  CheckSquare,
  Users,
  Settings,
  Plus,
  Menu,
  X,
  Sun,
  Clock,
  LogOut,
  ChevronDown,
  Crown,
  CalendarDays,
} from "lucide-react";

type NavItem = {
  key: ViewKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
  managerOnly?: boolean;
};

const ALL_NAV: NavItem[] = [
  { key: "overview", label: "داشبورد", icon: LayoutDashboard, desc: "نمای کلی و شاخص‌ها" },
  { key: "kanban", label: "کانبان", icon: KanbanSquare, desc: "نمودار کانبان با درگ‌اند‌دراپ" },
  { key: "list", label: "لیست تسک‌ها", icon: ListChecks, desc: "جدول با فیلترهای پیشرفته" },
  { key: "calendar", label: "تقویم", icon: CalendarDays, desc: "تقویم شمسی تسک‌ها" },
  { key: "bi", label: "هوش تجاری", icon: BarChart3, desc: "نمودارها و هیت‌مپ", managerOnly: true },
  { key: "reports", label: "گزارش‌ها", icon: FileBarChart, desc: "صبحگاهی و پایان روز", managerOnly: true },
  { key: "mytasks", label: "کارهای من", icon: CheckSquare, desc: "تسک‌های شخصی من" },
  { key: "members", label: "اعضا", icon: Users, desc: "تیم به تفکیک بخش", managerOnly: true },
  { key: "admin", label: "پنل مدیریت", icon: Settings, desc: "مدیریت کاربران و دسترسی‌ها", managerOnly: true },
];

export function DashboardShell() {
  const member = usePMOStore((s) => s.member);
  const authLoading = usePMOStore((s) => s.authLoading);
  const setMember = usePMOStore((s) => s.setMember);
  const setAuthLoading = usePMOStore((s) => s.setAuthLoading);
  const view = usePMOStore((s) => s.view);
  const setView = usePMOStore((s) => s.setView);
  const isManager = member?.role === "MANAGER";

  const [newTaskOpen, setNewTaskOpen] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [filters, setFilters] = React.useState({
    department: null as string | null,
    priority: null as string | null,
    overdueOnly: false,
  });

  // Check session on mount
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/auth/me");
        if (r.ok) {
          const data = await r.json();
          if (!cancelled && data.member) {
            setMember(data.member);
            // Members default to "mytasks"; managers default to "overview"
            setView(data.member.role === "MANAGER" ? "overview" : "mytasks");
          } else if (!cancelled) {
            setMember(null);
          }
        } else if (!cancelled) {
          setMember(null);
        }
      } catch {
        if (!cancelled) setMember(null);
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch tasks (role-scoped server-side)
  const { data } = useQuery({
    queryKey: ["tasks", "all", member?.id],
    queryFn: async () => {
      const r = await fetch("/api/tasks");
      if (r.status === 401) return { tasks: [] as SerializedTask[] };
      return (await r.json()) as { tasks: SerializedTask[] };
    },
    enabled: !!member,
  });
  const tasks = data?.tasks ?? [];
  const overdueCount = tasks.filter((t) => isOverdue(new Date(t.deadline), t.status)).length;

  const queryClient = useQueryClient();
  function refreshAll() {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    queryClient.invalidateQueries({ queryKey: ["members"] });
    queryClient.invalidateQueries({ queryKey: ["admin"] });
    queryClient.invalidateQueries({ queryKey: ["report"] });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    queryClient.clear();
    setMember(null);
    setView("overview");
    toast.success("از حساب خارج شدید.");
  }

  // ---- Auth gate ----
  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-muted/20">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-sm">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  if (!member) {
    return <LoginScreen />;
  }

  const nav = ALL_NAV.filter((n) => !n.managerOnly || isManager);
  const currentNav = nav.find((n) => n.key === view) ?? nav[0];
  const dept = departmentByKey(member.department);

  return (
    <div className="h-screen flex flex-col bg-muted/20">
      {/* Top bar */}
      <header className="h-14 shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-30">
        <div className="h-full flex items-center gap-3 px-3 sm:px-4">
          <button
            className="lg:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setMobileNavOpen((v) => !v)}
          >
            {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              پ
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-bold leading-tight">PMO Agent</div>
              <div className="text-[10px] text-muted-foreground leading-tight">
                واحد برنامه‌ریزی سازمان
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-1.5 mr-2">
            <Badge variant="outline" className="gap-1 text-xs font-normal">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              آنلاین
            </Badge>
            {overdueCount > 0 && (
              <Badge className="gap-1 text-xs bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300">
                {toPersianDigits(overdueCount)} عقب‌افتاده
              </Badge>
            )}
          </div>

          <div className="mr-auto flex items-center gap-2">
            {isManager && (
              <Button
                size="sm"
                onClick={() => setNewTaskOpen(true)}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">تسک جدید</span>
              </Button>
            )}
            <ThemeToggle />

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-1.5 px-2 h-9">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback
                      className={cn(
                        "text-xs font-bold",
                        isManager
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                          : "bg-primary/10 text-primary"
                      )}
                    >
                      {member.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm font-medium max-w-[120px] truncate">
                    {member.name}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback
                        className={cn(
                          isManager
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                            : "bg-primary/10 text-primary"
                        )}
                      >
                        {member.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate flex items-center gap-1">
                        {member.name}
                        {isManager && <Crown className="h-3 w-3 text-amber-500" />}
                      </div>
                      <div className="text-xs text-muted-foreground" dir="ltr">
                        {member.handle}
                      </div>
                    </div>
                  </div>
                  {dept && (
                    <div className="mt-2 pt-2 border-t text-xs text-muted-foreground flex items-center justify-between">
                      <span>بخش:</span>
                      <span className="font-medium text-foreground">{dept.label}</span>
                    </div>
                  )}
                  <div className="mt-1 text-xs text-muted-foreground flex items-center justify-between">
                    <span>نقش:</span>
                    <span className="font-medium text-foreground">
                      {isManager ? "مدیر واحد" : "عضو تیم"}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {!isManager && (
                  <div className="px-2 py-1.5 text-[11px] text-muted-foreground bg-muted/40">
                    شما فقط تسک‌های خودتان را می‌بینید.
                  </div>
                )}
                <DropdownMenuItem onClick={logout} className="text-rose-600 focus:text-rose-700">
                  <LogOut className="h-4 w-4" />
                  خروج از حساب
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside
          className={cn(
            "w-60 shrink-0 border-l bg-background flex-col z-20",
            "fixed lg:static inset-y-0 right-0 top-14 lg:top-0",
            "transition-transform lg:translate-x-0",
            mobileNavOpen ? "flex translate-x-0" : "flex translate-x-full lg:translate-x-0"
          )}
        >
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto scroll-area-pmo">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = view === item.key;
              const count =
                item.key === "list" || item.key === "kanban"
                  ? tasks.length
                  : item.key === "mytasks"
                  ? tasks.filter((t) => t.status !== "DONE").length
                  : null;
              return (
                <button
                  key={item.key}
                  onClick={() => {
                    setView(item.key);
                    setMobileNavOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors text-right",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 font-medium">{item.label}</span>
                  {item.managerOnly && (
                    <Crown
                      className={cn(
                        "h-3 w-3",
                        active ? "text-primary-foreground/70" : "text-amber-500"
                      )}
                    />
                  )}
                  {count !== null && count > 0 && (
                    <span
                      className={cn(
                        "text-xs nums-fa rounded-md px-1.5 py-0.5",
                        active ? "bg-primary-foreground/20" : "bg-muted"
                      )}
                    >
                      {toPersianDigits(count)}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Cron info footer */}
          <div className="p-3 border-t space-y-2">
            <div className="rounded-lg bg-muted/60 p-2.5 text-[11px] space-y-1.5">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                زمان‌سنجی خودکار
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Sun className="h-3 w-3 text-amber-500" />
                  صبحگاهی
                </span>
                <span className="nums-fa">۰۸:۰۰</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-1">
                  <FileBarChart className="h-3 w-3 text-primary" />
                  گزارش مدیر
                </span>
                <span className="nums-fa">۱۹:۰۰</span>
              </div>
              <p className="text-[10px] text-muted-foreground pt-1 border-t">
                منطقه زمانی: Asia/Tehran
              </p>
            </div>
          </div>
        </aside>

        {/* Mobile overlay */}
        {mobileNavOpen && (
          <div
            className="fixed inset-0 top-14 bg-black/30 z-10 lg:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="h-12 shrink-0 border-b bg-background px-4 flex items-center justify-between">
            <div>
              <h1 className="text-sm font-semibold flex items-center gap-2">
                {currentNav?.label}
                {currentNav?.managerOnly && (
                  <Crown className="h-3.5 w-3.5 text-amber-500" />
                )}
              </h1>
              <p className="text-[11px] text-muted-foreground hidden sm:block">
                {currentNav?.desc}
                {!isManager && (currentNav?.key === "kanban" || currentNav?.key === "list") && (
                  <span className="text-amber-600 dark:text-amber-400"> — فقط تسک‌های شما</span>
                )}
              </p>
            </div>
            <div className="text-[11px] text-muted-foreground nums-fa hidden sm:block">
              {formatJalaliLong(new Date())}
            </div>
          </div>
          <div className="flex-1 overflow-hidden p-3 sm:p-4">
            {view === "overview" && (
              <OverviewView onNewTask={() => setNewTaskOpen(true)} tasks={tasks} />
            )}
            {view === "kanban" && (
              <KanbanView filters={filters} onNewTask={() => setNewTaskOpen(true)} />
            )}
            {view === "list" && (
              <TaskListView filters={filters} setFilters={setFilters} />
            )}
            {view === "calendar" && <CalendarView />}
            {view === "bi" && isManager && <BIView />}
            {view === "reports" && isManager && <ReportsView />}
            {view === "mytasks" && <MyTasksView />}
            {view === "members" && isManager && <MembersView />}
            {view === "admin" && isManager && <AdminPanelView />}
          </div>
        </main>
      </div>

      {isManager && (
        <NewTaskDialog
          open={newTaskOpen}
          onOpenChange={setNewTaskOpen}
          onCreated={refreshAll}
        />
      )}
    </div>
  );
}
