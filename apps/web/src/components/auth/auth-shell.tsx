import { Surface } from "@/components/ui/surface";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "MyApp";

export function AuthShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="inline-block -rotate-2 rounded-[var(--radius-md)] border border-border bg-primary px-4 py-1 font-display text-3xl normal-case text-primary-text shadow-control">
            {appName}
          </h1>
        </div>

        <Surface className="p-8">{children}</Surface>
      </div>
    </div>
  );
}
