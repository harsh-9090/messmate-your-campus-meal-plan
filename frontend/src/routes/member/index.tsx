import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/messmate/auth";
import { membersApi, scanApi, configApi, menusApi, authApi, notificationsApi, skipsApi, ratingsApi } from "@/lib/messmate/api";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QRCanvas } from "@/components/messmate/QRCanvas";
import { SubscriptionBar } from "@/components/messmate/SubscriptionBar";
import { MealChip } from "@/components/messmate/MealChip";
import { PlanBadge } from "@/components/messmate/PlanBadge";
import { toast } from "sonner";
import {
  Lock,
  AlertTriangle,
  History,
  LogOut,
  UtensilsCrossed,
  CreditCard,
  QrCode,
  Mail,
  ArrowRight,
  Loader2,
  Calendar,
  TrendingDown,
  Star,
} from "lucide-react";
import {
  daysRemaining,
  formatINR,
  formatTimestamp,
  isWithinWindow,
  formatTime12h,
  todayISO,
  addDaysISO,
  formatDate,
} from "@/lib/messmate/dateHelpers";
import { MEALS } from "@/lib/messmate/constants";
import type { Meal, DashboardNotification, UnratedMeal } from "@/lib/messmate/types";
import { ThemeToggle } from "@/components/messmate/ThemeToggle";
import { GhostLoader } from "@/components/messmate/GhostLoader";

const formatHolidayDate = (n: DashboardNotification) => {
  try {
    const dateStr = n.holidayDate || "";
    
    // Calculate which meals are blocked
    const blockedList: string[] = [];
    if (n.blockBreakfast) blockedList.push("Breakfast");
    if (n.blockLunch) blockedList.push("Lunch");
    if (n.blockDinner) blockedList.push("Dinner");

    let mealSuffix = "";
    if (blockedList.length === 3) {
      mealSuffix = "";
    } else if (blockedList.length > 0) {
      mealSuffix = ` (${blockedList.join(", ")})`;
    } else {
      return "Mess is Open (No meals blocked)";
    }

    if (dateStr === todayISO()) {
      return `Mess is Closed Today${mealSuffix}`;
    }
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    const dayNum = date.getDate();
    const monthName = date.toLocaleString("en-IN", { month: "long" });

    let suffix = "th";
    if (dayNum === 1 || dayNum === 21 || dayNum === 31) suffix = "st";
    else if (dayNum === 2 || dayNum === 22) suffix = "nd";
    else if (dayNum === 3 || dayNum === 23) suffix = "rd";

    return `Mess is Closed on ${dayNum}${suffix} of ${monthName}${mealSuffix}`;
  } catch (e) {
    return `Mess is Closed: ${n.holidayDate}`;
  }
};

export const Route = createFileRoute("/member/")({
  head: () => ({
    meta: [
      { title: "My Meals - Mom's Kitchen" },
      {
        name: "description",
        content: "Your dynamic QR code, today's meal status, and 30-day plan progress.",
      },
    ],
  }),
  component: MemberPortal,
});

interface FeedbackWidgetProps {
  memberId: string;
  unratedMeals: UnratedMeal[];
  onSubmit: (data: {
    date: string;
    meal: Meal;
    ratings: Array<{ dish_name: string; rating: number }>;
    comments?: string;
    is_anonymous: boolean;
  }) => void;
  isSubmitting: boolean;
}

function FeedbackWidget({ memberId, unratedMeals, onSubmit, isSubmitting }: FeedbackWidgetProps) {
  const [dismissedKeys, setDismissedKeys] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  const activeMeals = useMemo(() => {
    return unratedMeals.filter((m) => {
      const key = `${m.date}:${m.meal}`;
      if (dismissedKeys.includes(key)) return false;
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem(`messmate:dismissed-feedback:${memberId}:${m.date}:${m.meal}`);
        return !saved;
      }
      return true;
    });
  }, [unratedMeals, dismissedKeys, memberId]);

  const current = activeMeals[0];
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);

  useEffect(() => {
    if (!current) return;
    const initial: Record<string, number> = {};
    current.items.forEach((item) => {
      initial[item] = 5;
    });
    setRatings(initial);
    setComments("");
    setIsAnonymous(false);
  }, [current]);

  if (activeMeals.length === 0) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ratingsPayload = Object.entries(ratings).map(([dish_name, rating]) => ({
      dish_name,
      rating,
    }));
    onSubmit({
      date: current.date,
      meal: current.meal,
      ratings: ratingsPayload,
      comments,
      is_anonymous: isAnonymous,
    });
  };

  const handleSkip = () => {
    const key = `${current.date}:${current.meal}`;
    if (typeof window !== "undefined") {
      localStorage.setItem(`messmate:dismissed-feedback:${memberId}:${current.date}:${current.meal}`, "true");
    }
    setDismissedKeys((prev) => [...prev, key]);
    setIsExpanded(false);
  };

  const getMealEmoji = (meal: Meal) => {
    if (meal === "Breakfast") return "🍳";
    if (meal === "Lunch") return "🍱";
    return "🍲";
  };

  if (!isExpanded) {
    return (
      <Card className="md:col-span-12 p-4 border-emerald-200 dark:border-emerald-950/40 bg-gradient-to-r from-emerald-50/30 to-teal-50/30 dark:from-emerald-950/5 dark:to-teal-950/5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className="text-xl shrink-0">{getMealEmoji(current.meal)}</span>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-sm sm:text-base text-foreground flex flex-wrap items-center gap-1.5 leading-snug">
                <span>Rate your recent {current.meal}</span>
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-[10px] shrink-0">
                  Pending Feedback
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                Served on {formatDate(current.date)} • {current.items.join(", ")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleSkip}
              className="text-xs font-bold text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border/60 hover:bg-muted/30 bg-transparent transition-colors cursor-pointer"
            >
              Skip
            </button>
            <Button
              type="button"
              onClick={() => setIsExpanded(true)}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 h-8"
            >
              Rate Now
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="md:col-span-12 p-5 border-emerald-200 dark:border-emerald-950/40 bg-gradient-to-r from-emerald-50/30 to-teal-50/30 dark:from-emerald-950/5 dark:to-teal-950/5 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between border-b pb-3 border-emerald-100 dark:border-emerald-950/20">
        <div className="flex items-center gap-2">
          <span className="text-xl">{getMealEmoji(current.meal)}</span>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-foreground flex items-center gap-1.5">
              Rate your {current.meal}
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-[10px]">
                Pending Feedback
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Served on {formatDate(current.date)}
            </p>
          </div>
        </div>
        {activeMeals.length > 1 && (
          <Badge variant="outline" className="text-xs font-semibold">
            +{activeMeals.length - 1} more pending
          </Badge>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Dish Ratings
            </label>
            <div className="space-y-2">
              {current.items.map((item) => {
                const curRating = ratings[item] || 5;
                return (
                  <div
                    key={item}
                    className="flex items-center justify-between p-2 rounded-xl bg-background/50 border border-border/50 hover:bg-background/80 transition-colors"
                  >
                    <span className="text-xs sm:text-sm font-semibold pr-2">{item}</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRatings((prev) => ({ ...prev, [item]: star }))}
                          className="p-1 focus:outline-none transition-transform hover:scale-125 cursor-pointer bg-transparent border-0"
                        >
                          <Star
                            className={cn(
                              "h-5 w-5 transition-colors",
                              star <= curRating
                                ? "fill-amber-400 text-amber-400"
                                : "text-muted/40 hover:text-amber-300"
                            )}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                Comments (Optional)
              </label>
              <textarea
                placeholder="What did you like or dislike? Any specific suggestions for the chef?"
                className="w-full min-h-[90px] rounded-xl border border-input bg-background/50 px-3 py-2 text-xs sm:text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary resize-none"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                />
                Submit Anonymously
              </label>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="text-xs font-bold text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg transition-colors cursor-pointer bg-transparent border-0"
                >
                  Collapse
                </button>
                <button
                  type="button"
                  onClick={handleSkip}
                  className="text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 px-2 py-1.5 rounded-lg transition-colors cursor-pointer bg-transparent border-0"
                >
                  Skip Meal
                </button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 h-8"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </Card>
  );
}

function MemberPortal() {
  const authUser = useAuth((s) => s.user);
  const _hasHydrated = useAuth((s) => s._hasHydrated);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"today" | "pass" | "skips" | "account">("today");
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const todayStr = todayISO();

  const meQ = useQuery({
    queryKey: ["member", authUser?.id],
    queryFn: () => membersApi.get(authUser!.id),
    enabled: !!authUser,
  });
  const windowsQ = useQuery({ queryKey: ["windows"], queryFn: () => configApi.listWindows() });
  const logsQ = useQuery({
    queryKey: ["my-logs"],
    queryFn: () => scanApi.logs({ limit: 14 }),
    enabled: !!authUser,
    refetchInterval: 15_000,
  });
  const menusQ = useQuery({
    queryKey: ["menus", "day", todayStr],
    queryFn: () => menusApi.list({ date: todayStr }),
    enabled: !!authUser,
  });
  const notificationsQ = useQuery({
    queryKey: ["notifications-active"],
    queryFn: () => notificationsApi.list(),
    enabled: !!authUser,
  });

  const skipsQ = useQuery({
    queryKey: ["my-skips"],
    queryFn: () => skipsApi.listMySkips(),
    enabled: !!authUser,
  });

  const qc = useQueryClient();
  const toggleSkipM = useMutation({
    mutationFn: (args: { date: string; meal: Meal; skip: boolean }) =>
      skipsApi.toggleSkip(args.date, args.meal, args.skip),
    onSuccess: (data) => {
      toast.success(
        data.skipped
          ? `Opted out of ${data.meal} for ${formatDate(data.date)}`
          : `Opted in to ${data.meal} for ${formatDate(data.date)}`
      );
      qc.invalidateQueries({ queryKey: ["my-skips"] });
      qc.invalidateQueries({ queryKey: ["my-logs"] });
      qc.invalidateQueries({ queryKey: ["qr-token-daily"] });
      qc.invalidateQueries({ queryKey: ["member"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to toggle meal skip");
    },
  });

  const unratedQ = useQuery({
    queryKey: ["unrated-meals"],
    queryFn: () => ratingsApi.getUnrated(),
    enabled: !!authUser,
  });

  const submitRatingM = useMutation({
    mutationFn: (args: {
      date: string;
      meal: Meal;
      ratings: Array<{ dish_name: string; rating: number }>;
      comments?: string;
      is_anonymous: boolean;
    }) => ratingsApi.submit(args),
    onSuccess: () => {
      toast.success("Thank you! Your feedback has been submitted.");
      qc.invalidateQueries({ queryKey: ["unrated-meals"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to submit feedback");
    },
  });

  const upcomingDays = useMemo(() => {
    const list = [];
    for (let i = 0; i < 7; i++) {
      list.push(addDaysISO(todayStr, i));
    }
    return list;
  }, [todayStr]);

  const getIsLocked = (dateStr: string, meal: Meal) => {
    const w = windows.find((x) => x.meal === meal);
    const startTimeStr = w?.startTime || (meal === "Breakfast" ? "07:00" : meal === "Lunch" ? "12:00" : "19:00");
    const mealStart = new Date(`${dateStr}T${startTimeStr}:00+05:30`);
    const now = new Date();
    return (mealStart.getTime() - now.getTime()) < 12 * 60 * 60 * 1000;
  };

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!authUser || authUser.role !== "member") navigate({ to: "/login" });
  }, [_hasHydrated, authUser, navigate]);

  if (!_hasHydrated || !authUser) return null;
  if (meQ.isLoading) {
    return <GhostLoader size="fullscreen" />;
  }
  if (meQ.isError || !meQ.data) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <p className="text-destructive">Couldn't load your profile.</p>
          <p className="mt-1 text-sm text-muted-foreground">Make sure the backend is running.</p>
          <Button className="mt-4" onClick={() => meQ.refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const me = meQ.data;

  if (!me.emailVerified) {
    return <EmailVerificationPanel member={me} onVerified={() => meQ.refetch()} />;
  }

  const sub = me.subscription;

  // Calculate grace period: 3 days from start
  const daysSinceStart = Math.max(0, daysRemaining(sub.startDate) * -1);
  const gracePeriod = 3;
  const inGracePeriod = !sub.isPaid && daysSinceStart <= gracePeriod;

  const left = daysRemaining(sub.endDate);
  const expired = left < 0;
  const locked = (!sub.isPaid && !inGracePeriod) || expired;

  const windows = windowsQ.data ?? [];
  const myLogs = logsQ.data ?? [];

  // Build today's usage from logs
  const todaysUsed: Record<Meal, boolean> = { Breakfast: false, Lunch: false, Dinner: false };
  myLogs.forEach((l) => {
    if (l.date === todayStr && l.status === "allowed") todaysUsed[l.meal] = true;
  });

  const menus = menusQ.data ?? [];
  const activeMeal = windows.find((w) => isWithinWindow(new Date(), w))?.meal;

  const stateOf = (meal: Meal) => {
    if (!sub.meals.includes(meal)) return "not-in-plan" as const;
    if (todaysUsed[meal]) return "used" as const;
    const w = windows.find((x) => x.meal === meal);
    if (!w || !isWithinWindow(new Date(), w)) return "window-closed" as const;
    return "available" as const;
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      {!isOnline && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-4 py-2.5 text-center text-xs font-semibold flex items-center justify-center gap-2 shadow-sm border-b border-white/10 animate-in slide-in-from-top duration-300">
          <span className="inline-block h-2 w-2 rounded-full bg-white animate-pulse shrink-0" />
          <span>Running Offline — Showing cached passes. Your offline code remains fully valid.</span>
        </div>
      )}
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl md:max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-primary text-sm font-bold text-white">
              {me.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div>
              <div className="text-sm font-semibold">{me.name}</div>
              <div className="text-xs text-muted-foreground">
                {me.memberId}
                {me.mobile && <> · 📞 {me.mobile}</>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild className="cursor-pointer">
              <Link to="/login" onClick={() => logout()}>
                <LogOut className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Tactile Mobile Tab Selector (Hidden on md and up) */}
      <div className="md:hidden flex border-b bg-background sticky top-[65px] z-10 p-1 bg-slate-50 dark:bg-slate-900 border-b">
        <button
          onClick={() => setActiveTab("today")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-all rounded-lg cursor-pointer ${
            activeTab === "today"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <UtensilsCrossed className="h-4 w-4" /> Today
        </button>
        <button
          onClick={() => setActiveTab("pass")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-all rounded-lg cursor-pointer ${
            activeTab === "pass"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <QrCode className="h-4 w-4" /> Pass
        </button>
        <button
          onClick={() => setActiveTab("skips")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-all rounded-lg cursor-pointer ${
            activeTab === "skips"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <TrendingDown className="h-4 w-4" /> Skips
        </button>
        <button
          onClick={() => setActiveTab("account")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-all rounded-lg cursor-pointer ${
            activeTab === "account"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <CreditCard className="h-4 w-4" /> Account
        </button>
      </div>

      {/* Main Grid: Stacks on mobile, side-by-side on desktop */}
      <main className="mx-auto max-w-2xl md:max-w-7xl space-y-4 md:space-y-0 p-4 md:grid md:grid-cols-12 md:gap-6">
        {/* Active Notifications Banner */}
        {notificationsQ.data && notificationsQ.data.length > 0 && (
          <div className="md:col-span-12 space-y-3 mb-4">
            {notificationsQ.data.map((n) => {
              const isHoliday = n.type === "holiday";
              return (
                <div
                  key={n.id}
                  className={cn(
                    "rounded-xl border overflow-hidden shadow-sm transition-all duration-300 bg-card",
                    isHoliday
                      ? "border-red-200 dark:border-red-900/40"
                      : "border-blue-200 dark:border-blue-900/40"
                  )}
                >
                  {/* Top Status Header Strip */}
                  <div
                    className={cn(
                      "px-4 py-2 text-xs font-bold uppercase tracking-wider text-white",
                      isHoliday ? "bg-red-600 dark:bg-red-800" : "bg-blue-600 dark:bg-blue-800"
                    )}
                  >
                    {isHoliday && n.holidayDate ? formatHolidayDate(n) : "Announcement"}
                  </div>

                  {/* Card Body content below the header */}
                  <div className="p-4 flex gap-3 items-start">
                    <span className="text-xl sm:text-2xl shrink-0 mt-0.5">
                      {isHoliday ? "⚠️" : "📢"}
                    </span>
                    <div>
                      <h4 className="font-bold text-sm sm:text-base leading-snug">
                        {n.title}
                      </h4>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                        {n.content}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Food Quality Feedback Widget */}
        {unratedQ.data && unratedQ.data.length > 0 && (
          <div className="md:col-span-12 mb-4">
            <FeedbackWidget
              memberId={authUser.id}
              unratedMeals={unratedQ.data}
              onSubmit={(payload) => submitRatingM.mutate(payload)}
              isSubmitting={submitRatingM.isPending}
            />
          </div>
        )}

        {/* COLUMN 1: Today's Menu & Meals Status (Visible if activeTab === 'today' on mobile) */}
        <div
          className={`md:col-span-3 space-y-4 ${activeTab === "today" ? "block" : "hidden md:block"}`}
        >
          {/* Today's Menu */}
          <Card className="p-4 sm:p-5 shadow-sm border-border bg-card">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-display text-base sm:text-lg font-bold flex items-center gap-1.5">
                <span>🍽️</span> Today's Menu
              </div>
              <Badge
                variant="secondary"
                className="text-[10px] font-semibold tracking-wide bg-primary/10 text-primary"
              >
                Fresh & Hygienic
              </Badge>
            </div>
            <div className="space-y-3">
              {menusQ.isLoading ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  Loading today's menu…
                </div>
              ) : menus.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground italic">
                  No menu items configured for today yet.
                </div>
              ) : (
                (["Breakfast", "Lunch", "Dinner"] as Meal[]).map((mealType) => {
                  const m = menus.find((x) => x.meal === mealType);
                  const isActive = activeMeal === mealType;
                  const w = windows.find((x) => x.meal === mealType);
                  const timeStr = w
                    ? `(${formatTime12h(w.startTime)} - ${formatTime12h(w.endTime)})`
                    : "";

                  return (
                    <div
                      key={mealType}
                      className={cn(
                        "rounded-xl p-3 border transition-all duration-200",
                        isActive
                          ? "bg-primary/5 border-primary shadow-xs ring-1 ring-primary/20"
                          : "bg-muted/10 border-muted/40 opacity-75",
                      )}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">
                            {mealType === "Breakfast" ? "🍳" : mealType === "Lunch" ? "🍛" : "🍲"}
                          </span>
                          <span className="font-bold text-sm">{mealType}</span>
                          <span className="text-[10px] text-muted-foreground font-normal">
                            {timeStr}
                          </span>
                        </div>
                        {isActive && (
                          <Badge className="bg-primary hover:bg-primary text-[9px] font-extrabold tracking-wider px-2 py-0.5 animate-pulse">
                            ACTIVE MEAL
                          </Badge>
                        )}
                      </div>
                      {m && m.items.length > 0 ? (
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap gap-1">
                            {m.items.map((item) => (
                              <span
                                key={item}
                                className="bg-background/80 dark:bg-background/40 border border-border text-foreground px-2 py-0.5 rounded-full text-[11px] font-medium shadow-xs"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                          {m.notes && (
                            <p className="text-[11px] text-primary font-semibold italic mt-1 pl-1 border-l-2 border-primary/40">
                              💡 {m.notes}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground/60 italic pl-1">
                          No items added yet.
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          {/* Today's Meals Status */}
          <Card className="p-4 sm:p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-display text-base sm:text-lg font-bold">Today's Meals</div>
              <PlanBadge planId={sub.planId} label={sub.planLabel} />
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {MEALS.map((m) => (
                <MealChip key={m} meal={m} state={stateOf(m)} />
              ))}
            </div>
          </Card>
        </div>

        {/* COLUMN 2: Pass & Warnings (Visible if activeTab === 'pass' on mobile) */}
        <div
          className={`md:col-span-3 space-y-4 ${activeTab === "pass" ? "block" : "hidden md:block"}`}
        >
          {/* Expiry Warning */}
          {!expired && left <= 3 && sub.isPaid && (
            <Card className="border-warning/40 bg-warning/10 p-4 animate-pulse">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-warning animate-bounce" />
                <div>
                  <div className="font-semibold">
                    Plan expires in {left} day{left === 1 ? "" : "s"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Contact admin to renew before it expires.
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Secure Dining Pass QR */}
          <Card className="p-5 sm:p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Your Pass
                </div>
                <div className="font-display text-xl font-bold">Scan at counter</div>
              </div>
              <UtensilsCrossed className="h-5 w-5 text-primary" />
            </div>
            <div className="grid place-items-center py-4">
              {locked ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-destructive/40 bg-destructive/5 p-8 text-center w-full max-w-sm">
                  <Lock className="h-10 w-10 text-destructive" />
                  <div className="font-display text-xl font-bold text-destructive">
                    {expired ? "Plan Expired" : "Payment Pending"}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {expired
                      ? "Your 30-day plan has ended. Contact admin to renew."
                      : `Your subscription payment is pending (Due: ${formatINR(sub.dueAmount)}). Contact admin.`}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 w-full">
                  {inGracePeriod && (
                    <Badge
                      variant="outline"
                      className="border-amber-500 bg-amber-50 text-amber-600"
                    >
                      Grace Period: {gracePeriod - daysSinceStart} days left to pay
                    </Badge>
                  )}
                  <QRCanvas meals={sub.meals} />
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* COLUMN 3: Skip Meals Planner (Visible if activeTab === 'skips' on mobile) */}
        <div
          className={`md:col-span-3 space-y-4 ${activeTab === "skips" ? "block" : "hidden md:block"}`}
        >
          <Card className="p-4 sm:p-5 shadow-sm space-y-4 border-border bg-card">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="font-display text-base sm:text-lg font-bold flex items-center gap-1.5">
                <span>🗓️</span> Skip Meals
              </div>
              <Badge variant="secondary" className="text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                12h Cut-off
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Plan your absences in advance to help reduce kitchen food waste. Toggles lock 12h before meal windows start.
            </p>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {skipsQ.isLoading || windowsQ.isLoading ? (
                <div className="py-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Loading skip calendar…
                </div>
              ) : (
                upcomingDays.map((dateStr) => {
                  const d = new Date(dateStr);
                  const isToday = dateStr === todayStr;
                  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                  
                  return (
                    <div
                      key={dateStr}
                      className={cn(
                        "rounded-xl border p-3 space-y-2 bg-muted/5 transition-all",
                        isToday && "border-primary/30 bg-primary/[0.02]"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">
                          {dayNames[d.getDay()]}, {d.getDate()} {monthNames[d.getMonth()]}
                          {isToday && (
                            <span className="ml-1.5 text-[9px] uppercase tracking-wider font-extrabold text-primary bg-primary/10 rounded-full px-1.5 py-0.5">
                              Today
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        {sub.meals.map((meal) => {
                          const isSkippedVal = (skipsQ.data ?? []).some(
                            (s) => s.date === dateStr && s.meal === meal
                          );
                          const isLockedVal = getIsLocked(dateStr, meal);
                          const isPendingToggle =
                            toggleSkipM.isPending &&
                            toggleSkipM.variables?.date === dateStr &&
                            toggleSkipM.variables?.meal === meal;

                          return (
                            <div
                              key={meal}
                              className="flex items-center justify-between text-xs bg-background/50 dark:bg-background/25 rounded-lg border border-border/40 px-2 py-1.5"
                            >
                              <span className="font-semibold text-muted-foreground/90 flex items-center gap-1">
                                {meal === "Breakfast" ? "🌅" : meal === "Lunch" ? "🍱" : "🌙"}
                                {meal}
                              </span>

                              <div className="flex items-center gap-2">
                                {isLockedVal ? (
                                  <span className="text-[10px] text-muted-foreground/60 font-medium flex items-center gap-1 select-none">
                                    <Lock className="h-3 w-3" /> Locked
                                  </span>
                                ) : null}

                                <button
                                  disabled={isLockedVal || isPendingToggle}
                                  onClick={() =>
                                    toggleSkipM.mutate({
                                      date: dateStr,
                                      meal,
                                      skip: !isSkippedVal,
                                    })
                                  }
                                  className={cn(
                                    "px-2 py-1 rounded-md text-[10px] font-bold uppercase transition-all duration-150 cursor-pointer border",
                                    isSkippedVal
                                      ? "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900/50 hover:bg-amber-200"
                                      : "bg-primary/10 dark:bg-primary/20 text-primary border-primary/25 hover:bg-primary/20",
                                    (isLockedVal || isPendingToggle) && "opacity-50 cursor-not-allowed"
                                  )}
                                >
                                  {isPendingToggle ? (
                                    <Loader2 className="h-3 w-3 animate-spin mx-auto" />
                                  ) : isSkippedVal ? (
                                    "Skipped"
                                  ) : (
                                    "Eating"
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        {/* COLUMN 4: Subscription & Historical logs (Visible if activeTab === 'account' on mobile) */}
        <div
          className={`md:col-span-3 space-y-4 ${activeTab === "account" ? "block" : "hidden md:block"}`}
        >
          {/* Subscription Progress Card */}
          <Card className="overflow-hidden p-0 shadow-sm">
            <div className="bg-gradient-primary p-5 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider opacity-70">Current Plan</div>
                  <div className="font-display text-2xl font-bold">{sub.planLabel}</div>
                  <div className="mt-1 text-sm opacity-80">
                    {formatINR(sub.pricePerMonth)} / month
                  </div>
                </div>
                <div className="text-right">
                  <Badge
                    className={
                      sub.isPaid
                        ? "bg-success text-success-foreground"
                        : "bg-destructive text-destructive-foreground"
                    }
                  >
                    {sub.isPaid ? "Paid" : "Unpaid"}
                  </Badge>
                  {sub.dueAmount > 0 && (
                    <div className="mt-1 text-[10px] font-bold text-white">
                      Due: {formatINR(sub.dueAmount)}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3 flex gap-2 text-2xl">
                {sub.meals.includes("Breakfast") && <span>🌅</span>}
                {sub.meals.includes("Lunch") && <span>🍱</span>}
                {sub.meals.includes("Dinner") && <span>🌙</span>}
              </div>
            </div>
            <div className="p-5">
              <SubscriptionBar sub={sub} />
            </div>
          </Card>

          {/* Historical Check-in Scan logs */}
          <Card className="p-4 sm:p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 border-b pb-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <div className="font-display text-lg font-bold">Recent Scans</div>
            </div>
            {myLogs.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No scans yet.</p>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {myLogs.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between rounded-lg border p-3 text-sm bg-muted/5 hover:bg-muted/10 transition-all"
                  >
                    <div>
                      <div className="font-medium">
                        {l.meal}{" "}
                        <span className="text-[10px] text-muted-foreground font-normal">
                          · {formatTimestamp(l.timestamp)}
                        </span>
                      </div>
                      {l.status === "denied" && (
                        <div className="text-[10px] text-destructive font-medium mt-0.5">
                          {l.denialReason}
                        </div>
                      )}
                    </div>
                    <Badge
                      variant={l.status === "allowed" ? "default" : "destructive"}
                      className={l.status === "allowed" ? "bg-success text-success-foreground" : ""}
                    >
                      {l.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}

function EmailVerificationPanel({ member, onVerified }: { member: any; onVerified: () => void }) {
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error("Please enter a valid 6-digit verification code.");
      return;
    }

    setSubmitting(true);
    try {
      await authApi.verifyEmail(otp);
      toast.success("Email verified successfully! Welcome to Mom's Kitchen.");
      onVerified();
    } catch (err: any) {
      toast.error(err?.message || "Invalid or expired verification code.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await authApi.resendVerification();
      toast.success("Verification code resent to your email!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to resend verification code.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Heritage Forest Green Top Bar decoration */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-primary" />

        <div className="flex flex-col items-center text-center">
          <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mb-6 text-primary animate-pulse">
            <Mail className="h-8 w-8" />
          </div>
          
          <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">
            Verify Your Email
          </h2>
          
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            We have sent a 6-digit verification code to <span className="font-semibold text-foreground">{member.email}</span>. Please enter it below to activate your meal plan.
          </p>

          <form onSubmit={handleVerify} className="w-full space-y-5">
            <div className="space-y-2 text-left">
              <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Verification Code
              </label>
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter 6-digit code"
                className="w-full text-center tracking-[0.5em] text-2xl font-bold rounded-xl border border-input bg-background px-3 py-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary placeholder:tracking-normal placeholder:text-sm placeholder:font-normal"
                disabled={submitting}
              />
              <div className="text-[11px] text-muted-foreground text-center">
                OTP is valid for <span className="font-semibold text-foreground">5 minutes</span>.
              </div>
            </div>

            <Button type="submit" className="w-full h-12 rounded-xl text-base font-semibold" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...
                </>
              ) : (
                <>
                  Verify Code <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between w-full gap-4 pt-4 border-t text-sm">
            <button
              onClick={handleResend}
              disabled={resending || submitting}
              className="text-primary hover:underline font-medium focus:outline-none disabled:opacity-50"
            >
              {resending ? "Sending code..." : "Resend code"}
            </button>
            
            <button
              onClick={async () => {
                await logout();
                navigate({ to: "/login" });
              }}
              className="text-destructive hover:underline font-medium flex items-center gap-1 focus:outline-none"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

