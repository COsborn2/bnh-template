"use client";

export default function AppAdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">App Admin</h1>
        <p className="text-text-muted">
          This is where you add app-specific admin pages. The admin sidebar and
          layout are ready — just create new pages and add links.
        </p>
      </div>

      <div className="rounded-[var(--radius-xl)] border border-border bg-bg-raised p-6">
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            Create a new page at{" "}
            <code className="bg-bg font-mono text-sm px-1.5 py-0.5 rounded">
              app/admin/your-feature/page.tsx
            </code>
          </li>
          <li>
            Add a nav item to the sidebar in{" "}
            <code className="bg-bg font-mono text-sm px-1.5 py-0.5 rounded">
              app/admin/layout.tsx
            </code>
          </li>
          <li>
            Use the{" "}
            <code className="bg-bg font-mono text-sm px-1.5 py-0.5 rounded">
              DataTable
            </code>{" "}
            component from{" "}
            <code className="bg-bg font-mono text-sm px-1.5 py-0.5 rounded">
              components/ui/data-table
            </code>{" "}
            for listing data
          </li>
        </ol>
      </div>
    </div>
  );
}
