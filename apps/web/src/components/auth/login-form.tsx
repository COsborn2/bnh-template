"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { GoogleSignInButton } from "@/components/ui/google-sign-in-button";
import { Input } from "@/components/ui/input";
import { TurnstileSubmitButton } from "@/components/ui/turnstile-submit-button";

export function LoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const isEmail = identifier.includes("@");
      const fetchOptions = {
        headers: { "x-captcha-response": turnstileToken },
      };

      const { error: signInError } = isEmail
        ? await authClient.signIn.email({
            email: identifier,
            password,
            fetchOptions,
          })
        : await authClient.signIn.username({
            username: identifier,
            password,
            fetchOptions,
          });

      if (signInError) {
        if (signInError.status === 403) {
          router.push(
            "/auth/verify-email?email=" + encodeURIComponent(identifier),
          );
          return;
        }
        setError(signInError.message || "Login failed");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Login failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="text-center">
        <h2 className="font-display text-2xl font-semibold">Welcome back</h2>
        <p className="mt-1 text-sm text-text-muted">Sign in to your account</p>
      </div>

      <Input
        label="Email or username"
        type="text"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        placeholder="you@example.com or janedoe"
        required
        autoComplete="username"
      />
      <Input
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        required
        autoComplete="current-password"
      />

      <div className="-mt-1 flex justify-end">
        <Link
          href="/auth/forgot-password"
          className="text-xs text-text-muted transition-colors hover:text-accent-purple"
        >
          Forgot password?
        </Link>
      </div>

      <TurnstileSubmitButton
        isLoading={isLoading}
        loadingText="Signing in..."
        onToken={setTurnstileToken}
        error={error}
        className="mt-1"
      >
        Sign in
      </TurnstileSubmitButton>

      <div className="relative my-1">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-bg-raised px-3 text-text-faint">or</span>
        </div>
      </div>

      <GoogleSignInButton
        text="Sign in with Google"
        onClick={() => {
          authClient.signIn.social({
            provider: "google",
            callbackURL: "/dashboard",
          });
        }}
      />

      <p className="text-center text-sm text-text-muted">
        Don&apos;t have an account?{" "}
        <Link
          href="/auth/register"
          className="text-accent-purple hover:underline"
        >
          Sign up
        </Link>
      </p>
    </form>
  );
}
