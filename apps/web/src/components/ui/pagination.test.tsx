import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { Pagination, PAGE_SIZE } from "./pagination";

const noop = () => {};

/** Strip the `<!-- -->` markers SSR inserts between adjacent text nodes. */
function render(element: React.ReactElement): string {
  return renderToString(element).replaceAll("<!-- -->", "");
}

/** Count of actually-disabled buttons (the class list also mentions `disabled:`). */
function disabledCount(html: string): number {
  return html.match(/disabled=""/g)?.length ?? 0;
}

describe("Pagination", () => {
  test("pages the admin screens 20 rows at a time", () => {
    expect(PAGE_SIZE).toBe(20);
  });

  test("reports the current window of a multi-page result", () => {
    const html = render(
      <Pagination page={0} total={63} itemLabel="user" onPageChange={noop} />,
    );
    expect(html).toContain("Showing 1-20 of 63 users");
  });

  test("offsets the window by the page index", () => {
    const html = render(
      <Pagination page={2} total={63} itemLabel="user" onPageChange={noop} />,
    );
    expect(html).toContain("Showing 41-60 of 63 users");
  });

  test("clamps the window end to the total on the last page", () => {
    const html = render(
      <Pagination page={3} total={63} itemLabel="user" onPageChange={noop} />,
    );
    expect(html).toContain("Showing 61-63 of 63 users");
  });

  test("shows 0-0 rather than 1-0 when there is nothing to page", () => {
    const html = render(
      <Pagination page={0} total={0} itemLabel="user" onPageChange={noop} />,
    );
    expect(html).toContain("Showing 0-0 of 0 users");
  });

  test("singularises the label for a lone row", () => {
    const html = render(
      <Pagination
        page={0}
        total={1}
        itemLabel="submission"
        onPageChange={noop}
      />,
    );
    expect(html).toContain("Showing 1-1 of 1 submission<");
  });

  test("uses an explicit plural when given one", () => {
    const html = render(
      <Pagination
        page={0}
        total={3}
        itemLabel="entry"
        itemLabelPlural="entries"
        onPageChange={noop}
      />,
    );
    expect(html).toContain("Showing 1-3 of 3 entries");
  });

  test("disables Previous on the first page and Next on the last", () => {
    const first = render(
      <Pagination page={0} total={25} itemLabel="user" onPageChange={noop} />,
    );
    const last = render(
      <Pagination page={1} total={25} itemLabel="user" onPageChange={noop} />,
    );

    expect(disabledCount(first)).toBe(1);
    expect(disabledCount(last)).toBe(1);
    // On page 0 the disabled one is Previous; on the last page it is Next.
    expect(disabledCount(first.split("Previous")[0]!)).toBe(1);
    expect(disabledCount(last.split("Previous")[0]!)).toBe(0);
  });

  test("disables both controls when everything fits on one page", () => {
    const html = render(
      <Pagination page={0} total={5} itemLabel="user" onPageChange={noop} />,
    );
    expect(disabledCount(html)).toBe(2);
  });

  test("honours a custom page size", () => {
    const html = render(
      <Pagination
        page={1}
        total={30}
        pageSize={5}
        itemLabel="user"
        onPageChange={noop}
      />,
    );
    expect(html).toContain("Showing 6-10 of 30 users");
  });
});
