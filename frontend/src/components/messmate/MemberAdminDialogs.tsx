import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { membersApi } from "@/lib/messmate/api";
import { PAYMENT_METHODS } from "@/lib/messmate/constants";
import { daysRemaining, formatDate, addDaysISO, todayISO } from "@/lib/messmate/dateHelpers";
import { PlanBadge, PlanIcons } from "@/components/messmate/PlanBadge";
import type { Member, Plan } from "@/lib/messmate/types";

export function RenewMemberDialog({
  member,
  plans,
  onClose,
  onSaved,
}: {
  member: Member;
  plans: Plan[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [planId, setPlanId] = useState(member.subscription.planId);
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [applyAbsenceCredits, setApplyAbsenceCredits] = useState(false);
  const [startDate, setStartDate] = useState(todayISO());

  const selectedPlan = plans.find((p) => p.planId === planId);
  const price = selectedPlan?.pricePerMonth ?? 0;
  const amountPaidNum = parseInt(amountPaid) || 0;
  const dueAmount = Math.max(0, price - amountPaidNum);

  // Fetch consecutive absence credits
  const creditsQ = useQuery({
    queryKey: ["members", member.memberId, "absence-credits"],
    queryFn: () => membersApi.getAbsenceCredits(member.memberId),
  });

  const totalDaysAdded =
    (selectedPlan?.durationMonths ?? 1) * 30 +
    (applyAbsenceCredits ? (creditsQ.data?.totalCreditDays ?? 0) : 0);
  const projectedExpiry = formatDate(addDaysISO(startDate, totalDaysAdded));

  const renewM = useMutation({
    mutationFn: () =>
      membersApi.renew(member.memberId, {
        planId,
        amountPaid: amountPaidNum,
        paymentMethod,
        applyAbsenceCredits,
        startDate,
      }),
    onSuccess: () => {
      toast.success(`${member.name}'s plan renewed!`);
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to renew"),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md w-[95vw] rounded-2xl">
        <DialogHeader>
          <DialogTitle>Renew Subscription</DialogTitle>
          <div className="text-sm text-muted-foreground">
            {member.name} ({member.memberId})
          </div>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Select Plan</Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.planId} value={p.planId}>
                      {p.label} (₹{p.pricePerMonth})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Amount Paid</Label>
              <Input
                type="number"
                placeholder={`₹${price}`}
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Absence Reward Section */}
          {creditsQ.data && creditsQ.data.totalCreditDays > 0 && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="apply-credits-toggle"
                  checked={applyAbsenceCredits}
                  onCheckedChange={(checked) => setApplyAbsenceCredits(!!checked)}
                  className="mt-1"
                />
                <div className="space-y-0.5">
                  <Label
                    htmlFor="apply-credits-toggle"
                    className="font-semibold text-primary cursor-pointer text-sm"
                  >
                    Apply Absence Credits (+{creditsQ.data.totalCreditDays} days)
                  </Label>
                  <p className="text-xs text-muted-foreground leading-snug">
                    Streak of 3+ consecutive absent days detected in the current billing cycle.
                  </p>
                </div>
              </div>

              {/* Streaks breakdown */}
              <div className="text-xs space-y-1.5 pl-6 border-l border-primary/20 ml-2">
                <div className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px] mb-1">
                  Qualifying Streaks:
                </div>
                {creditsQ.data.streaks.map((s: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center bg-background/50 py-1 px-2 rounded border border-muted/50 text-[11px]"
                  >
                    <span className="text-muted-foreground">
                      {formatDate(s.start)} to {formatDate(s.end)}
                    </span>
                    <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-medium">
                      {s.length} days absent
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dueAmount > 0 ? (
            <div className="rounded-lg bg-destructive/10 p-3 text-center text-sm font-bold text-destructive">
              Balance Due: ₹{dueAmount}
            </div>
          ) : (
            <div className="rounded-lg bg-success/10 p-3 text-center text-sm font-bold text-success">
              Fully Paid
            </div>
          )}

          {/* Extended Expiry Preview */}
          <div className="rounded-xl bg-muted/30 p-3 space-y-2 text-sm border border-muted">
            <div className="flex justify-between text-muted-foreground">
              <span>Standard Expiration:</span>
              <span className="font-medium text-foreground">
                {formatDate(addDaysISO(startDate, (selectedPlan?.durationMonths ?? 1) * 30))}
              </span>
            </div>
            {applyAbsenceCredits && (creditsQ.data?.totalCreditDays ?? 0) > 0 && (
              <div className="flex justify-between text-success">
                <span>Absence Extension:</span>
                <span className="font-semibold">+{creditsQ.data?.totalCreditDays} Days Reward</span>
              </div>
            )}
            <div className="flex justify-between font-bold border-t pt-2 border-muted-foreground/20">
              <span>Projected Expiry Date:</span>
              <span className="text-primary">{projectedExpiry}</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => renewM.mutate()} disabled={renewM.isPending}>
            {renewM.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Renew & Log
            Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RecordPaymentDialog({
  member,
  onClose,
  onSaved,
}: {
  member: Member;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(member.subscription.dueAmount.toString());
  const [paymentMethod, setPaymentMethod] = useState("Cash");

  const savePayment = useMutation({
    mutationFn: async () => {
      const amtVal = parseInt(amount);
      if (isNaN(amtVal) || amtVal <= 0) {
        throw new Error("Please enter a valid amount greater than 0");
      }
      await membersApi.addPayment(member.memberId, amtVal, paymentMethod);
    },
    onSuccess: () => {
      toast.success("Payment recorded successfully");
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to record payment"),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md w-[95vw] rounded-2xl">
        <DialogHeader>
          <DialogTitle>Record Payment for {member.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Summary Card */}
          <div className="rounded-xl bg-muted/50 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current Plan:</span>
              <span className="font-medium">{member.subscription.planLabel || "No active plan"}</span>
            </div>
            <div className="flex justify-between text-sm border-t pt-2 border-muted/80">
              <span className="text-muted-foreground">Plan Cost:</span>
              <span className="font-semibold">₹{member.subscription.pricePerMonth}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Already Paid:</span>
              <span className="text-success font-semibold">₹{member.subscription.amountPaid}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-dashed pt-2 border-muted-foreground/20 font-bold text-destructive">
              <span>Remaining Balance:</span>
              <span>₹{member.subscription.dueAmount}</span>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-3">
            <div>
              <Label>Payment Amount (₹)</Label>
              <Input
                type="number"
                placeholder="Enter amount..."
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                max={member.subscription.dueAmount}
                min={1}
              />
            </div>
            <div>
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => savePayment.mutate()} disabled={savePayment.isPending}>
            {savePayment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Record Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ViewMemberDialog({
  member,
  onClose,
  plans,
}: {
  member: Member | null;
  onClose: () => void;
  plans: Plan[];
}) {
  if (!member) return null;

  const left = daysRemaining(member.subscription.endDate);
  const expired = left < 0;
  const startsIn = member.subscription.startDate ? daysRemaining(member.subscription.startDate) : 0;
  const startsInFuture = startsIn > 0;
  const planDietType = plans.find((p) => p.planId === member.subscription.planId)?.dietType;

  const creditsQ = useQuery({
    queryKey: ["members", member.memberId, "absence-credits"],
    queryFn: () => membersApi.getAbsenceCredits(member.memberId),
    enabled: !!member,
  });

  return (
    <Dialog open={!!member} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md w-[95vw] rounded-2xl overflow-hidden p-0 gap-0">
        <div className="bg-muted/30 p-6 border-b flex flex-col items-center justify-center text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-xl font-bold text-primary mb-3">
            {(member.name || "U").split(" ").map((n) => n[0]).slice(0, 2).join("")}
          </div>
          <DialogTitle className="text-xl mb-1">{member.name}</DialogTitle>
          <div className="text-sm text-muted-foreground font-medium mb-3">{member.memberId}</div>

          <div className="flex gap-2">
            {!member.isActive ? (
              <Badge variant="outline" className="border-amber-500 text-amber-500 bg-amber-50">Pending</Badge>
            ) : !member.subscription.isPaid ? (
              <Badge variant="destructive">Unpaid</Badge>
            ) : expired ? (
              <Badge variant="destructive">Expired</Badge>
            ) : startsInFuture ? (
              <Badge className="bg-blue-500 hover:bg-blue-600 text-white border-blue-500">Starts Soon</Badge>
            ) : (
              <Badge className="bg-success text-success-foreground">Active</Badge>
            )}
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Contact */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contact Information</h4>
            <div className="grid gap-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{member.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">College</span>
                <span className="font-medium">{member.college}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Date of Birth</span>
                <span className="font-medium">{formatDate(member.dob)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Mobile</span>
                <span className="font-medium">
                  {member.mobile ? (
                    <a href={`tel:${member.mobile}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>{member.mobile}</a>
                  ) : "N/A"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Registered</span>
                <span className="font-medium">{formatDate(member.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Subscription */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Subscription Details</h4>
            <div className="grid gap-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Plan</span>
                <PlanBadge planId={member.subscription.planId} label={member.subscription.planLabel} dietType={planDietType} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Meals Included</span>
                <PlanIcons plan={member.subscription} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Start Date</span>
                <span className="font-medium">{formatDate(member.subscription.startDate || member.createdAt)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Expiry Date</span>
                <div className="text-right">
                  <div className={cn("font-medium", expired && "text-destructive", startsInFuture && "text-blue-500")}>{formatDate(member.subscription.endDate || addDaysISO(member.createdAt, 30))}</div>
                  {(member.subscription.endDate || member.createdAt) && (
                    <div className="text-[10px] text-muted-foreground">{expired ? `${-left} days ago` : startsInFuture ? `Starts in ${startsIn} days` : `${left} days remaining`}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Leave History */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Leave History (Current Plan)</h4>
            <div className="grid gap-3 text-sm">
              {creditsQ.isLoading ? (
                <div className="text-center py-2 text-muted-foreground text-xs flex items-center justify-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading records...
                </div>
              ) : creditsQ.data && creditsQ.data.streaks.length > 0 ? (
                creditsQ.data.streaks.map((streak: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center p-2 rounded-lg bg-muted/10 border border-muted/50">
                    <div>
                      <div className="font-medium text-xs">{formatDate(streak.start)} - {formatDate(streak.end)}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{streak.length} consecutive days</div>
                    </div>
                    {streak.credit > 0 ? (
                      <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200/50 shadow-none font-semibold text-[10px] px-1.5 py-0">
                        +{streak.credit} days credit
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground/70 bg-muted/20 border-dashed font-medium text-[10px] px-1.5 py-0">
                        No credit
                      </Badge>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-5 text-muted-foreground text-xs italic bg-muted/10 rounded-lg border border-dashed">
                  No leaves recorded during this plan.
                </div>
              )}
            </div>
          </div>

          {/* Financials */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Financials</h4>
            <div className="grid gap-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Amount Paid</span>
                <span className="font-medium">₹{member.subscription.amountPaid || 0}</span>
              </div>
              {member.subscription.dueAmount > 0 && (
                <div className="flex justify-between items-center mt-2 bg-destructive/10 text-destructive p-2 rounded-md font-semibold">
                  <span>Pending Balance</span>
                  <span>₹{member.subscription.dueAmount}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="p-4 border-t sm:justify-end bg-card">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
