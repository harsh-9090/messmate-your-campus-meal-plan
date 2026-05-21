import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { menusApi, configApi } from "@/lib/messmate/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  X,
  Calendar as CalendarIcon,
  Copy,
  Trash2,
  UtensilsCrossed,
  CalendarDays,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { todayISO, formatDate, addDaysISO, formatTime12h } from "@/lib/messmate/dateHelpers";
import { cn } from "@/lib/utils";
import type { Meal, Menu } from "@/lib/messmate/types";

export const Route = createFileRoute("/admin/menu")({
  head: () => ({ meta: [{ title: "Menu Planner - Mom's Kitchen Admin" }] }),
  component: MenuPlannerPage,
});

interface MealConfig {
  items: string[];
  notes: string;
}

function MenuPlannerPage() {
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());

  // Tag inputs state for each meal
  const [tagInputs, setTagInputs] = useState<Record<Meal, string>>({
    Breakfast: "",
    Lunch: "",
    Dinner: "",
  });

  // Calculate 14 days around selectedDate for horizontal slider (7 days before, 7 days after)
  const dateList = useMemo(() => {
    const list = [];
    for (let i = -4; i <= 9; i++) {
      list.push(addDaysISO(selectedDate, i));
    }
    return list;
  }, [selectedDate]);

  const startDate = dateList[0];
  const endDate = dateList[dateList.length - 1];

  // Fetch menus in the range to display dot/status cues on configured dates
  const menusQ = useQuery({
    queryKey: ["menus", "range", { startDate, endDate }],
    queryFn: () => menusApi.list({ startDate, endDate }),
  });

  const windowsQ = useQuery({ queryKey: ["windows"], queryFn: () => configApi.listWindows() });
  const windows = windowsQ.data ?? [];

  const menusMap = useMemo(() => {
    const map = new Map<string, Menu[]>();
    (menusQ.data ?? []).forEach((m) => {
      const list = map.get(m.date) ?? [];
      list.push(m);
      map.set(m.date, list);
    });
    return map;
  }, [menusQ.data]);

  // Current selected day's menu config
  const activeMenus = useMemo(() => {
    return menusMap.get(selectedDate) ?? [];
  }, [menusMap, selectedDate]);

  // Set up local form state dynamically based on activeMenus
  const [mealConfigs, setMealConfigs] = useState<Record<Meal, MealConfig>>({
    Breakfast: { items: [], notes: "" },
    Lunch: { items: [], notes: "" },
    Dinner: { items: [], notes: "" },
  });

  // Hydrate local states once data is fetched or selectedDate changes
  React.useEffect(() => {
    const nextConfigs: Record<Meal, MealConfig> = {
      Breakfast: { items: [], notes: "" },
      Lunch: { items: [], notes: "" },
      Dinner: { items: [], notes: "" },
    };

    activeMenus.forEach((m) => {
      if (nextConfigs[m.meal]) {
        nextConfigs[m.meal] = {
          items: m.items,
          notes: m.notes ?? "",
        };
      }
    });

    setMealConfigs(nextConfigs);
  }, [activeMenus, selectedDate]);

  // Mutation to save/update a specific meal menu
  const saveMenuM = useMutation({
    mutationFn: (args: { meal: Meal; config: MealConfig }) =>
      menusApi.save({
        date: selectedDate,
        meal: args.meal,
        items: args.config.items,
        notes: args.config.notes,
      }),
    onSuccess: () => {
      toast.success("Menu saved successfully");
      qc.invalidateQueries({ queryKey: ["menus"] });
    },
    onError: () => {
      toast.error("Failed to save menu");
    },
  });

  // Mutation to delete a single meal menu
  const deleteMenuM = useMutation({
    mutationFn: (id: number) => menusApi.remove(id),
    onSuccess: () => {
      toast.success("Menu deleted successfully");
      qc.invalidateQueries({ queryKey: ["menus"] });
    },
  });

  const handleAddTag = (meal: Meal) => {
    const val = tagInputs[meal].trim();
    if (!val) return;

    // Support comma-separated item entries
    const newItems = val
      .split(",")
      .map((x) => x.trim())
      .filter((x) => x.length > 0);

    setMealConfigs((prev) => ({
      ...prev,
      [meal]: {
        ...prev[meal],
        items: [...new Set([...prev[meal].items, ...newItems])],
      },
    }));

    setTagInputs((prev) => ({ ...prev, [meal]: "" }));
  };

  const handleRemoveTag = (meal: Meal, tag: string) => {
    setMealConfigs((prev) => ({
      ...prev,
      [meal]: {
        ...prev[meal],
        items: prev[meal].items.filter((x) => x !== tag),
      },
    }));
  };

  const handleSaveMeal = (meal: Meal) => {
    const config = mealConfigs[meal];
    if (config.items.length === 0) {
      toast.warning(`Please add at least one dish for ${meal}`);
      return;
    }
    saveMenuM.mutate({ meal, config });
  };

  const handleCopyYesterday = () => {
    const yesterdayStr = addDaysISO(selectedDate, -1);
    const yesterdayMenus = menusMap.get(yesterdayStr);

    if (!yesterdayMenus || yesterdayMenus.length === 0) {
      toast.info("No menu configured for yesterday to copy!");
      return;
    }

    const nextConfigs = { ...mealConfigs };
    yesterdayMenus.forEach((m) => {
      nextConfigs[m.meal] = {
        items: m.items,
        notes: m.notes ?? "",
      };
    });

    setMealConfigs(nextConfigs);
    toast.success("Copied yesterday's menu! Don't forget to click Save.");
  };

  const getDayDetails = (dateStr: string) => {
    const d = new Date(dateStr);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return {
      dayNum: d.getDate(),
      dayName: dayNames[d.getDay()],
    };
  };

  return (
    <div className="space-y-6 p-6 md:p-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Menu Planner</h1>
          <p className="text-sm text-muted-foreground">
            Configure dates and plan delicious Breakfast, Lunch, and Dinner menus
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          {/* Quick Date Picker Input */}
          <div className="flex items-center gap-2 w-full sm:w-44 h-10 rounded-xl border border-input bg-background px-3 text-sm focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="date"
              className="w-full bg-transparent border-0 p-0 text-sm font-medium focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyYesterday}
            className="flex items-center justify-center gap-1.5 h-10 w-full sm:w-auto cursor-pointer"
          >
            <Copy className="h-4 w-4" /> Copy Yesterday
          </Button>
        </div>
      </header>

      {/* Date Horizon Slider */}
      <Card className="p-3 border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-1 mb-2 px-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" /> Date Slider Horizon
          </span>
          <span className="text-[10px] text-primary bg-primary/10 rounded-full px-2 py-0.5 font-mediumNormal">
            Showing Local Time (IST)
          </span>
        </div>
        <div className="relative flex items-center">
          <div className="flex w-full gap-2 overflow-x-auto pb-1 scrollbar-none snap-x">
            {dateList.map((dateStr) => {
              const { dayNum, dayName } = getDayDetails(dateStr);
              const isActive = dateStr === selectedDate;
              const hasConfig = (menusMap.get(dateStr) ?? []).length > 0;

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={cn(
                    "flex flex-col items-center justify-center shrink-0 w-16 py-2.5 rounded-xl border text-center transition-all duration-200 snap-center relative",
                    isActive
                      ? "bg-primary border-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.03]"
                      : "bg-background hover:bg-accent border-muted/40 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                    {dayName}
                  </span>
                  <span className="text-lg font-black mt-0.5">{dayNum}</span>

                  {/* Indicator Dot if this date already has menu items configured */}
                  {hasConfig && (
                    <span
                      className={cn(
                        "absolute bottom-1.5 h-1.5 w-1.5 rounded-full",
                        isActive ? "bg-primary-foreground" : "bg-primary animate-pulse",
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Active Selected Date Status Banner */}
      <div className="flex items-center justify-between bg-accent/30 rounded-xl px-4 py-3 border border-border">
        <span className="text-sm font-semibold">
          Active Date: <span className="text-primary font-bold">{formatDate(selectedDate)}</span>
        </span>
        <Badge
          variant="outline"
          className="gap-1.5 bg-background shadow-xs font-semibold px-2.5 py-1"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Ready to Plan
        </Badge>
      </div>

      {/* Meals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(["Breakfast", "Lunch", "Dinner"] as Meal[]).map((meal) => {
          const config = mealConfigs[meal];
          const dbMenu = activeMenus.find((m) => m.meal === meal);
          const isSaving = saveMenuM.isPending && saveMenuM.variables?.meal === meal;

          return (
            <Card
              key={meal}
              className={cn(
                "flex flex-col overflow-hidden border-border bg-card shadow-sm hover:shadow-md transition-all duration-200",
                config.items.length > 0 && "border-primary/20",
              )}
            >
              {/* Meal Header */}
              <div className="flex items-center justify-between p-4 border-b bg-muted/20">
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                    <UtensilsCrossed className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold leading-tight">{meal}</h3>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      {(() => {
                        const w = windows.find((x) => x.meal === meal);
                        return w
                          ? `${formatTime12h(w.startTime)} - ${formatTime12h(w.endTime)}`
                          : "";
                      })()}
                    </p>
                  </div>
                </div>
                {dbMenu && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    onClick={() => deleteMenuM.mutate(dbMenu.id)}
                    title="Delete Menu"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Meal Body */}
              <div className="flex-1 p-5 space-y-4">
                {/* Food Items Input */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Dishes / Food Items
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type dish & hit Enter or Add…"
                      value={tagInputs[meal]}
                      onChange={(e) =>
                        setTagInputs((prev) => ({ ...prev, [meal]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTag(meal);
                        }
                      }}
                    />
                    <Button size="icon" variant="secondary" onClick={() => handleAddTag(meal)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Render Tags */}
                  <div className="flex flex-wrap gap-1.5 pt-1.5 min-h-[4.5rem] content-start">
                    {config.items.length === 0 ? (
                      <span className="text-xs text-muted-foreground/60 italic self-center mx-auto">
                        No dishes added yet. Enter items above.
                      </span>
                    ) : (
                      config.items.map((item) => (
                        <Badge
                          key={item}
                          variant="secondary"
                          className="pl-2.5 pr-1 py-1 rounded-full text-xs font-medium border border-border flex items-center gap-1 group bg-background/50 hover:bg-background transition-all duration-150"
                        >
                          {item}
                          <button
                            onClick={() => handleRemoveTag(meal, item)}
                            className="text-muted-foreground group-hover:text-destructive rounded-full p-0.5 hover:bg-muted transition-all duration-150"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))
                    )}
                  </div>
                </div>

                {/* Special Note */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Special Note / Sweets
                  </Label>
                  <Input
                    placeholder="e.g. Special Mango Halwa! 🥭"
                    value={config.notes}
                    onChange={(e) =>
                      setMealConfigs((prev) => ({
                        ...prev,
                        [meal]: { ...prev[meal], notes: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>

              {/* Meal Footer Save Button */}
              <div className="p-4 border-t bg-muted/10">
                <Button
                  className="w-full font-bold shadow-sm"
                  disabled={isSaving}
                  onClick={() => handleSaveMeal(meal)}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving Menu…
                    </>
                  ) : (
                    "Save Menu"
                  )}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
