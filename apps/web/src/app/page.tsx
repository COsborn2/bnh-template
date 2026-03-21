import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">MyApp</h1>
        <p className="mt-2 text-text-muted">Your starter template is running.</p>
        <Link href="/auth/login" className="mt-4 inline-block text-accent-purple hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}
