"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[pagewise] Screen recovery boundary", error);
  }, [error]);

  return (
    <main className="recovery-screen">
      <div className="recovery-card" role="alert">
        <AlertTriangle size={28} />
        <p className="eyebrow">Pagewise recovery</p>
        <h1>This screen could not be loaded</h1>
        <p>
          Your saved library has not been changed. Try loading this screen
          again, or refresh Pagewise if the problem continues.
        </p>
        <button className="button button-primary" type="button" onClick={reset}>
          <RefreshCw size={16} /> Try again
        </button>
      </div>
    </main>
  );
}
