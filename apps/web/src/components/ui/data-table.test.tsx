import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { DataTable } from "./data-table";

interface Row {
  id: string;
  name: string;
}

const columns = [
  { key: "name", header: "Name", render: (row: Row) => row.name },
];

describe("DataTable", () => {
  test("scrolls wide tables inside their own container", () => {
    const html = renderToString(
      <DataTable columns={columns} data={[{ id: "1", name: "Ada" }]} />,
    );

    // The wrapper scrolls horizontally instead of clipping the right-hand
    // columns on narrow viewports; the table keeps a usable minimum width.
    expect(html).toMatch(/<div class="[^"]*overflow-x-auto[^"]*">/);
    expect(html).not.toContain("overflow-hidden");
    expect(html).toContain("min-w-[720px]");
    expect(html).toContain("Ada");
  });

  test("renders the empty message when there are no rows", () => {
    const html = renderToString(
      <DataTable columns={columns} data={[]} emptyMessage="Nobody here." />,
    );
    expect(html).toContain("Nobody here.");
  });
});
