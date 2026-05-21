import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ratingsApi } from "@/lib/messmate/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/messmate/dateHelpers";
import { cn } from "@/lib/utils";
import {
  Star,
  MessageSquare,
  TrendingDown,
  TrendingUp,
  Loader2,
  ChefHat,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/admin/feedback")({
  head: () => ({
    meta: [
      { title: "Food Feedback - MessMate Admin" },
      { name: "description", content: "Granular dish ratings and feedback analytics from students." },
    ],
  }),
  component: AdminFeedbackPage,
});

function AdminFeedbackPage() {
  const { data: analytics, isLoading, error, refetch } = useQuery({
    queryKey: ["ratings-analytics"],
    queryFn: () => ratingsApi.getAnalytics(),
    refetchInterval: 30_000, // auto-refresh every 30 seconds
  });

  const [filterRating, setFilterRating] = useState<number | "all">("all");

  const dishes = analytics?.dishes ?? [];
  const comments = analytics?.comments ?? [];

  const filteredComments = useMemo(() => {
    if (filterRating === "all") return comments;
    return comments.filter((c) => c.rating === filterRating);
  }, [comments, filterRating]);

  // Overall statistics
  const stats = useMemo(() => {
    if (dishes.length === 0) return { avg: 0, total: 0, happyPercent: 0 };
    let sum = 0;
    let count = 0;
    let positive = 0;

    dishes.forEach((d) => {
      sum += d.avg_rating * d.total_ratings;
      count += d.total_ratings;
      
      // Calculate 4 and 5 stars for positive sentiment
      const r4 = d.breakdown[4] || 0;
      const r5 = d.breakdown[5] || 0;
      positive += r4 + r5;
    });

    const avg = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;
    const happyPercent = count > 0 ? Math.round((positive / count) * 100) : 0;

    return { avg, total: count, happyPercent };
  }, [dishes]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
        <p className="mt-2 text-sm text-muted-foreground">Loading food quality analytics…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <p className="text-destructive font-bold">Failed to load feedback data</p>
        <button
          className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow"
          onClick={() => refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Food Quality Feedback</h1>
          <p className="text-sm text-muted-foreground">
            Granular rating details and comments submitted by students to optimize the menu
          </p>
        </div>
      </header>

      {/* Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="p-5 border-border bg-card shadow-sm flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/10 text-amber-500">
            <Star className="h-6 w-6 fill-amber-500" />
          </div>
          <div>
            <div className="text-2xl font-black">{stats.avg} / 5.0</div>
            <div className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
              Average Rating
            </div>
          </div>
        </Card>

        <Card className="p-5 border-border bg-card shadow-sm flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/10 text-blue-500">
            <MessageSquare className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-black">{stats.total}</div>
            <div className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
              Total Feedbacks
            </div>
          </div>
        </Card>

        <Card className="p-5 border-border bg-card shadow-sm flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-500">
            <ThumbsUp className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-black">{stats.happyPercent}%</div>
            <div className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
              Student Satisfaction (4+★)
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Dish performance leaderboard */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="p-6 border-border bg-card shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 mb-4 gap-2">
              <div className="flex items-center gap-2">
                <ChefHat className="h-5 w-5 text-primary" />
                <h2 className="font-display text-lg font-bold">Dish Performance Leaderboard</h2>
              </div>
              <Badge variant="outline" className="text-xs w-fit">
                {dishes.length} Dishes Rated
              </Badge>
            </div>

            {dishes.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground italic">
                No dish ratings received yet. Ratings appear here after students scan and rate their meals.
              </div>
            ) : (
              <div className="space-y-4">
                {dishes.map((dish, idx) => {
                  const isTop = dish.avg_rating >= 4.0;
                  const isLow = dish.avg_rating < 3.0;
                  return (
                    <div
                      key={dish.dish_name}
                      className="p-4 rounded-xl border border-border/50 bg-background/50 hover:bg-background/80 transition-colors space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-xs font-bold text-muted-foreground/60 w-5 shrink-0">
                            #{idx + 1}
                          </span>
                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <span className="font-bold text-sm sm:text-base">{dish.dish_name}</span>
                            {isTop && (
                              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border-0 text-[10px] shrink-0">
                                Popular
                              </Badge>
                            )}
                            {isLow && (
                              <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 font-bold border-0 text-[10px] shrink-0">
                                Review Needed
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 bg-card px-2.5 py-1 rounded-lg border text-xs sm:text-sm font-bold shadow-sm shrink-0 w-fit self-start sm:self-auto">
                          <Star className="h-4 w-4 fill-amber-400 text-amber-400 shrink-0" />
                          <span>{dish.avg_rating}</span>
                          <span className="text-muted-foreground font-normal">
                            ({dish.total_ratings} {dish.total_ratings === 1 ? "vote" : "votes"})
                          </span>
                        </div>
                      </div>

                      {/* Visual Progress Rating Bar */}
                      <div className="space-y-1">
                        <div className="flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          {[5, 4, 3, 2, 1].map((ratingVal) => {
                            const count = dish.breakdown[ratingVal] || 0;
                            const pct = dish.total_ratings > 0 ? (count / dish.total_ratings) * 100 : 0;
                            const colors: Record<number, string> = {
                              5: "bg-emerald-500",
                              4: "bg-teal-400",
                              3: "bg-amber-400",
                              2: "bg-orange-400",
                              1: "bg-rose-500",
                            };
                            return (
                              <div
                                key={ratingVal}
                                style={{ width: `${pct}%` }}
                                className={cn("h-full transition-all", colors[ratingVal])}
                                title={`${ratingVal} Star: ${count} votes (${Math.round(pct)}%)`}
                              />
                            );
                          })}
                        </div>
                        <div className="flex justify-between text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wide">
                          <span>Negative</span>
                          <span>Neutral</span>
                          <span>Positive</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Feedback Comment Feed */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="p-6 border-border bg-card shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 mb-4 gap-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <h2 className="font-display text-lg font-bold">Student Reviews</h2>
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  value={filterRating}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFilterRating(v === "all" ? "all" : Number(v));
                  }}
                  className="rounded-lg border border-input bg-background px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                >
                  <option value="all">All Ratings</option>
                  <option value="5">5 Stars only</option>
                  <option value="4">4 Stars only</option>
                  <option value="3">3 Stars only</option>
                  <option value="2">2 Stars only</option>
                  <option value="1">1 Star only</option>
                </select>
              </div>
            </div>

            {filteredComments.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground italic">
                No reviews found matching the filter.
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                {filteredComments.map((comment) => (
                  <div
                    key={comment.id}
                    className="p-4 rounded-xl border border-border bg-background/30 dark:bg-background/10 space-y-2.5 transition-all hover:bg-background/50"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-bold text-xs sm:text-sm">
                          {comment.memberName}
                        </span>
                        <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                          {formatDate(comment.date)} · {comment.meal} ·{" "}
                          <span className="font-semibold text-primary">{comment.dish_name}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-lg text-xs font-bold shrink-0">
                        <Star className="h-3 w-3 fill-amber-500" />
                        <span>{comment.rating}</span>
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm leading-relaxed text-foreground italic bg-card p-3 rounded-lg border border-border/30">
                      "{comment.comments}"
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
