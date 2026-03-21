"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-[#0f0f0f] text-[#f0ebe3]">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-sm opacity-60">{error.message}</p>
          <button
            onClick={reset}
            className="rounded px-4 py-2 text-sm border border-white/20 hover:bg-white/10"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
