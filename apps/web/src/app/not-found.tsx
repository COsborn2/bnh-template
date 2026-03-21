import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <FontAwesomeIcon icon={faTriangleExclamation} className="h-10 w-10 text-text-muted" />
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-text-muted">Page not found</p>
      <Link href="/" className="text-accent-purple hover:underline">
        Go home
      </Link>
    </div>
  );
}
