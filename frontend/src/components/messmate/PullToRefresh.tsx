import React, { useEffect, useState } from "react";
import { Loader2, ArrowDown } from "lucide-react";

interface PullToRefreshProps {
  children: React.ReactNode;
}

export function PullToRefresh({ children }: PullToRefreshProps) {
  const [pullStart, setPullStart] = useState<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only trigger if at the top of the page
      if (window.scrollY === 0 && !refreshing) {
        setPullStart(e.touches[0].clientY);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (pullStart === null || refreshing) return;

      const currentY = e.touches[0].clientY;
      const dist = currentY - pullStart;

      if (dist > 0) {
        // Prevent default scrolling physics when pulling down at the top
        if (e.cancelable) {
          e.preventDefault();
        }
        // Add resistance/rubberband effect
        const resistance = Math.min(100, dist * 0.45);
        setPullDistance(resistance);
      }
    };

    const handleTouchEnd = () => {
      if (pullStart === null || refreshing) return;

      if (pullDistance >= 60) {
        setRefreshing(true);
        setPullDistance(50);
        // Refresh by reloading the window (guarantees fresh SW checks and API queries)
        setTimeout(() => {
          window.location.reload();
        }, 600);
      } else {
        setPullStart(null);
        setPullDistance(0);
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: false });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [pullStart, pullDistance, refreshing]);

  return (
    <div className="relative">
      {/* Pull indicator */}
      {pullDistance > 0 && (
        <div
          className="fixed left-0 right-0 top-2 z-50 flex items-center justify-center pointer-events-none"
          style={{
            transform: `translateY(${pullDistance - 30}px)`,
            opacity: Math.min(1, pullDistance / 40),
            transition: pullStart === null ? "transform 0.2s ease, opacity 0.2s ease" : "none",
          }}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg border border-primary/20">
            {refreshing ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin" />
            ) : (
              <ArrowDown
                className="h-4.5 w-4.5 transition-transform duration-200"
                style={{
                  transform: `rotate(${pullDistance >= 60 ? 180 : 0}deg)`,
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Main app container offset */}
      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance * 0.4}px)` : "none",
          transition: pullStart === null ? "transform 0.2s ease" : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
