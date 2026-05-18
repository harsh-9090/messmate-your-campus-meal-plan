import React from "react";
import { cn } from "@/lib/utils";

interface PwaSplashLoaderProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "fullscreen";
}

const sizeClasses = {
  sm: "h-24 w-24",
  md: "h-48 w-48",
  lg: "h-64 w-64",
  fullscreen: "h-screen w-screen fixed inset-0 z-[9999]",
};

export function PwaSplashLoader({ className, size = "fullscreen" }: PwaSplashLoaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center bg-[#0f172a] select-none pointer-events-none",
        sizeClasses[size],
        className,
      )}
    >
      <div className="flex flex-col items-center justify-center space-y-6">
        <div className="relative">
          {/* Subtle surrounding gold glow rings */}
          <div className="absolute inset-0 rounded-full bg-yellow-500/10 blur-xl animate-pulse scale-110" />
          <div className="absolute -inset-2 rounded-full border border-yellow-500/20 animate-ping opacity-75 [animation-duration:3s]" />
          <div className="absolute -inset-4 rounded-full border border-yellow-500/10 animate-ping opacity-50 [animation-duration:4s]" />

          {/* Premium centered gold circular crest */}
          <img
            src="/apple-touch-icon.png"
            alt="Mom's Kitchen Crest"
            className="relative h-32 w-32 rounded-full object-cover shadow-2xl border-2 border-yellow-500/40 animate-pulse [animation-duration:2s]"
          />
        </div>

        {/* Elegant typography & loading indicator */}
        <div className="flex flex-col items-center space-y-2">
          <h1 className="text-yellow-500/90 font-semibold tracking-widest text-sm uppercase font-display animate-pulse [animation-duration:2.5s]">
            Mom's Kitchen
          </h1>
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-500/40 animate-bounce [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-500/60 animate-bounce [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-500/80 animate-bounce" />
          </div>
        </div>
      </div>
    </div>
  );
}
export default PwaSplashLoader;
