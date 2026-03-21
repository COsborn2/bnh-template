"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { GoogleSignInButton } from "@/components/ui/google-sign-in-button";
import { Input } from "@/components/ui/input";
import { TurnstileSubmitButton } from "@/components/ui/turnstile-submit-button";
import { UsernameInput } from "@/components/ui/username-input";
import {
  PasswordRequirements,
  passwordMeetsRequirements,
} from "@/components/ui/password-strength-bar";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (usernameStatus === "taken") {
      setError("That username is already taken");
      return;
    }

    if (!passwordMeetsRequirements(password)) {
      setError("Password does not meet the requirements");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      const { error: signUpError } = await authClient.signUp.email({
        name,
        username,
        email,
        password,
        fetchOptions: {
          headers: { "x-captcha-response": turnstileToken },
        },
      });

      if (signUpError) {
        setError(signUpError.message || "Registration failed");
        return;
      }

      router.push("/auth/verify-email?email=" + encodeURIComponent(email));
    } catch {
      setError("Registration failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="text-center">
        <h2 className="font-display text-2xl font-semibold">
          Create an account
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Get started in just a few steps
        </p>
      </div>

      <Input
        label="Name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Jane Doe"
        required
        autoComplete="name"
      />
      <UsernameInput
        value={username}
        onChange={setUsername}
        required
        onAvailabilityChange={setUsernameStatus}
      />
      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        required
        autoComplete="email"
      />
      <Input
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        required
        autoComplete="new-password"
      />
      <PasswordRequirements password={password} />
      <Input
        label="Confirm password"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="••••••••"
        required
        autoComplete="new-password"
        error={confirmPassword && password !== confirmPassword ? "Passwords do not match" : undefined}
      />

      <TurnstileSubmitButton
        isLoading={isLoading}
        loadingText="Creating account..."
        onToken={setTurnstileToken}
        error={error}
        className="mt-1"
      >
        Create account
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
        text="Sign up with Google"
        onClick={() => {
          authClient.signIn.social({
            provider: "google",
            callbackURL: "/dashboard",
          });
        }}
      />

      <p className="text-center text-sm text-text-muted">
        Already have an account?{" "}
        <Link
          href="/auth/login"
          className="text-accent-purple hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
