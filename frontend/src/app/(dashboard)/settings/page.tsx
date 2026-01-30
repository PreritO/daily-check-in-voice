"use client";

import { useState, useEffect, useCallback, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  useCurrentUserQuery,
  useUpdateUserMutation,
  useDeleteUserMutation,
  isValidE164Phone,
  formatToE164,
} from "@/lib/api/users";
import {
  usePreferencesQuery,
  useUpdatePreferencesMutation,
  type CommunicationStyle,
} from "@/lib/api/preferences";

// =============================================================================
// Common Timezones
// =============================================================================

const COMMON_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Phoenix", label: "Arizona (no DST)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HST)" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris (CET/CEST)" },
  { value: "Europe/Berlin", label: "Berlin (CET/CEST)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
];

// =============================================================================
// Tag Input Component
// =============================================================================

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
}

function TagInput({ value, onChange, placeholder, maxTags = 10 }: TagInputProps) {
  const [inputValue, setInputValue] = useState("");

  const addTag = useCallback(() => {
    const trimmed = inputValue.trim();
    if (trimmed && !value.includes(trimmed) && value.length < maxTags) {
      onChange([...value, trimmed]);
      setInputValue("");
    }
  }, [inputValue, value, onChange, maxTags]);

  const removeTag = useCallback(
    (tagToRemove: string) => {
      onChange(value.filter((tag) => tag !== tagToRemove));
    },
    [value, onChange]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        addTag();
      } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
        removeTag(value[value.length - 1]);
      }
    },
    [addTag, inputValue, value, removeTag]
  );

  return (
    <div className="w-full rounded-xl border border-[#DEDDDB] bg-white px-4 py-3 shadow-sm transition-all duration-200 focus-within:border-[#E8A0BF] focus-within:ring-2 focus-within:ring-[#E8A0BF]/20 dark:border-[#4A4543] dark:bg-[#3D3935]">
      <div className="flex flex-wrap gap-2">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-[#F9E4EC] px-3 py-1 text-sm font-medium text-[#C07A9D] dark:bg-[#E8A0BF]/20 dark:text-[#E8A0BF]"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[#C07A9D] transition-colors duration-200 hover:bg-[#E8A0BF]/30 hover:text-[#4A4543] dark:text-[#E8A0BF] dark:hover:bg-[#E8A0BF]/30 dark:hover:text-[#F5F3F0]"
              aria-label={`Remove ${tag}`}
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addTag}
          placeholder={value.length === 0 ? placeholder : "Add more..."}
          className="flex-1 min-w-[120px] border-0 bg-transparent p-0 text-base text-[#4A4543] placeholder-[#A89B86] focus:outline-none focus:ring-0 dark:text-[#F5F3F0] dark:placeholder-[#B8A99A]"
          disabled={value.length >= maxTags}
        />
      </div>
      {value.length >= maxTags && (
        <p className="mt-2 text-sm text-[#A89B86]">Maximum {maxTags} tags allowed</p>
      )}
    </div>
  );
}

// =============================================================================
// Profile Section
// =============================================================================

function ProfileSection() {
  const { data: user, isLoading, error } = useCurrentUserQuery();
  const updateMutation = useUpdateUserMutation();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize form from user data
  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setPhone(user.phone_number || "");
      setTimezone(user.timezone || "UTC");
    }
  }, [user]);

  const handleSave = async () => {
    setPhoneError(null);
    setSaveSuccess(false);

    // Validate phone if provided
    if (phone) {
      const formatted = formatToE164(phone);
      if (!isValidE164Phone(formatted)) {
        setPhoneError("Please enter a valid phone number (10-15 digits)");
        return;
      }
    }

    try {
      await updateMutation.mutateAsync({
        name,
        email,
        phone_number: phone ? formatToE164(phone) : null,
        timezone,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      // Error handled by mutation
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#4A4543] dark:bg-[#363230]">
        <div className="animate-pulse space-y-5">
          <div className="h-7 w-36 rounded bg-[#E8E5EB] dark:bg-[#3D3935]" />
          <div className="h-12 w-full rounded bg-[#E8E5EB] dark:bg-[#3D3935]" />
          <div className="h-12 w-full rounded bg-[#E8E5EB] dark:bg-[#3D3935]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-[#F5A9A9] bg-[#F5A9A9]/10 p-6 shadow-sm dark:border-[#F5A9A9]/50 dark:bg-[#F5A9A9]/5">
        <div className="flex items-center gap-4">
          <svg className="h-6 w-6 text-[#C77070] dark:text-[#F5A9A9]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 className="font-serif text-lg font-medium text-[#C77070] dark:text-[#F5A9A9]">Failed to load profile</h3>
            <p className="text-base text-[#C77070] dark:text-[#F5A9A9]">Please refresh the page to try again.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#4A4543] dark:bg-[#363230]">
      <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">Profile</h2>
      <p className="mt-1 text-base text-[#A89B86] dark:text-[#B8A99A]">
        Your personal information and contact details.
      </p>

      <div className="mt-6 space-y-5">
        {/* Name */}
        <div>
          <label htmlFor="name" className="mb-2 block text-base font-medium text-[#4A4543] dark:text-[#F5F3F0]">
            Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-[#DEDDDB] bg-white px-4 py-3 text-base text-[#4A4543] placeholder-[#A89B86] shadow-sm transition-all duration-200 focus:border-[#E8A0BF] focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]/20 dark:border-[#4A4543] dark:bg-[#3D3935] dark:text-[#F5F3F0] dark:placeholder-[#B8A99A]"
            placeholder="Your name"
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="mb-2 block text-base font-medium text-[#4A4543] dark:text-[#F5F3F0]">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-[#DEDDDB] bg-white px-4 py-3 text-base text-[#4A4543] placeholder-[#A89B86] shadow-sm transition-all duration-200 focus:border-[#E8A0BF] focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]/20 dark:border-[#4A4543] dark:bg-[#3D3935] dark:text-[#F5F3F0] dark:placeholder-[#B8A99A]"
            placeholder="your@email.com"
          />
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="phone" className="mb-2 block text-base font-medium text-[#4A4543] dark:text-[#F5F3F0]">
            Phone Number
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setPhoneError(null);
            }}
            className={`w-full rounded-xl border px-4 py-3 text-base text-[#4A4543] placeholder-[#A89B86] shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 dark:bg-[#3D3935] dark:text-[#F5F3F0] dark:placeholder-[#B8A99A] ${
              phoneError
                ? "border-[#F5A9A9] focus:border-[#F5A9A9] focus:ring-[#F5A9A9]/20"
                : "border-[#DEDDDB] bg-white focus:border-[#E8A0BF] focus:ring-[#E8A0BF]/20 dark:border-[#4A4543]"
            }`}
            placeholder="+1 (555) 123-4567"
          />
          {phoneError && <p className="mt-2 text-base text-[#F5A9A9]">{phoneError}</p>}
          <p className="mt-2 text-sm text-[#A89B86] dark:text-[#B8A99A]">
            Used for receiving wellness calls
          </p>
        </div>

        {/* Timezone */}
        <div>
          <label htmlFor="timezone" className="mb-2 block text-base font-medium text-[#4A4543] dark:text-[#F5F3F0]">
            Timezone
          </label>
          <select
            id="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full rounded-xl border border-[#DEDDDB] bg-white px-4 py-3 text-base text-[#4A4543] shadow-sm transition-all duration-200 focus:border-[#E8A0BF] focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]/20 dark:border-[#4A4543] dark:bg-[#3D3935] dark:text-[#F5F3F0]"
          >
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-4 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="rounded-xl bg-[#E8A0BF] px-6 py-3 text-base font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#D88FAE] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
          >
            {updateMutation.isPending ? "Saving..." : "Save Profile"}
          </button>
          {saveSuccess && (
            <span className="text-base text-[#A8D5BA]">Profile saved!</span>
          )}
          {updateMutation.isError && (
            <span className="text-base text-[#F5A9A9]">Failed to save. Please try again.</span>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Preferences Section
// =============================================================================

function PreferencesSection() {
  const { data: preferences, isLoading, error } = usePreferencesQuery();
  const updateMutation = useUpdatePreferencesMutation();

  const [topics, setTopics] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [communicationStyle, setCommunicationStyle] = useState<CommunicationStyle>("friendly");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize form from preferences data
  useEffect(() => {
    if (preferences) {
      setTopics(preferences.conversation_topics || []);
      setInterests(preferences.interests || []);
      setCommunicationStyle(preferences.communication_style || "friendly");
    }
  }, [preferences]);

  const handleSave = async () => {
    setSaveSuccess(false);
    try {
      await updateMutation.mutateAsync({
        conversation_topics: topics,
        interests: interests,
        communication_style: communicationStyle,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      // Error handled by mutation
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#4A4543] dark:bg-[#363230]">
        <div className="animate-pulse space-y-5">
          <div className="h-7 w-36 rounded bg-[#E8E5EB] dark:bg-[#3D3935]" />
          <div className="h-12 w-full rounded bg-[#E8E5EB] dark:bg-[#3D3935]" />
          <div className="h-12 w-full rounded bg-[#E8E5EB] dark:bg-[#3D3935]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-[#F5A9A9] bg-[#F5A9A9]/10 p-6 shadow-sm dark:border-[#F5A9A9]/50 dark:bg-[#F5A9A9]/5">
        <div className="flex items-center gap-4">
          <svg className="h-6 w-6 text-[#C77070] dark:text-[#F5A9A9]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 className="font-serif text-lg font-medium text-[#C77070] dark:text-[#F5A9A9]">Failed to load preferences</h3>
            <p className="text-base text-[#C77070] dark:text-[#F5A9A9]">Please refresh the page to try again.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#4A4543] dark:bg-[#363230]">
      <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">Preferences</h2>
      <p className="mt-1 text-base text-[#A89B86] dark:text-[#B8A99A]">
        Customize your wellness experience.
      </p>

      <div className="mt-6 space-y-5">
        {/* Conversation Topics */}
        <div>
          <label className="mb-2 block text-base font-medium text-[#4A4543] dark:text-[#F5F3F0]">
            Conversation Topics
          </label>
          <TagInput
            value={topics}
            onChange={setTopics}
            placeholder="Type topics and press Enter (e.g., work, health, goals)"
          />
          <p className="mt-2 text-sm text-[#A89B86] dark:text-[#B8A99A]">
            Topics you want to discuss during wellness calls
          </p>
        </div>

        {/* Interests */}
        <div>
          <label className="mb-2 block text-base font-medium text-[#4A4543] dark:text-[#F5F3F0]">
            Interests
          </label>
          <TagInput
            value={interests}
            onChange={setInterests}
            placeholder="Type interests and press Enter (e.g., reading, fitness)"
          />
          <p className="mt-2 text-sm text-[#A89B86] dark:text-[#B8A99A]">
            Your interests for more personalized conversations
          </p>
        </div>

        {/* Communication Style */}
        <div>
          <label htmlFor="communication-style" className="mb-2 block text-base font-medium text-[#4A4543] dark:text-[#F5F3F0]">
            Communication Style
          </label>
          <select
            id="communication-style"
            value={communicationStyle}
            onChange={(e) => setCommunicationStyle(e.target.value as CommunicationStyle)}
            className="w-full rounded-xl border border-[#DEDDDB] bg-white px-4 py-3 text-base text-[#4A4543] shadow-sm transition-all duration-200 focus:border-[#E8A0BF] focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]/20 dark:border-[#4A4543] dark:bg-[#3D3935] dark:text-[#F5F3F0]"
          >
            <option value="casual">Casual - Relaxed and conversational</option>
            <option value="friendly">Friendly - Warm and supportive</option>
            <option value="formal">Formal - Professional and structured</option>
          </select>
          <p className="mt-2 text-sm text-[#A89B86] dark:text-[#B8A99A]">
            How you prefer Miro to communicate with you
          </p>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-4 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="rounded-xl bg-[#E8A0BF] px-6 py-3 text-base font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#D88FAE] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
          >
            {updateMutation.isPending ? "Saving..." : "Save Preferences"}
          </button>
          {saveSuccess && (
            <span className="text-base text-[#A8D5BA]">Preferences saved!</span>
          )}
          {updateMutation.isError && (
            <span className="text-base text-[#F5A9A9]">Failed to save. Please try again.</span>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Notifications Section
// =============================================================================

function NotificationsSection() {
  const [slackEnabled, setSlackEnabled] = useState(false);

  return (
    <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#4A4543] dark:bg-[#363230]">
      <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">Notifications</h2>
      <p className="mt-1 text-base text-[#A89B86] dark:text-[#B8A99A]">
        Configure how you receive updates and summaries.
      </p>

      <div className="mt-6 space-y-5">
        {/* Slack Integration Toggle */}
        <div className="flex items-center justify-between rounded-xl border border-[#DEDDDB] bg-[#FDFBF7] p-5 shadow-sm dark:border-[#4A4543] dark:bg-[#3D3935]">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#4A154B]">
              <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-medium text-[#4A4543] dark:text-[#F5F3F0]">
                Slack Integration
              </h3>
              <p className="text-sm text-[#A89B86] dark:text-[#B8A99A]">
                Post wellness summaries to Slack
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSlackEnabled(!slackEnabled)}
            className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#E8A0BF] focus:ring-offset-2 ${
              slackEnabled ? "bg-[#E8A0BF]" : "bg-[#E8E5EB] dark:bg-[#4A4543]"
            }`}
            role="switch"
            aria-checked={slackEnabled}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                slackEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {slackEnabled && (
          <div className="rounded-xl border border-[#F5D89A] bg-[#FFF9E6] p-5 shadow-sm dark:border-[#F5D89A]/50 dark:bg-[#F5D89A]/10">
            <div className="flex items-start gap-4">
              <svg className="h-6 w-6 text-[#B8A060] dark:text-[#F5D89A]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="text-base font-medium text-[#B8A060] dark:text-[#F5D89A]">
                  Configuration Required
                </h4>
                <p className="mt-1 text-base text-[#B8A060] dark:text-[#F5D89A]">
                  Slack integration requires backend configuration. Please contact your administrator
                  to set up the Slack bot token and channel settings.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Danger Zone Section
// =============================================================================

function DangerZoneSection() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { data: user } = useCurrentUserQuery();
  const deleteMutation = useDeleteUserMutation();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const handleDeleteAccount = async () => {
    if (!user || confirmText !== "DELETE") return;

    try {
      await deleteMutation.mutateAsync(user.id);
      await signOut();
      router.push("/login");
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-[#F5A9A9] bg-white p-6 shadow-sm dark:border-[#F5A9A9]/50 dark:bg-[#363230]">
        <h2 className="font-serif text-xl font-semibold text-[#C77070] dark:text-[#F5A9A9]">Danger Zone</h2>
        <p className="mt-1 text-base text-[#A89B86] dark:text-[#B8A99A]">
          Irreversible actions that affect your account.
        </p>

        <div className="mt-6">
          <div className="flex items-center justify-between rounded-xl border border-[#F5A9A9] bg-[#F5A9A9]/10 p-5 dark:border-[#F5A9A9]/50 dark:bg-[#F5A9A9]/5">
            <div>
              <h3 className="text-base font-medium text-[#4A4543] dark:text-[#F5F3F0]">
                Delete Account
              </h3>
              <p className="text-sm text-[#A89B86] dark:text-[#B8A99A]">
                Permanently delete your account and all associated data
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              className="rounded-xl bg-[#C77070] px-6 py-3 text-base font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#B55E5E] hover:shadow-md"
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setShowConfirmModal(false);
              setConfirmText("");
            }}
          />

          {/* Modal */}
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-xl dark:border-[#4A4543] dark:bg-[#363230]">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F5A9A9]/20 dark:bg-[#F5A9A9]/10">
                <svg className="h-6 w-6 text-[#C77070] dark:text-[#F5A9A9]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
                  Delete Account
                </h3>
                <p className="text-base text-[#A89B86] dark:text-[#B8A99A]">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="mt-5">
              <p className="text-base text-[#4A4543] dark:text-[#F5F3F0]">
                This will permanently delete your account, including:
              </p>
              <ul className="mt-3 list-inside list-disc text-base text-[#A89B86] dark:text-[#B8A99A]">
                <li>All call history and transcripts</li>
                <li>Scheduled calls and preferences</li>
                <li>Summaries and analytics data</li>
              </ul>
            </div>

            <div className="mt-5">
              <label htmlFor="confirm-delete" className="mb-2 block text-base font-medium text-[#4A4543] dark:text-[#F5F3F0]">
                Type <span className="font-mono text-[#C77070] dark:text-[#F5A9A9]">DELETE</span> to confirm
              </label>
              <input
                id="confirm-delete"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full rounded-xl border border-[#DEDDDB] bg-white px-4 py-3 text-base text-[#4A4543] placeholder-[#A89B86] shadow-sm transition-all duration-200 focus:border-[#F5A9A9] focus:outline-none focus:ring-2 focus:ring-[#F5A9A9]/20 dark:border-[#4A4543] dark:bg-[#3D3935] dark:text-[#F5F3F0] dark:placeholder-[#B8A99A]"
                placeholder="DELETE"
              />
            </div>

            <div className="mt-6 flex gap-4">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmText("");
                }}
                className="flex-1 rounded-xl border border-[#DEDDDB] px-6 py-3 text-base font-medium text-[#4A4543] shadow-sm transition-all duration-200 hover:bg-[#E8E5EB] hover:shadow-md dark:border-[#4A4543] dark:text-[#F5F3F0] dark:hover:bg-[#3D3935]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={confirmText !== "DELETE" || deleteMutation.isPending}
                className="flex-1 rounded-xl bg-[#C77070] px-6 py-3 text-base font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#B55E5E] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete Account"}
              </button>
            </div>

            {deleteMutation.isError && (
              <p className="mt-4 text-base text-[#F5A9A9]">
                Failed to delete account. Please try again.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// =============================================================================
// Main Settings Page
// =============================================================================

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">Settings</h1>

      <ProfileSection />
      <PreferencesSection />
      <NotificationsSection />
      <DangerZoneSection />
    </div>
  );
}
