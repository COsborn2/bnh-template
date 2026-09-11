import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { ModalCard } from "./modal";

const noop = () => {};

/** Strip the `<!-- -->` markers SSR inserts between adjacent text nodes. */
function render(element: React.ReactElement): string {
  return renderToString(element).replaceAll("<!-- -->", "");
}

describe("ModalCard", () => {
  test("is a modal dialog labelled by its title", () => {
    const html = render(
      <ModalCard onClose={noop} title="Delete account">
        Body copy
      </ModalCard>,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');

    const titleId = html.match(/aria-labelledby="([^"]+)"/)?.[1];
    expect(titleId).toBeTruthy();
    expect(html).toContain(`<h2 id="${titleId}"`);
    expect(html).toContain(">Delete account</h2>");
    expect(html).toContain("Body copy");
  });

  test("is focusable so focus can move inside it on open", () => {
    const html = render(
      <ModalCard onClose={noop} title="Title">
        x
      </ModalCard>,
    );
    expect(html).toContain('tabindex="-1"');
  });

  test("falls back to aria-label when there is no title", () => {
    const html = render(
      <ModalCard onClose={noop} ariaLabel="Image preview">
        x
      </ModalCard>,
    );
    expect(html).toContain('aria-label="Image preview"');
    expect(html).not.toContain("aria-labelledby");
  });

  test("renders a close button unless persistent", () => {
    const dismissable = render(
      <ModalCard onClose={noop} title="Title">
        x
      </ModalCard>,
    );
    const persistent = render(
      <ModalCard onClose={noop} title="Title" persistent>
        x
      </ModalCard>,
    );
    expect(dismissable).toContain('aria-label="Close"');
    expect(persistent).not.toContain('aria-label="Close"');
  });

  test("renders subtitle and footer slots", () => {
    const html = render(
      <ModalCard
        onClose={noop}
        title="Ban user"
        subtitle="Restrict this user's access."
        footer={<button type="button">Ban</button>}
      >
        x
      </ModalCard>,
    );
    expect(html).toContain("Restrict this user");
    expect(html).toContain(">Ban</button>");
  });
});
