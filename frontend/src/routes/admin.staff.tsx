import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { staffApi } from "@/lib/messmate/api";
import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { UserPlus, Shield, UserCog, Mail, Phone, Trash2, Edit, Loader2, Key } from "lucide-react";
import { toast } from "sonner";
import type { Member } from "@/lib/messmate/types";
import { useAuth } from "@/lib/messmate/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { ConfirmDialog } from "@/components/messmate/ConfirmDialog";

export const Route = createFileRoute("/admin/staff")({
  head: () => ({ meta: [{ title: "Staff Management - Mom's Kitchen Admin" }] }),
  component: StaffPage,
});

function StaffPage() {
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Member | null>(null);
  const [deletingStaff, setDeletingStaff] = useState<Member | null>(null);

  const staffQ = useQuery({
    queryKey: ["staff"],
    queryFn: () => staffApi.list(),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => staffApi.remove(id),
    onSuccess: () => {
      toast.success("Account deleted");
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="space-y-6 p-6 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Staff Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage administrative and operational team accounts
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="gap-2 shadow-lg shadow-primary/20">
          <UserPlus className="h-4 w-4" /> Add Team Member
        </Button>
      </header>

      <Card className="overflow-hidden border-border/50 bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table className="hidden md:table">
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Team Member</TableHead>
                <TableHead>Contact Info</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffQ.isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary/50" />
                  </TableCell>
                </TableRow>
              ) : staffQ.data?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                    No accounts found.
                  </TableCell>
                </TableRow>
              ) : (
                staffQ.data?.map((s) => (
                  <TableRow key={s.memberId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-full ${s.role === "admin" ? "bg-indigo-100 text-indigo-600" : "bg-emerald-100 text-emerald-600"}`}
                        >
                          {s.role === "admin" ? (
                            <Shield className="h-4 w-4" />
                          ) : (
                            <UserCog className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold">
                            {s.name}{" "}
                            {s.memberId === currentUser?.id && (
                              <Badge variant="secondary" className="ml-1 text-[10px]">
                                You
                              </Badge>
                            )}
                          </span>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            {s.memberId}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" /> {s.email}
                        </div>
                        {s.mobile && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3 shrink-0" />
                            <a
                              href={`tel:${s.mobile}`}
                              className="hover:underline hover:text-primary transition-colors"
                            >
                              {s.mobile}
                            </a>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`capitalize ${s.role === "admin" ? "bg-indigo-50 text-indigo-700" : "bg-emerald-50 text-emerald-700"}`}
                      >
                        {s.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-primary/10"
                          onClick={() => setEditingStaff(s)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          disabled={s.memberId === currentUser?.id}
                          onClick={() => setDeletingStaff(s)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card View */}
        <div className="grid grid-cols-1 gap-4 p-4 md:hidden">
          {staffQ.isLoading ? (
            <div className="py-10 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary/50" />
            </div>
          ) : staffQ.data?.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No accounts found.</div>
          ) : (
            staffQ.data?.map((s) => (
              <div
                key={s.memberId}
                className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm relative"
              >
                {s.memberId === currentUser?.id && (
                  <Badge variant="secondary" className="absolute top-3 right-3 text-[10px]">
                    You
                  </Badge>
                )}
                <div className="flex items-center gap-3 border-b pb-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${s.role === "admin" ? "bg-indigo-100 text-indigo-600" : "bg-emerald-100 text-emerald-600"}`}
                  >
                    {s.role === "admin" ? (
                      <Shield className="h-5 w-5" />
                    ) : (
                      <UserCog className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold">{s.name}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {s.memberId}
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4 shrink-0" />{" "}
                    <span className="truncate">{s.email}</span>
                  </div>
                  {s.mobile && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4 shrink-0" />
                      <a
                        href={`tel:${s.mobile}`}
                        className="hover:underline hover:text-primary transition-colors"
                      >
                        {s.mobile}
                      </a>
                    </div>
                  )}
                  <div className="mt-1">
                    <Badge
                      variant="secondary"
                      className={`capitalize ${s.role === "admin" ? "bg-indigo-50 text-indigo-700" : "bg-emerald-50 text-emerald-700"}`}
                    >
                      {s.role}
                    </Badge>
                  </div>
                </div>

                <div className="mt-2 flex justify-end gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setEditingStaff(s)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 border-destructive text-destructive hover:bg-destructive/10"
                    disabled={s.memberId === currentUser?.id}
                    onClick={() => setDeletingStaff(s)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <StaffDialog open={isAddOpen} onOpenChange={setIsAddOpen} />
      <StaffDialog
        open={!!editingStaff}
        onOpenChange={(open) => !open && setEditingStaff(null)}
        staff={editingStaff}
      />
      <ConfirmDialog
        isOpen={deletingStaff !== null}
        onClose={() => setDeletingStaff(null)}
        onConfirm={() => {
          if (deletingStaff) {
            deleteM.mutate(deletingStaff.memberId);
            setDeletingStaff(null);
          }
        }}
        title="Delete Staff Account?"
        description={
          deletingStaff
            ? `Are you sure you want to permanently delete the account of ${deletingStaff.name} (${deletingStaff.role})? This action cannot be undone.`
            : ""
        }
        confirmText="Delete"
        isPending={deleteM.isPending}
      />
    </div>
  );
}

function StaffDialog({
  open,
  onOpenChange,
  staff,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  staff?: Member | null;
}) {
  const qc = useQueryClient();
  const [formData, setFormData] = useState({
    memberId: "",
    name: "",
    email: "",
    mobile: "",
    password: "",
    role: "staff" as "staff" | "admin",
  });

  // Sync form data when dialog opens or staff changes
  useEffect(() => {
    if (open) {
      if (staff) {
        setFormData({
          memberId: staff.memberId || "",
          name: staff.name || "",
          email: staff.email || "",
          mobile: staff.mobile || "",
          password: "",
          role: (staff.role as "staff" | "admin") || "staff",
        });
      } else {
        setFormData({ memberId: "", name: "", email: "", mobile: "", password: "", role: "staff" });
      }
    }
  }, [open, staff]);

  const mutation = useMutation({
    mutationFn: (data: any) =>
      staff ? staffApi.update(staff.memberId, data) : staffApi.create(data),
    onSuccess: () => {
      toast.success(staff ? "Account updated" : "Team member added");
      qc.invalidateQueries({ queryKey: ["staff"] });
      onOpenChange(false);
      setFormData({ memberId: "", name: "", email: "", mobile: "", password: "", role: "staff" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Operation failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[95vw] rounded-2xl">
        <DialogHeader>
          <DialogTitle>{staff ? "Edit Team Member" : "Add Team Member"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase text-muted-foreground">
              Staff ID (Unique)
            </label>
            <Input
              placeholder="STAFF01"
              value={formData.memberId}
              onChange={(e) => setFormData({ ...formData, memberId: e.target.value.toUpperCase() })}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase text-muted-foreground">
              Full Name
            </label>
            <Input
              placeholder="John Doe"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase text-muted-foreground">
              Email Address
            </label>
            <Input
              type="email"
              placeholder="john@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase text-muted-foreground">
              Mobile Number
            </label>
            <Input
              placeholder="9988776655"
              value={formData.mobile}
              onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase text-muted-foreground">
              {staff ? "Reset Password (optional)" : "Password"}
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="••••••••"
                className="pl-9"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Role</label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={formData.role === "staff" ? "default" : "outline"}
                className="flex-1 gap-2"
                onClick={() => setFormData({ ...formData, role: "staff" })}
              >
                <UserCog className="h-4 w-4" /> Staff
              </Button>
              <Button
                type="button"
                variant={formData.role === "admin" ? "default" : "outline"}
                className="flex-1 gap-2"
                onClick={() => setFormData({ ...formData, role: "admin" })}
              >
                <Shield className="h-4 w-4" /> Admin
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate(formData)} disabled={mutation.isPending}>
            {mutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : staff ? (
              "Save Changes"
            ) : (
              "Create Account"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
