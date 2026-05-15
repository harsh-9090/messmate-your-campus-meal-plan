import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

interface Props {
  payload: string; // memberId for demo
  size?: number;
  refreshSeconds?: number;
}

/**
 * Dynamic QR canvas. Generates a fresh "token" every N seconds to mirror
 * the backend JWT-with-nonce behavior. In demo mode the encoded value is
 * `MID|nonce|exp` — backend will instead sign a real JWT.
 */
export function QRCanvas({ payload, size = 200, refreshSeconds = 8 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [secondsLeft, setSecondsLeft] = useState(refreshSeconds);

  useEffect(() => {
    let mounted = true;

    const draw = () => {
      const nonce = Math.random().toString(36).slice(2, 10);
      const exp = Date.now() + refreshSeconds * 1000;
      const token = `${payload}|${nonce}|${exp}`;
      if (canvasRef.current) {
        QRCode.toCanvas(canvasRef.current, token, {
          width: size,
          margin: 1,
          color: { dark: "#1e1b4b", light: "#ffffff" },
          errorCorrectionLevel: "M",
        }).catch(() => {});
      }
      if (mounted) setSecondsLeft(refreshSeconds);
    };

    draw();
    const tick = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { draw(); return refreshSeconds; }
        return s - 1;
      });
    }, 1000);

    return () => { mounted = false; clearInterval(tick); };
  }, [payload, refreshSeconds, size]);

  const pct = (secondsLeft / refreshSeconds) * 100;
  const ring = 2 * Math.PI * 46;
  const offset = ring - (pct / 100) * ring;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        className="absolute -inset-3 -rotate-90"
        width={size + 24}
        height={size + 24}
        viewBox="0 0 100 100"
      >
        <circle cx="50" cy="50" r="46" stroke="currentColor" strokeOpacity="0.1" strokeWidth="2" fill="none" />
        <circle
          cx="50" cy="50" r="46"
          stroke="currentColor" strokeWidth="2" fill="none"
          strokeDasharray={ring}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-primary transition-all duration-1000 ease-linear"
        />
      </svg>
      <div className="rounded-2xl bg-white p-3 shadow-glow">
        <canvas ref={canvasRef} width={size} height={size} />
      </div>
      <div className="absolute -bottom-7 text-xs font-medium text-muted-foreground">
        Refreshes in {secondsLeft}s
      </div>
    </div>
  );
}
