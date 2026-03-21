import { useState, useEffect } from "react";

/**
 * Returns true only after `delayMs` has passed while `isLoading` is true.
 * Prevents skeleton/loading UI from flashing when data loads quickly.
 */
export function useDeferredLoading(isLoading: boolean, delayMs = 200): boolean {
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    if (!isLoading) return;

    const timer = setTimeout(() => setShowLoading(true), delayMs);
    return () => {
      clearTimeout(timer);
      setShowLoading(false);
    };
  }, [isLoading, delayMs]);

  return isLoading && showLoading;
}
