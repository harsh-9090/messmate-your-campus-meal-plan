import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { guestPassesApi } from "@/lib/messmate/api";
import { Button } from "@/components/ui/button";
import { 
  Loader2, 
  ShieldCheck, 
  Calendar, 
  Clock, 
  User, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  HelpCircle,
  Coffee,
  Sun,
  Moon
} from "lucide-react";
import { ThemeToggle } from "@/components/messmate/ThemeToggle";

export const Route = createFileRoute("/guest-pass/$token")({
  head: () => ({
    meta: [
      { title: "Guest Pass - Mom's Kitchen" },
      { name: "description", content: "View and present your mess guest pass QR code." }
    ]
  }),
  component: GuestPassPage
});

function GuestPassPage() {
  const { token } = Route.useParams();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { data: pass, isLoading, isError, error } = useQuery<any, any>({
    queryKey: ["public-guest-pass", token],
    queryFn: () => guestPassesApi.getPublicPass(token),
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Real-time polling if the pass is pending approval, so the guest's screen 
      // automatically activates once the admin clicks "Approve" at the counter.
      return data?.status === "pending_approval" ? 5000 : false;
    }
  });

  useEffect(() => {
    if (!pass || pass.status !== "active" || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, pass.qr_token, {
      width: 240,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
      errorCorrectionLevel: "H",
    }).catch((err) => {
      console.error("QR Code generation failed", err);
    });
  }, [pass]);

  const getMealIcon = (meal: string) => {
    switch (meal) {
      case "Breakfast": return <Coffee className="h-5 w-5 text-indigo-500" />;
      case "Lunch": return <Sun className="h-5 w-5 text-amber-500 animate-spin-slow" />;
      case "Dinner": return <Moon className="h-5 w-5 text-purple-500" />;
      default: return <HelpCircle className="h-5 w-5" />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 text-sm font-semibold text-muted-foreground">Loading guest pass...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
            <XCircle className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold tracking-tight">Invalid Pass Link</h1>
            <p className="text-muted-foreground text-sm font-medium leading-relaxed">
              {error?.message || "This guest pass link is incorrect, expired, or does not exist."}
            </p>
          </div>
          <Button asChild className="w-full h-12 rounded-2xl">
            <Link to="/login">Go to Login</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

      {/* Top Bar */}
      <header className="w-full max-w-md mx-auto px-6 pt-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <img src="/apple-touch-icon.png" alt="Logo" className="h-9 w-9 rounded-full object-cover border border-primary/20 bg-primary/5 shadow-sm" />
          <span className="font-display font-extrabold tracking-tight text-slate-800 dark:text-slate-100">Mom's Kitchen</span>
        </div>
        <ThemeToggle />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 z-10 w-full max-w-md mx-auto">
        <div className="w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-[32px] p-6 shadow-glow transition-all">
          
          {/* Header Card Brand */}
          <div className="text-center space-y-1 mb-6">
            <span className="text-[10px] uppercase font-bold tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full">
              Mess Guest Pass
            </span>
            <h2 className="text-xl font-bold font-display text-slate-800 dark:text-slate-100">
              Welcome to the Mess!
            </h2>
          </div>

          {/* QR Code Presentation Box */}
          <div className="flex flex-col items-center justify-center mb-6">
            <div className="relative rounded-2xl bg-white p-3 border border-slate-100 shadow-sm overflow-hidden" style={{ width: 266, height: 266 }}>
              {pass.status === "active" ? (
                <canvas ref={canvasRef} width={240} height={240} className="w-full h-full" />
              ) : pass.status === "pending_approval" ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-4 bg-amber-50/45 dark:bg-amber-950/5">
                  <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3 animate-pulse">
                    <AlertTriangle className="h-8 w-8" />
                  </div>
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400">QR Code Locked</span>
                  <span className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                    Awaiting payment confirmation at the counter.
                  </span>
                </div>
              ) : pass.status === "used" ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-4 bg-slate-50 dark:bg-slate-900/40">
                  <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center mb-3">
                    <CheckCircle2 className="h-8 w-8 text-success" />
                  </div>
                  <span className="text-xs font-bold text-success">Pass Already Scanned</span>
                  <span className="text-[10px] text-muted-foreground mt-1">
                    Entered successfully
                  </span>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-4 bg-slate-50 dark:bg-slate-900/40">
                  <div className="w-14 h-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-3">
                    <XCircle className="h-8 w-8" />
                  </div>
                  <span className="text-xs font-bold text-destructive">Pass Expired</span>
                  <span className="text-[10px] text-muted-foreground mt-1">
                    Pass date has elapsed
                  </span>
                </div>
              )}
            </div>

            {/* Sub-QR indicator badge */}
            <div className="mt-4">
              {pass.status === "active" ? (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/35 px-4 py-1.5 rounded-full shadow-sm">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Approved · Present to Scanner</span>
                </div>
              ) : pass.status === "pending_approval" ? (
                <div className="flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 px-4 py-1.5 rounded-full animate-pulse">
                  <span>₹{pass.price} Pending Payment at Office</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-4 py-1.5 rounded-full">
                  <span>Inactive Ticket</span>
                </div>
              )}
            </div>
          </div>

          {/* Details list card */}
          <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/80 space-y-3.5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 flex items-center justify-center shadow-sm">
                <User className="h-4.5 w-4.5 text-slate-600 dark:text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground leading-none">Guest Name</div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5 truncate">{pass.guest_name}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 flex items-center justify-center shadow-sm">
                <Calendar className="h-4.5 w-4.5 text-slate-600 dark:text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground leading-none">Date</div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">{pass.date}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 flex items-center justify-center shadow-sm">
                {getMealIcon(pass.meal)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground leading-none">Meal Window</div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">{pass.meal}</div>
              </div>
            </div>

            <div className="pt-2.5 border-t border-slate-200/60 dark:border-slate-850 flex items-center justify-between text-xs">
              <span className="font-semibold text-muted-foreground">Host Member:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{pass.host_name}</span>
            </div>
          </div>

        </div>
      </main>

      {/* Footer Branding */}
      <footer className="w-full max-w-md mx-auto py-6 text-center text-[10px] font-semibold text-muted-foreground/60 tracking-wider uppercase z-10">
        Powered by MessMate Core
      </footer>
    </div>
  );
}
