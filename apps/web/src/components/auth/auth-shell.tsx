const appName = process.env.NEXT_PUBLIC_APP_NAME || "MyApp";

export function AuthShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-purple/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-bold text-text">
            {appName}
          </h1>
        </div>

        <div className="rounded-[var(--radius-xl)] border border-border bg-bg-raised p-8 shadow-2xl">
          {children}
        </div>
      </div>
    </div>
  );
}
