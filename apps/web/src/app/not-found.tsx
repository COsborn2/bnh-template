import Link from "next/link";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { FaIcon } from "@/components/ui/fa-icon";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      {/* FaIcon (not FontAwesomeIcon): this page is a server component, so
          the Font Awesome svg-core runtime never ships with it. FaIcon keeps
          that ~28KB out of the bundle and sizes the glyph explicitly instead
          of relying on the `.svg-inline--fa` CSS the runtime injects on the
          client. */}
      <FaIcon
        icon={faTriangleExclamation}
        size={40}
        className="text-text-muted"
      />
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-text-muted">Page not found</p>
      <Link href="/" className="text-accent-purple hover:underline">
        Go home
      </Link>
    </div>
  );
}
