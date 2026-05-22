import React, { useEffect, useState, useRef } from "react";
import { Loader2, ArrowDown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface PullToRefreshProps {
  children: React.ReactNode;
}

export function PullToRefresh({ children }: PullToRefreshProps) {
  const qc = useQueryClient();
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const pullStartRef = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const refreshingRef = useRef(false);

  // Sync refs so event handlers always read the freshest state
  refreshingRef.current = refreshing;
  pullDistanceRef.current = pullDistance;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only start tracking if we're scrolled to the absolute top and not already refreshing
      if (window.scrollY === 0 && !refreshingRef.current) {
        pullStartRef.current = e.touches[0].clientY;
        setIsPulling(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (pullStartRef.current === null || refreshingRef.current) return;

      const currentY = e.touches[0].clientY;
      const dist = currentY - pullStartRef.current;

      if (dist > 0) {
        // Prevent default browser rubber-banding/scrolling physics
        if (e.cancelable) {
          e.preventDefault();
        }
        // Apply rubberband resistance
        const resistance = Math.min(100, dist * 0.38);
        setPullDistance(resistance);
      }
    };

    const handleTouchEnd = async () => {
      setIsPulling(false);
      if (pullStartRef.current === null || refreshingRef.current) {
        pullStartRef.current = null;
        return;
      }

      pullStartRef.current = null;
      const currentDist = pullDistanceRef.current;

      // Threshold is 80px for a deliberate pull
      if (currentDist >= 80) {
        setRefreshing(true);
        setPullDistance(55); // Hold indicator at standard loading height

        try {
          // Perform high-performance soft query refetch of active views
          await qc.refetchQueries({ active: true });
        } catch (err) {
          console.error("Pull-to-refresh failed to update queries:", err);
        } finally {
          setRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [qc]);

  return (
    <div className="relative">
      {/* Pull-down indicator */}
      {pullDistance > 0 && (
        <div
          className="fixed left-0 right-0 top-3 z-50 flex items-center justify-center pointer-events-none"
          style={{
            transform: `translateY(${pullDistance - 35}px)`,
            opacity: Math.min(1, pullDistance / 40),
            transition: !isPulling ? "transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s ease" : "none",
          }}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg border border-primary/20">
            {refreshing ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin" />
            ) : (
              <ArrowDown
                className="h-4.5 w-4.5 transition-transform duration-300"
                style={{
                  transform: `rotate(${pullDistance >= 80 ? 180 : 0}deg)`,
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Slide down app container */}
      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance * 0.35}px)` : "none",
          transition: !isPulling ? "transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)" : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
