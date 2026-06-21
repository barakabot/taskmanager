"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DepartmentBadge } from "./badges";
import { DEPARTMENTS } from "@/lib/constants";
import { toPersianDigits } from "@/lib/jalali";
import { toast } from "sonner";
import { Plus, Trash2, GitBranch, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SubDepartment = {
  id: string;
  name: string;
  department: string;
  createdAt: string;
};

export function SubDepartmentsManager() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = React.useState("");
  const [newDept, setNewDept] = React.useState<string>("FANTASY");
  const [busy, setBusy] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["sub-departments", "all"],
    queryFn: async () => {
      const r = await fetch("/api/sub-departments");
      return (await r.json()) as { subDepartments: SubDepartment[] };
    },
  });

  const subs = data?.subDepartments ?? [];

  async function add() {
    if (!newName.trim()) {
      toast.error("نام زیرمجموعه را وارد کنید.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/sub-departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), department: newDept }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error ?? "افزودن ناموفق بود.");
        return;
      }
      toast.success(`زیرمجموعه «${newName.trim()}» اضافه شد.`);
      setNewName("");
      queryClient.invalidateQueries({ queryKey: ["sub-departments"] });
    } catch {
      toast.error("خطا در ارتباط با سرور.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`زیرمجموعه «${name}» حذف شود؟`)) return;
    try {
      const res = await fetch(`/api/sub-departments/${id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error ?? "حذف ناموفق بود.");
        return;
      }
      toast.success("زیرمجموعه حذف شد.");
      queryClient.invalidateQueries({ queryKey: ["sub-departments"] });
    } catch {
      toast.error("خطا در ارتباط با سرور.");
    }
  }

  // Group by department
  const byDept = DEPARTMENTS.map((d) => ({
    ...d,
    subs: subs.filter((s) => s.department === d.key),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GitBranch className="h-4 w-4 text-primary" />
          مدیریت زیرمجموعه‌ها
        </CardTitle>
        <CardDescription>
          زیرمجموعه‌های هر بخش را اضافه یا حذف کنید. هر کاربر یا تسک می‌تواند به یک زیرمجموعه متصل باشد.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add form */}
        <div className="flex flex-col sm:flex-row gap-2 items-end">
          <div className="flex-1 w-full">
            <Label htmlFor="sub-name" className="text-xs">نام زیرمجموعه</Label>
            <Input
              id="sub-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="مثلاً: انبار مرکزی"
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
          </div>
          <div className="w-full sm:w-44">
            <Label className="text-xs">بخش</Label>
            <Select value={newDept} onValueChange={setNewDept}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d.key} value={d.key}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={add} disabled={busy} className="shrink-0">
            <Plus className="h-4 w-4" />
            افزودن
          </Button>
        </div>

        {/* List grouped by department */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {isLoading && (
            <p className="text-sm text-muted-foreground col-span-full">در حال بارگذاری...</p>
          )}
          {!isLoading && subs.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full text-center py-4">
              هنوز زیرمجموعه‌ای ثبت نشده است.
            </p>
          )}
          {byDept.map((d) => (
            <div key={d.key} className="rounded-lg border p-3">
              <div className="flex items-center justify-between mb-2">
                <DepartmentBadge department={d.key} />
                <span className="text-xs text-muted-foreground nums-fa">
                  {toPersianDigits(d.subs.length)}
                </span>
              </div>
              {d.subs.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">—</p>
              ) : (
                <div className="space-y-1.5">
                  {d.subs.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 rounded-md border bg-card p-2 text-sm"
                    >
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1">{s.name}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        onClick={() => remove(s.id, s.name)}
                        title="حذف"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
