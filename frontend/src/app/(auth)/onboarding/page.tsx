"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUpdateUserMutation, isValidE164Phone, formatToE164 } from "@/lib/api/users";
import { useCreateScheduleMutation, buildCronExpression, WEEKDAYS } from "@/lib/api/schedules";
import { useAuth } from "@/lib/auth";
import axios from "axios";

// =============================================================================
// Types
// =============================================================================

interface OnboardingData {
  name: string;
  phoneNumber: string;
  timezone: string;
  scheduleTime: string;
  scheduleDays: string[];
}

// =============================================================================
// Constants
// =============================================================================

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (America/New_York)" },
  { value: "America/Chicago", label: "Central Time (America/Chicago)" },
  { value: "America/Denver", label: "Mountain Time (America/Denver)" },
  { value: "America/Los_Angeles", label: "Pacific Time (America/Los_Angeles)" },
  { value: "America/Phoenix", label: "Arizona (America/Phoenix)" },
  { value: "Europe/London", label: "London (Europe/London)" },
  { value: "Europe/Paris", label: "Paris (Europe/Paris)" },
  { value: "Asia/Tokyo", label: "Tokyo (Asia/Tokyo)" },
  { value: "Asia/Shanghai", label: "Shanghai (Asia/Shanghai)" },
  { value: "Australia/Sydney", label: "Sydney (Australia/Sydney)" },
  { value: "Pacific/Honolulu", label: "Hawaii (Pacific/Honolulu)" },
] as const;

const STEPS = [
  { id: 1, name: "Profile", description: "Your name and phone" },
  { id: 2, name: "Timezone", description: "Select your timezone" },
  { id: 3, name: "Schedule", description: "Set your first call" },
] as const;

// =============================================================================
// Step Components
// =============================================================================

interface ProfileStepProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
  errors: { name?: string; phoneNumber?: string };
}

function ProfileStep({ data, onUpdate, errors }: ProfileStepProps) {
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Welcome! Let us get to know you
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Enter your name and phone number for daily check-in calls
        </p>
      </div>

      <div>
        <label
          htmlFor="name"
          className="mb-1 block text-sm font-medium text-zinc-900 dark:text-zinc-50"
        >
          Name
        </label>
        <input
          id="name"
          type="text"
          value={data.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-500"
          placeholder="Your name"
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-500">{errors.name}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="phoneNumber"
          className="mb-1 block text-sm font-medium text-zinc-900 dark:text-zinc-50"
        >
          Phone Number
        </label>
        <input
          id="phoneNumber"
          type="tel"
          value={data.phoneNumber}
          onChange={(e) => onUpdate({ phoneNumber: e.target.value })}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-500"
          placeholder="+12025551234"
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          E.164 format: +[country code][number] (e.g., +12025551234)
        </p>
        {errors.phoneNumber && (
          <p className="mt-1 text-sm text-red-500">{errors.phoneNumber}</p>
        )}
      </div>
    </div>
  );
}

interface TimezoneStepProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

function TimezoneStep({ data, onUpdate }: TimezoneStepProps) {
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Select Your Timezone
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          We will schedule your check-in calls based on your local time
        </p>
      </div>

      <div>
        <label
          htmlFor="timezone"
          className="mb-1 block text-sm font-medium text-zinc-900 dark:text-zinc-50"
        >
          Timezone
        </label>
        <select
          id="timezone"
          value={data.timezone}
          onChange={(e) => onUpdate({ timezone: e.target.value })}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

interface ScheduleStepProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
  errors: { schedule?: string };
}

function ScheduleStep({ data, onUpdate, errors }: ScheduleStepProps) {
  const toggleDay = (dayValue: string) => {
    const currentDays = data.scheduleDays;
    if (currentDays.includes(dayValue)) {
      onUpdate({ scheduleDays: currentDays.filter((d) => d !== dayValue) });
    } else {
      onUpdate({ scheduleDays: [...currentDays, dayValue] });
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Set Your First Call Schedule
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Choose when you would like to receive your daily check-in calls
        </p>
      </div>

      <div>
        <label
          htmlFor="scheduleTime"
          className="mb-1 block text-sm font-medium text-zinc-900 dark:text-zinc-50"
        >
          Call Time
        </label>
        <input
          id="scheduleTime"
          type="time"
          value={data.scheduleTime}
          onChange={(e) => onUpdate({ scheduleTime: e.target.value })}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Days of the Week
        </label>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => (
            <button
              key={day.value}
              type="button"
              onClick={() => toggleDay(day.value)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                data.scheduleDays.includes(day.value)
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
        {errors.schedule && (
          <p className="mt-2 text-sm text-red-500">{errors.schedule}</p>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Step Indicator
// =============================================================================

interface StepIndicatorProps {
  currentStep: number;
}

function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-center">
        {STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                step.id < currentStep
                  ? "bg-blue-600 text-white"
                  : step.id === currentStep
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
              }`}
            >
              {step.id < currentStep ? (
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                step.id
              )}
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={`mx-2 h-0.5 w-12 ${
                  step.id < currentStep
                    ? "bg-blue-600"
                    : "bg-zinc-200 dark:bg-zinc-700"
                }`}
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-center">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1].name}
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// Main Onboarding Page
// =============================================================================

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const updateUserMutation = useUpdateUserMutation();
  const createScheduleMutation = useCreateScheduleMutation();

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{
    name?: string;
    phoneNumber?: string;
    schedule?: string;
  }>({});

  const [data, setData] = useState<OnboardingData>({
    name: "",
    phoneNumber: "",
    timezone: "America/New_York",
    scheduleTime: "09:00",
    scheduleDays: ["1", "2", "3", "4", "5"], // Mon-Fri by default
  });

  // Update name from user metadata when auth loads
  useEffect(() => {
    if (user?.user_metadata?.name && !data.name) {
      setData((prev) => ({ ...prev, name: user.user_metadata?.name || "" }));
    }
  }, [user?.user_metadata?.name, data.name]);

  const updateData = (updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }));
    // Clear errors for updated fields
    const clearedErrors = { ...errors };
    Object.keys(updates).forEach((key) => {
      if (key === "name") clearedErrors.name = undefined;
      if (key === "phoneNumber") clearedErrors.phoneNumber = undefined;
      if (key === "scheduleDays") clearedErrors.schedule = undefined;
    });
    setErrors(clearedErrors);
  };

  const validateStep = (step: number): boolean => {
    const newErrors: typeof errors = {};

    if (step === 1) {
      if (!data.name.trim()) {
        newErrors.name = "Name is required";
      }
      if (!data.phoneNumber.trim()) {
        newErrors.phoneNumber = "Phone number is required";
      } else if (!isValidE164Phone(data.phoneNumber.replace(/\D/g, ""))) {
        newErrors.phoneNumber = "Please enter a valid phone number (10-15 digits)";
      }
    }

    if (step === 3) {
      if (data.scheduleDays.length === 0) {
        newErrors.schedule = "Please select at least one day";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 3));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleComplete = async () => {
    if (!validateStep(3)) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Step 1: Update user profile
      const formattedPhone = formatToE164(data.phoneNumber);
      const userResponse = await updateUserMutation.mutateAsync({
        name: data.name.trim(),
        phone_number: formattedPhone,
        timezone: data.timezone,
      });

      // Step 2: Create schedule
      const [hours, minutes] = data.scheduleTime.split(":").map(Number);
      const cronExpression = buildCronExpression(hours, minutes, data.scheduleDays);

      await createScheduleMutation.mutateAsync({
        user_id: userResponse.id,
        cron_expression: cronExpression,
        enabled: true,
      });

      // Redirect to dashboard (root route)
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Onboarding error:", err);
      // Extract specific error message from API response
      if (axios.isAxiosError(err) && err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading state while auth is initializing
  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="w-full">
      <StepIndicator currentStep={currentStep} />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {currentStep === 1 && (
        <ProfileStep data={data} onUpdate={updateData} errors={errors} />
      )}
      {currentStep === 2 && (
        <TimezoneStep data={data} onUpdate={updateData} />
      )}
      {currentStep === 3 && (
        <ScheduleStep data={data} onUpdate={updateData} errors={errors} />
      )}

      <div className="mt-8 flex justify-between">
        <button
          type="button"
          onClick={handleBack}
          disabled={currentStep === 1}
          className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 disabled:invisible dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          Back
        </button>

        {currentStep < 3 ? (
          <button
            type="button"
            onClick={handleNext}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={handleComplete}
            disabled={isSubmitting}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-zinc-900"
          >
            {isSubmitting ? "Setting up..." : "Complete Setup"}
          </button>
        )}
      </div>
    </div>
  );
}
