import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { qrApi } from "@/lib/messmate/api";
import { Loader2 } from "lucide-react";

interface Props {
  size?: number;
}

/**
 * Dynamic QR canvas. Fetches a short-lived JWT QR token from the backend
 * every (expiresIn) seconds and renders it as a QR code.
 */
export function QRCanvas({ size = 200 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [secondsLeft, setSecondsLeft] = useState(8);

  const { data, refetch, isError, isLoading } = useQuery({
    queryKey: ["qr-token"],
    queryFn: () => qrApi.token(),
    refetchOnWindowFocus: false,
    staleTime: 0,
    retry: 1,
  });

  // Render + schedule next refresh whenever a new token arrives.
  useEffect(() => {
    if (!data?.token || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, data.token, {
      width: size,
      margin: 1,
      color: { dark: "#1e1b4b", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).catch(() => { });

    const ttl = data.expiresIn || 8;
    setSecondsLeft(ttl);
    const tick = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { refetch(); return ttl; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [data, size, refetch]);

  const ttl = data?.expiresIn || 8;
  const pct = (secondsLeft / ttl) * 100;
  const ring = 2 * Math.PI * 46;
  const offset = ring - (pct / 100) * ring;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="absolute -inset-3 -rotate-90" width={size + 24} height={size + 24} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="46" stroke="currentColor" strokeOpacity="0.1" strokeWidth="2" fill="none" />
        <circle
          cx="50" cy="50" r="46"
          stroke="currentColor" strokeWidth="2" fill="none"
          strokeDasharray={ring} strokeDashoffset={offset} strokeLinecap="round"
          className="text-primary transition-all duration-1000 ease-linear"
        />
      </svg>
      <div className="rounded-2xl bg-white p-3 shadow-glow" style={{ width: size + 24, height: size + 24 }}>
        {isLoading ? (
          <div className="grid h-full w-full place-items-center text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : isError ? (
          <div className="grid h-full w-full place-items-center px-4 text-center text-xs font-medium text-destructive">
            QR unavailable - check backend connection
          </div>
        ) : (
          <canvas ref={canvasRef} width={size} height={size} />
        )}
      </div>
      <div className="absolute -bottom-7 text-xs font-medium text-muted-foreground">
        {isError ? "Offline" : `Refreshes in ${secondsLeft}s`}
      </div>
    </div>
  );
}
