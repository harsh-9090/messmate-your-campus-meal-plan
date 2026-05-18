import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { qrApi } from "@/lib/messmate/api";
import { Loader2, ShieldCheck } from "lucide-react";

interface Props {
  meals?: string[];
  size?: number;
}

const getAutoSelectedMeal = (allowedMeals: string[]): string => {
  const hours = new Date().getHours();
  let preferred = "";
  if (hours >= 5 && hours < 11.5) preferred = "Breakfast";
  else if (hours >= 11.5 && hours < 16.5) preferred = "Lunch";
  else if (hours >= 16.5 && hours < 23) preferred = "Dinner";
  
  if (preferred && allowedMeals.includes(preferred)) {
    return preferred;
  }
  return allowedMeals[0] || "Breakfast";
};

export function QRCanvas({ meals = ["Breakfast", "Lunch", "Dinner"], size = 200 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Dynamically auto-select current active meal type
  const [selectedMeal, setSelectedMeal] = useState(() => getAutoSelectedMeal(meals));

  const { data, isError, isLoading } = useQuery({
    queryKey: ["qr-token-daily"],
    queryFn: () => qrApi.token(),
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 60 * 6, // 6 hours local cache since date is static
    retry: 2,
  });

  const selectedToken = data?.tokens?.[selectedMeal];

  useEffect(() => {
    if (!selectedToken || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, selectedToken, {
      width: size,
      margin: 1,
      color: { dark: "#1e1b4b", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).catch(() => { });
  }, [selectedToken, size]);

  return (
    <div className="flex flex-col items-center justify-center space-y-5 w-full">
      {/* Premium Segmented Controls / Pills */}
      <div className="inline-flex rounded-full bg-slate-100 dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-800">
        {meals.map((m) => {
          const isActive = selectedMeal === m;
          return (
            <button
              key={m}
              onClick={() => setSelectedMeal(m)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide transition-all duration-300 cursor-pointer ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm scale-105"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m}
            </button>
          );
        })}
      </div>

      {/* QR Canvas Card */}
      <div className="rounded-2xl bg-white p-3 shadow-glow" style={{ width: size + 24, height: size + 24 }}>
        {isLoading ? (
          <div className="grid h-full w-full place-items-center text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : isError ? (
          <div className="grid h-full w-full place-items-center px-4 text-center text-xs font-medium text-destructive">
            QR unavailable - check connection
          </div>
        ) : !selectedToken ? (
          <div className="grid h-full w-full place-items-center px-4 text-center text-xs font-medium text-muted-foreground">
            No active pass for {selectedMeal}
          </div>
        ) : (
          <canvas ref={canvasRef} width={size} height={size} />
        )}
      </div>

      {/* Verified Secure Footer Badge */}
      <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-success bg-success/5 border border-success/15 px-3 py-1 rounded-full">
        <ShieldCheck className="h-3.5 w-3.5" />
        <span>Today's Pass · Secure Static QR</span>
      </div>
    </div>
  );
}
