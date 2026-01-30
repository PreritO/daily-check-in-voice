"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      setIsLoading(false);
      return;
    }

    try {
      const { error: signUpError } = await signUp(email, password, name);
      if (signUpError) {
        setError(signUpError.message);
      } else {
        // Check if email confirmation is required
        // Supabase may auto-confirm or require email verification depending on settings
        setSuccess(true);
        // If auto-confirm is enabled, redirect to onboarding
        setTimeout(() => {
          router.push("/onboarding");
          router.refresh();
        }, 2000);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center">
        <div className="mb-5 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E8F5E9] shadow-sm">
            <svg
              className="h-9 w-9 text-[#A8D5BA]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>
        <h1 className="font-serif text-3xl font-bold text-[#4A4543] dark:text-[#F5F3F0]">
          Account created!
        </h1>
        <p className="mt-3 text-base text-[#A89B86] dark:text-[#B8A99A]">
          Redirecting you to complete setup...
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 text-center">
        <div className="mb-5 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F9E4EC] shadow-sm">
            <svg
              className="h-9 w-9 text-[#E8A0BF]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </div>
        </div>
        <h1 className="font-serif text-3xl font-bold text-[#4A4543] dark:text-[#F5F3F0]">
          Create your Miro account
        </h1>
        <p className="mt-2 text-base text-[#A89B86] dark:text-[#B8A99A]">
          Your daily wellness companion awaits
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-xl border border-[#F5A9A9] bg-[#F5A9A9]/10 p-4 text-base text-[#C77070] dark:border-[#F5A9A9]/50 dark:bg-[#F5A9A9]/5 dark:text-[#F5A9A9]">
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="name"
            className="mb-2 block text-base font-medium text-[#4A4543] dark:text-[#F5F3F0]"
          >
            Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            className="w-full rounded-xl border border-[#DEDDDB] bg-white px-4 py-3 text-base text-[#4A4543] placeholder-[#A89B86] shadow-sm transition-all duration-200 focus:border-[#E8A0BF] focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]/20 dark:border-[#4A4543] dark:bg-[#3D3935] dark:text-[#F5F3F0] dark:placeholder-[#B8A99A]"
            placeholder="Your name"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-base font-medium text-[#4A4543] dark:text-[#F5F3F0]"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full rounded-xl border border-[#DEDDDB] bg-white px-4 py-3 text-base text-[#4A4543] placeholder-[#A89B86] shadow-sm transition-all duration-200 focus:border-[#E8A0BF] focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]/20 dark:border-[#4A4543] dark:bg-[#3D3935] dark:text-[#F5F3F0] dark:placeholder-[#B8A99A]"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-base font-medium text-[#4A4543] dark:text-[#F5F3F0]"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="w-full rounded-xl border border-[#DEDDDB] bg-white px-4 py-3 text-base text-[#4A4543] placeholder-[#A89B86] shadow-sm transition-all duration-200 focus:border-[#E8A0BF] focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]/20 dark:border-[#4A4543] dark:bg-[#3D3935] dark:text-[#F5F3F0] dark:placeholder-[#B8A99A]"
            placeholder="At least 6 characters"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-xl bg-[#E8A0BF] px-6 py-3 text-base font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#D88FAE] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#E8A0BF] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-[#363230]"
        >
          {isLoading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-8 text-center text-base text-[#A89B86] dark:text-[#B8A99A]">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-[#E8A0BF] transition-colors duration-200 hover:text-[#D88FAE]"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
