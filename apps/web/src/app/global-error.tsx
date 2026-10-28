"use client";

// This boundary replaces the root layout, so the theme's tokens are not
// guaranteed to be present. The literal colors mirror the light palette in
// theme.css.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-[#fff7e8] p-4 text-black">
        <div className="max-w-md space-y-4 border-2 border-black bg-white p-8 text-center shadow-[4px_4px_0_#000]">
          <h1 className="text-2xl font-bold uppercase tracking-tight">Something went wrong</h1>
          <p className="text-sm text-[#3d3a35]">
            {error.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={reset}
            className="rounded-[4px] border-2 border-black bg-[#ffdc58] px-4 py-2 text-sm font-bold shadow-[3px_3px_0_#000] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
