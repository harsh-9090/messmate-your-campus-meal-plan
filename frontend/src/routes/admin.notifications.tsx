import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "@/lib/messmate/api";
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
import {
  Megaphone,
  Calendar,
  Clock,
  Trash2,
  Edit,
  Loader2,
  AlertTriangle,
  PlusCircle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { DashboardNotification } from "@/lib/messmate/types";

export const Route = createFileRoute("/admin/notifications")({
  head: () => ({ meta: [{ title: "Announcements - Mom's Kitchen Admin" }] }),
  component: NotificationsPage,
});

const toDatetimeLocal = (isoString?: string) => {
  if (!isoString) return "";
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function NotificationsPage() {
  const qc = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingNotification, setEditingNotification] = useState<DashboardNotification | null>(null);

  const notificationsQ = useQuery({
    queryKey: ["notifications-all"],
    queryFn: () => notificationsApi.listAll(),
  });

  const deleteM = useMutation({
    mutationFn: (id: number) => notificationsApi.remove(id),
    onSuccess: () => {
      toast.success("Notification deleted successfully");
      qc.invalidateQueries({ queryKey: ["notifications-all"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete notification"),
  });

  const toggleM = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      notificationsApi.update(id, { isActive }),
    onSuccess: () => {
      toast.success("Notification status updated");
      qc.invalidateQueries({ queryKey: ["notifications-all"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update notification"),
  });

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  return (
    <div className="space-y-6 p-6 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Announcements</h1>
          <p className="text-sm text-muted-foreground">
            Schedule holidays, news, and notifications displayed to active members.
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="gap-2 shadow-lg shadow-primary/20">
          <PlusCircle className="h-4 w-4" /> Create Announcement
        </Button>
      </header>

      <Card className="overflow-hidden border-border/50 bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table className="hidden md:table">
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Notification Details</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Holiday Date</TableHead>
                <TableHead>Schedule Window</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notificationsQ.isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary/50" />
                  </TableCell>
                </TableRow>
              ) : notificationsQ.data?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No announcements configured.
                  </TableCell>
                </TableRow>
              ) : (
                notificationsQ.data?.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="max-w-xs">
                      <div className="flex flex-col">
                        <span className="font-bold text-foreground">{n.title}</span>
                        <span className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {n.content}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          n.type === "holiday"
                            ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/50"
                            : "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900/50"
                        }
                      >
                        {n.type === "holiday" ? "Holiday" : "General Notice"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {n.holidayDate ? (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5 text-sm text-foreground">
                            <Calendar className="h-4 w-4 text-amber-500" />
                            <span className="font-medium">{n.holidayDate}</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {n.blockBreakfast && <Badge variant="outline" className="text-[9px] px-1 py-0 border-red-200 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300">Breakfast</Badge>}
                            {n.blockLunch && <Badge variant="outline" className="text-[9px] px-1 py-0 border-red-200 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300">Lunch</Badge>}
                            {n.blockDinner && <Badge variant="outline" className="text-[9px] px-1 py-0 border-red-200 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300">Dinner</Badge>}
                            {!n.blockBreakfast && !n.blockLunch && !n.blockDinner && <span className="text-[9px] text-muted-foreground font-semibold">(No meals blocked)</span>}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                        <div>
                          <span className="font-semibold text-foreground">Starts:</span>{" "}
                          {formatDateTime(n.startTime)}
                        </div>
                        <div>
                          <span className="font-semibold text-foreground">Ends:</span>{" "}
                          {formatDateTime(n.endTime)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleM.mutate({ id: n.id, isActive: !n.isActive })}
                        className="h-7 px-2"
                      >
                        {n.isActive ? (
                          <Badge className="bg-success text-white border-0 cursor-pointer hover:bg-success/90">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground border-dashed cursor-pointer">
                            Inactive
                          </Badge>
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-primary/10"
                          onClick={() => setEditingNotification(n)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm("Permanently delete this announcement?"))
                              deleteM.mutate(n.id);
                          }}
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

        {/* Mobile View */}
        <div className="grid grid-cols-1 gap-4 p-4 md:hidden">
          {notificationsQ.isLoading ? (
            <div className="py-10 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary/50" />
            </div>
          ) : notificationsQ.data?.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No announcements configured.</div>
          ) : (
            notificationsQ.data?.map((n) => (
              <div
                key={n.id}
                className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm relative"
              >
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="flex flex-col">
                    <span className="font-bold text-foreground">{n.title}</span>
                    {/* <span className="text-[10px] text-muted-foreground mt-0.5">
                      ID: #{n.id}
                    </span> */}
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      n.type === "holiday"
                        ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/50"
                        : "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900/50"
                    }
                  >
                    {n.type === "holiday" ? "Holiday" : "Notice"}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {n.content}
                </p>

                {n.holidayDate && (
                  <div className="flex flex-col gap-2 text-xs text-foreground bg-amber-50 dark:bg-amber-950/20 px-2.5 py-2 rounded-lg border border-amber-200 dark:border-amber-900/30">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-amber-500" />
                      <span>Holiday Date: <strong className="font-bold">{n.holidayDate}</strong></span>
                    </div>
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-[10px] text-muted-foreground mr-1">Blocked:</span>
                      {n.blockBreakfast && <Badge variant="outline" className="text-[8px] px-1 py-0 border-red-200 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300">Breakfast</Badge>}
                      {n.blockLunch && <Badge variant="outline" className="text-[8px] px-1 py-0 border-red-200 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300">Lunch</Badge>}
                      {n.blockDinner && <Badge variant="outline" className="text-[8px] px-1 py-0 border-red-200 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300">Dinner</Badge>}
                      {!n.blockBreakfast && !n.blockLunch && !n.blockDinner && <span className="text-[8px] text-muted-foreground font-semibold">(None)</span>}
                    </div>
                  </div>
                )}

                <div className="grid gap-1.5 text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded-lg">
                  <div>
                    <strong className="text-foreground">Starts:</strong> {formatDateTime(n.startTime)}
                  </div>
                  <div>
                    <strong className="text-foreground">Ends:</strong> {formatDateTime(n.endTime)}
                  </div>
                </div>

                <div className="mt-2 flex justify-between items-center pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-0 h-auto"
                    onClick={() => toggleM.mutate({ id: n.id, isActive: !n.isActive })}
                  >
                    {n.isActive ? (
                      <Badge className="bg-success text-white">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground border-dashed">Inactive</Badge>
                    )}
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setEditingNotification(n)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 border-destructive text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm("Permanently delete this announcement?")) deleteM.mutate(n.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <NotificationDialog open={isAddOpen} onOpenChange={setIsAddOpen} />
      <NotificationDialog
        open={!!editingNotification}
        onOpenChange={(open) => !open && setEditingNotification(null)}
        notification={editingNotification}
      />
    </div>
  );
}

function NotificationDialog({
  open,
  onOpenChange,
  notification,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  notification?: DashboardNotification | null;
}) {
  const qc = useQueryClient();
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    type: "general" as "general" | "holiday",
    holidayDate: "",
    startTime: "",
    endTime: "",
    isActive: true,
    blockBreakfast: true,
    blockLunch: true,
    blockDinner: true,
  });

  // Sync form data when dialog opens or notification changes
  useEffect(() => {
    if (open) {
      if (notification) {
        setFormData({
          title: notification.title || "",
          content: notification.content || "",
          type: notification.type || "general",
          holidayDate: notification.holidayDate || "",
          startTime: toDatetimeLocal(notification.startTime),
          endTime: toDatetimeLocal(notification.endTime),
          isActive: notification.isActive ?? true,
          blockBreakfast: notification.blockBreakfast ?? true,
          blockLunch: notification.blockLunch ?? true,
          blockDinner: notification.blockDinner ?? true,
        });
      } else {
        const now = new Date();
        const twoDaysLater = new Date(now.getTime() + 48 * 60 * 60 * 1000);
        setFormData({
          title: "",
          content: "",
          type: "general",
          holidayDate: "",
          startTime: toDatetimeLocal(now.toISOString()),
          endTime: toDatetimeLocal(twoDaysLater.toISOString()),
          isActive: true,
          blockBreakfast: true,
          blockLunch: true,
          blockDinner: true,
        });
      }
    }
  }, [open, notification]);

  const mutation = useMutation({
    mutationFn: (data: any) => {
      const payload = {
        ...data,
        startTime: data.type === "general" ? new Date(data.startTime).toISOString() : new Date().toISOString(),
        endTime: data.type === "general" ? new Date(data.endTime).toISOString() : new Date().toISOString(),
        holidayDate: data.type === "holiday" ? (data.holidayDate || null) : null,
      };
      return notification ? notificationsApi.update(notification.id, payload) : notificationsApi.create(payload);
    },
    onSuccess: () => {
      toast.success(notification ? "Announcement updated" : "Announcement created");
      qc.invalidateQueries({ queryKey: ["notifications-all"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Operation failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[95vw] rounded-2xl">
        <DialogHeader>
          <DialogTitle>{notification ? "Edit Announcement" : "Create Announcement"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Title</label>
            <Input
              placeholder="e.g. Diwali Holiday Announcement"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Content</label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Detailed message description..."
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Announcement Type</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant={formData.type === "general" ? "default" : "outline"}
                className="flex-1 gap-2 justify-center"
                onClick={() => setFormData({ ...formData, type: "general" })}
              >
                <Megaphone className="h-4 w-4" /> General Notice
              </Button>
              <Button
                type="button"
                variant={formData.type === "holiday" ? "default" : "outline"}
                className="flex-1 gap-2 justify-center hover:border-amber-500/50"
                onClick={() => {
                  // For holiday, pre-fill holiday date matching today's YYYY-MM-DD
                  const todayStr = new Date().toISOString().split("T")[0];
                  setFormData({
                    ...formData,
                    type: "holiday",
                    holidayDate: formData.holidayDate || todayStr,
                  });
                }}
              >
                <Calendar className="h-4 w-4" /> Holiday
              </Button>
            </div>
          </div>

          {formData.type === "holiday" && (
            <div className="grid gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 p-3 rounded-xl animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  <strong>Holiday QR code blocking active:</strong> Subscribed members will NOT be allowed to generate QR dining codes or validate meal scans for the selected blocked meals.
                </div>
              </div>
              <div className="grid gap-1 mt-3">
                <label className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400">
                  Holiday Date (YYYY-MM-DD)
                </label>
                <Input
                  type="date"
                  value={formData.holidayDate}
                  onChange={(e) => setFormData({ ...formData, holidayDate: e.target.value })}
                  className="bg-background border-amber-300 dark:border-amber-800 focus-visible:ring-amber-500"
                />
              </div>

              {/* Blocked Meals Checkboxes */}
              <div className="grid gap-2 mt-3 pt-2 border-t border-amber-200/50">
                <label className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400">
                  Meals to Block
                </label>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.blockBreakfast}
                      onChange={(e) => setFormData({ ...formData, blockBreakfast: e.target.checked })}
                      className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                    />
                    Breakfast
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.blockLunch}
                      onChange={(e) => setFormData({ ...formData, blockLunch: e.target.checked })}
                      className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                    />
                    Lunch
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.blockDinner}
                      onChange={(e) => setFormData({ ...formData, blockDinner: e.target.checked })}
                      className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                    />
                    Dinner
                  </label>
                </div>
              </div>
            </div>
          )}

          {formData.type !== "holiday" && (
            <div className="grid grid-cols-1 gap-3">
              <div className="grid gap-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Display Starts</label>
                <Input
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Display Ends</label>
                <Input
                  type="datetime-local"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="h-4.5 w-4.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
            />
            <label htmlFor="isActive" className="text-sm font-semibold text-foreground cursor-pointer select-none">
              Mark as Active (Show to students)
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate(formData)} disabled={mutation.isPending}>
            {mutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : notification ? (
              "Save Changes"
            ) : (
              "Create Announcement"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
