export type Meal = "Breakfast" | "Lunch" | "Dinner";
export type Role = "admin" | "staff" | "member";
export type DenialCode =
  | "UNPAID"
  | "EXPIRED"
  | "NOT_IN_PLAN"
  | "WRONG_TIME"
  | "ALREADY_USED"
  | "INVALID_TOKEN"
  | "NOT_FOUND"
  | "MEAL_SKIPPED"
  | "PENDING_APPROVAL";

export interface Plan {
  planId: string;
  label: string;
  meals: Meal[];
  pricePerMonth: number;
  durationMonths: number;
  isActive?: boolean;
}

export interface Subscription {
  planId: string;
  planLabel: string;
  meals: Meal[];
  startDate: string; // ISO date YYYY-MM-DD
  endDate: string;
  isPaid: boolean;
  amountPaid: number;
  dueAmount: number;
  pricePerMonth: number;
  renewedAt?: string;
  renewalCount: number;
}

export interface Member {
  memberId: string;
  name: string;
  email: string;
  mobile: string | null;
  password?: string;
  photoUrl?: string;
  role: Role;
  isActive: boolean;
  emailVerified: boolean;
  subscription: Subscription;
  createdAt: string;
}

export interface MealUsageDay {
  memberId: string;
  date: string; // YYYY-MM-DD
  usedMeals: Record<Meal, boolean>;
}

export interface ScanLog {
  id: string;
  memberId: string;
  memberName: string;
  meal: Meal;
  date: string;
  timestamp: string;
  status: "allowed" | "denied";
  denialCode?: DenialCode;
  denialReason?: string;
  scannedBy: string;
}

export interface MealWindow {
  meal: Meal;
  startTime: string; // HH:MM
  endTime: string;
  guestPrice?: number;
}

export interface ScanResult {
  status: "allowed" | "denied";
  member?: { memberId: string; name: string; mobile?: string | null; photoUrl?: string };
  meal: Meal;
  code?: DenialCode;
  reason?: string;
  mealsUsedToday?: number;
  mealsRemainingToday?: number;
  daysRemainingInPlan?: number;
  planLabel?: string;
}

export interface Payment {
  id: string;
  memberId: string;
  memberName: string;
  memberMobile: string | null;
  planId: string | null;
  planLabel: string;
  amount: number;
  method: string;
  type: "initial" | "renewal" | "topup";
  createdAt: string;
}

export interface Menu {
  id: number;
  date: string; // YYYY-MM-DD
  meal: Meal;
  items: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardNotification {
  id: number;
  title: string;
  content: string;
  type: "general" | "holiday";
  holidayDate: string | null;
  startTime: string;
  endTime: string;
  isActive: boolean;
  blockBreakfast?: boolean;
  blockLunch?: boolean;
  blockDinner?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MealSkip {
  id: number;
  date: string;
  meal: Meal;
  createdAt: string;
}

export interface HeadcountReport {
  date: string;
  meals: Record<
    Meal,
    {
      activeSubscribers: number;
      skips: number;
      expectedPortions: number;
    }
  >;
}

export interface UnratedMeal {
  date: string;
  meal: Meal;
  items: string[];
}

export interface DishRatingStats {
  dish_name: string;
  avg_rating: number;
  total_ratings: number;
  breakdown: Record<number, number>;
}

export interface RatingComment {
  id: number;
  date: string;
  meal: Meal;
  dish_name: string;
  rating: number;
  comments: string;
  is_anonymous: boolean;
  memberName: string;
  createdAt: string;
}

export interface RatingsAnalytics {
  dishes: DishRatingStats[];
  comments: RatingComment[];
}

export interface GuestPass {
  id: string;
  member_id: string;
  guest_name: string;
  date: string;
  meal: Meal;
  qr_token: string;
  status: "pending_approval" | "active" | "used" | "expired";
  price: number;
  host_name?: string;
  host_mobile?: string;
  created_at: string;
  updated_at: string;
}
