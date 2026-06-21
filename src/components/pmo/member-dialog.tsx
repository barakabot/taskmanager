"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEPARTMENTS } from "@/lib/constants";
import type { SerializedMember } from "@/lib/serialize";
import { toast } from "sonner";
import { UserPlus, Save, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  editing?: SerializedMember | null;
}

export function MemberDialog({ open, onOpenChange, onSaved, editing }: Props) {
  const [name, setName] = React.useState("");
  const [handle, setHandle] = React.useState("");
  const [password, setPassword] = React.useState("1234");
  const [department, setDepartment] = React.useState<string>("FANTASY");
  const [role, setRole] = React.useState<string>("MEMBER");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setHandle(editing?.handle ?? "");
      setPassword(editing?.password ?? "1234");
      setDepartment(editing?.department ?? "FANTASY");
      setRole(editing?.role ?? "MEMBER");
    }
  }, [open, editing]);

  async function save() {
    if (!name.trim() || !handle.trim() || !department) {
      toast.error("نام، هندل و بخش الزامی است.");
      return;
    }
    setBusy(true);
    try {
      const url = editing
        ? `/api/admin/members/${editing.id}`
        : "/api/admin/members";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          handle: handle.trim(),
          password: password.trim() || "1234",
          department,
          role,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "ذخیره ناموفق بود.");
        return;
      }
      toast.success(editing ? "اطلاعات کاربر به‌روزرسانی شد." : "کاربر جدید اضافه شد.");
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error("خطا در ارتباط با سرور.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editing ? (
              <>
                <Save className="h-5 w-5 text-primary" />
                ویرایش کاربر
              </>
            ) : (
              <>
                <UserPlus className="h-5 w-5 text-primary" />
                افزودن کاربر جدید
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "اطلاعات کاربر را ویرایش کنید."
              : "یک کاربر جدید به تیم اضافه کنید."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="m-name">نام کامل *</Label>
            <Input
              id="m-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً: علی محمدی"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-handle">هندل *</Label>
            <Input
              id="m-handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@ali"
              dir="ltr"
              className="text-left"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-pwd" className="flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" />
              رمز عبور
            </Label>
            <Input
              id="m-pwd"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              dir="ltr"
              className="text-left"
            />
            <p className="text-[11px] text-muted-foreground">
              رمز پیش‌فرض: 1234 — کاربر می‌تواند بعداً از اینجا تغییر کند.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>بخش</Label>
              <Select value={department} onValueChange={setDepartment}>
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
            <div className="space-y-1.5">
              <Label>نقش</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBER">عضو (ساده)</SelectItem>
                  <SelectItem value="MANAGER">مدیر</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {role === "MANAGER" && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-xs text-primary">
              مدیران به همه تسک‌ها، گزارش‌ها و پنل مدیریت دسترسی دارند.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? "در حال ذخیره..." : "ذخیره"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  member,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  member: SerializedMember | null;
  onDone: (newPwd: string) => void;
}) {
  const [pwd, setPwd] = React.useState("1234");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) setPwd("1234");
  }, [open]);

  if (!member) return null;

  async function reset() {
    if (!member) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resetPassword", password: pwd }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "تغییر رمز ناموفق بود.");
        return;
      }
      toast.success(`رمز جدید برای ${member.name}: ${data.newPassword}`);
      onDone(data.newPassword);
      onOpenChange(false);
    } catch {
      toast.error("خطا در ارتباط با سرور.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            تغییر رمز عبور
          </DialogTitle>
          <DialogDescription>
            رمز جدید برای <span className="font-medium">{member.name}</span> (
            {member.handle})
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="r-pwd">رمز عبور جدید</Label>
          <Input
            id="r-pwd"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            dir="ltr"
            className="text-left"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button onClick={reset} disabled={busy}>
            {busy ? "..." : "تغییر رمز"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteMemberDialog({
  open,
  onOpenChange,
  member,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  member: SerializedMember | null;
  onDone: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  if (!member) return null;

  async function del() {
    if (!member) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/members/${member.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "حذف ناموفق بود.");
        return;
      }
      toast.success(`${member.name} حذف شد.`);
      onDone();
      onOpenChange(false);
    } catch {
      toast.error("خطا در ارتباط با سرور.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>حذف کاربر</DialogTitle>
          <DialogDescription>
            آیا از حذف <span className="font-medium">{member.name}</span> (
            {member.handle}) مطمئن هستید؟ این عملیات قابل بازگشت نیست.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button
            variant="destructive"
            onClick={del}
            disabled={busy}
            className={cn(busy && "opacity-70")}
          >
            {busy ? "در حال حذف..." : "حذف کاربر"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
