import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const BASE_URL =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_URL) ||
  "http://localhost:4000/api/v1";

export function useSSE() {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Initialize SSE Connection
    const sse = new EventSource(`${BASE_URL}/stream`);
    eventSourceRef.current = sse;

    sse.onopen = () => {
      console.log("SSE Connection established.");
    };

    // Listen for member_created events
    sse.addEventListener("member_created", (e) => {
      console.log("Real-time event received:", e.data);
      
      // Invalidate the members query to trigger a fresh fetch
      queryClient.invalidateQueries({ queryKey: ["members"] });
      
      // Optional: Show a subtle notification
      toast("A new member registration was received!", {
        description: "The member list has been updated automatically.",
      });
    });

    sse.onerror = (err) => {
      console.error("SSE Error:", err);
      // EventSource automatically attempts to reconnect on error.
    };

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        console.log("SSE Connection closed.");
      }
    };
  }, [queryClient]);
}
