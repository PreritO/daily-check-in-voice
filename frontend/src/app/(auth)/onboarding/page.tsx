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
    <div className="space-y-5">
      <div className="text-center mb-8">
        <h2 className="font-serif text-2xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
          Welcome! Let us get to know you
        </h2>
        <p className="mt-2 text-base text-[#A89B86] dark:text-[#B8A99A]">
          Enter your name and phone number for daily wellness calls
        </p>
      </div>

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
          value={data.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="w-full rounded-xl border border-[#DEDDDB] bg-white px-4 py-3 text-base text-[#4A4543] placeholder-[#A89B86] shadow-sm transition-all duration-200 focus:border-[#E8A0BF] focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]/20 dark:border-[#4A4543] dark:bg-[#3D3935] dark:text-[#F5F3F0] dark:placeholder-[#B8A99A]"
          placeholder="Your name"
        />
        {errors.name && (
          <p className="mt-2 text-base text-[#F5A9A9]">{errors.name}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="phoneNumber"
          className="mb-2 block text-base font-medium text-[#4A4543] dark:text-[#F5F3F0]"
        >
          Phone Number
        </label>
        <input
          id="phoneNumber"
          type="tel"
          value={data.phoneNumber}
          onChange={(e) => onUpdate({ phoneNumber: e.target.value })}
          className="w-full rounded-xl border border-[#DEDDDB] bg-white px-4 py-3 text-base text-[#4A4543] placeholder-[#A89B86] shadow-sm transition-all duration-200 focus:border-[#E8A0BF] focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]/20 dark:border-[#4A4543] dark:bg-[#3D3935] dark:text-[#F5F3F0] dark:placeholder-[#B8A99A]"
          placeholder="+12025551234"
        />
        <p className="mt-2 text-sm text-[#A89B86] dark:text-[#B8A99A]">
          E.164 format: +[country code][number] (e.g., +12025551234)
        </p>
        {errors.phoneNumber && (
          <p className="mt-2 text-base text-[#F5A9A9]">{errors.phoneNumber}</p>
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
    <div className="space-y-5">
      <div className="text-center mb-8">
        <h2 className="font-serif text-2xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
          Select Your Timezone
        </h2>
        <p className="mt-2 text-base text-[#A89B86] dark:text-[#B8A99A]">
          We will schedule your wellness calls based on your local time
        </p>
      </div>

      <div>
        <label
          htmlFor="timezone"
          className="mb-2 block text-base font-medium text-[#4A4543] dark:text-[#F5F3F0]"
        >
          Timezone
        </label>
        <select
          id="timezone"
          value={data.timezone}
          onChange={(e) => onUpdate({ timezone: e.target.value })}
          className="w-full rounded-xl border border-[#DEDDDB] bg-white px-4 py-3 text-base text-[#4A4543] shadow-sm transition-all duration-200 focus:border-[#E8A0BF] focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]/20 dark:border-[#4A4543] dark:bg-[#3D3935] dark:text-[#F5F3F0]"
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
    <div className="space-y-5">
      <div className="text-center mb-8">
        <h2 className="font-serif text-2xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
          Set Your First Call Schedule
        </h2>
        <p className="mt-2 text-base text-[#A89B86] dark:text-[#B8A99A]">
          Choose when you would like to receive your daily wellness calls
        </p>
      </div>

      <div>
        <label
          htmlFor="scheduleTime"
          className="mb-2 block text-base font-medium text-[#4A4543] dark:text-[#F5F3F0]"
        >
          Call Time
        </label>
        <input
          id="scheduleTime"
          type="time"
          value={data.scheduleTime}
          onChange={(e) => onUpdate({ scheduleTime: e.target.value })}
          className="w-full rounded-xl border border-[#DEDDDB] bg-white px-4 py-3 text-base text-[#4A4543] shadow-sm transition-all duration-200 focus:border-[#E8A0BF] focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]/20 dark:border-[#4A4543] dark:bg-[#3D3935] dark:text-[#F5F3F0]"
        />
      </div>

      <div>
        <label className="mb-3 block text-base font-medium text-[#4A4543] dark:text-[#F5F3F0]">
          Days of the Week
        </label>
        <div className="flex flex-wrap gap-3">
          {WEEKDAYS.map((day) => (
            <button
              key={day.value}
              type="button"
              onClick={() => toggleDay(day.value)}
              className={`rounded-xl px-4 py-3 text-base font-medium shadow-sm transition-all duration-200 ${
                data.scheduleDays.includes(day.value)
                  ? "bg-[#E8A0BF] text-white hover:bg-[#D88FAE]"
                  : "bg-[#E8E5EB] text-[#4A4543] hover:bg-[#DEDDDB] dark:bg-[#3D3935] dark:text-[#B8A99A] dark:hover:bg-[#4A4543]"
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
        {errors.schedule && (
          <p className="mt-3 text-base text-[#F5A9A9]">{errors.schedule}</p>
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
    <div className="mb-10">
      <div className="flex items-center justify-center">
        {STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full text-base font-medium shadow-sm transition-all duration-200 ${
                step.id < currentStep
                  ? "bg-[#A8D5BA] text-white"
                  : step.id === currentStep
                    ? "bg-[#E8A0BF] text-white"
                    : "bg-[#E8E5EB] text-[#A89B86] dark:bg-[#3D3935] dark:text-[#B8A99A]"
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
                className={`mx-3 h-1 w-16 rounded-full transition-all duration-200 ${
                  step.id < currentStep
                    ? "bg-[#A8D5BA]"
                    : "bg-[#E8E5EB] dark:bg-[#3D3935]"
                }`}
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-center">
        <p className="text-base text-[#A89B86] dark:text-[#B8A99A]">
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
      <div className="flex items-center justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#E8E5EB] border-t-[#E8A0BF]" />
      </div>
    );
  }

  return (
    <div className="w-full">
      <StepIndicator currentStep={currentStep} />

      {error && (
        <div className="mb-5 rounded-xl border border-[#F5A9A9] bg-[#F5A9A9]/10 p-4 text-base text-[#C77070] dark:border-[#F5A9A9]/50 dark:bg-[#F5A9A9]/5 dark:text-[#F5A9A9]">
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

      <div className="mt-10 flex justify-between">
        <button
          type="button"
          onClick={handleBack}
          disabled={currentStep === 1}
          className="rounded-xl px-6 py-3 text-base font-medium text-[#A89B86] transition-all duration-200 hover:text-[#4A4543] disabled:invisible dark:text-[#B8A99A] dark:hover:text-[#F5F3F0]"
        >
          Back
        </button>

        {currentStep < 3 ? (
          <button
            type="button"
            onClick={handleNext}
            className="rounded-xl bg-[#E8A0BF] px-8 py-3 text-base font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#D88FAE] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#E8A0BF] focus:ring-offset-2 dark:focus:ring-offset-[#363230]"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={handleComplete}
            disabled={isSubmitting}
            className="rounded-xl bg-[#E8A0BF] px-8 py-3 text-base font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#D88FAE] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#E8A0BF] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-[#363230]"
          >
            {isSubmitting ? "Setting up..." : "Complete Setup"}
          </button>
        )}
      </div>
    </div>
  );
}
