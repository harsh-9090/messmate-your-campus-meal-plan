import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { configApi } from "@/lib/messmate/api";
import { useAuth } from "@/lib/messmate/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: "Settings - Mom's Kitchen Admin" }] }),
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  const qc = useQueryClient();
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  
  const resetM = useMutation({
    mutationFn: () => configApi.factoryReset(),
    onSuccess: () => {
      qc.clear();
      toast.success("Factory reset complete. Logging out...");
      useAuth.getState().logout();
      window.location.href = "/login";
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to reset system");
    }
  });

  return (
    <div className="space-y-6 p-6 md:p-8">
      <header>
        <h1 className="font-display text-3xl font-bold">System Settings</h1>
        <p className="text-sm text-muted-foreground">Manage advanced system operations and data.</p>
      </header>

      <div className="pt-4">
        <Card className="p-6 border-destructive/20 bg-destructive/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <ShieldAlert className="w-32 h-32 text-destructive" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h3 className="font-display text-xl font-bold text-destructive flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" /> Danger Zone
              </h3>
              <p className="text-sm text-destructive/80 mt-1 max-w-xl font-medium">
                Performing a Factory Reset will permanently wipe all operational data (members, scan logs, payments, etc.) but retain admin accounts and configurations.
              </p>
            </div>
            <Button
              variant="destructive"
              size="lg"
              className="shrink-0 shadow-lg shadow-destructive/20"
              onClick={() => {
                setResetConfirmText("");
                setResetDialogOpen(true);
              }}
            >
              Factory Reset System
            </Button>
          </div>
        </Card>
      </div>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border-destructive/20">
          <DialogHeader>
            <div className="mx-auto bg-destructive/10 p-3 rounded-full mb-2 w-12 h-12 flex items-center justify-center">
              <ShieldAlert className="text-destructive w-6 h-6" />
            </div>
            <DialogTitle className="text-center text-xl">Are you absolutely sure?</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground text-center">
              This action <span className="font-bold text-foreground">cannot be undone</span>. This will permanently delete all students, scan logs, subscriptions, and payments.
            </p>
            
            <div className="bg-muted p-4 rounded-xl border space-y-2">
              <p className="text-sm font-medium">Please type <span className="font-bold font-mono bg-background px-1.5 py-0.5 rounded text-destructive select-all">FACTORY RESET</span> to confirm.</p>
              <input 
                type="text" 
                className="w-full h-10 px-3 rounded-lg border bg-background font-mono text-sm focus:outline-none focus:ring-2 focus:ring-destructive/20"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="FACTORY RESET"
              />
            </div>
          </div>
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full" onClick={() => setResetDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              className="w-full"
              disabled={resetConfirmText !== "FACTORY RESET" || resetM.isPending}
              onClick={() => resetM.mutate()}
            >
              {resetM.isPending ? "Resetting..." : "Yes, Wipe All Data"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
