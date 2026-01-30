"use client";

import { useTheme } from "@/lib/theme";
import { ThemeMode } from "@/lib/api/preferences";

interface ThemeOption {
  value: ThemeMode;
  label: string;
  icon: React.ReactNode;
}

const SunIcon = () => (
  <svg
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
    />
  </svg>
);

const MonitorIcon = () => (
  <svg
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
    />
  </svg>
);

const MoonIcon = () => (
  <svg
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
    />
  </svg>
);

const themeOptions: ThemeOption[] = [
  { value: "light", label: "Light", icon: <SunIcon /> },
  { value: "system", label: "System", icon: <MonitorIcon /> },
  { value: "dark", label: "Dark", icon: <MoonIcon /> },
];

export function ThemeToggle() {
  const { theme, setTheme, isLoading } = useTheme();

  if (isLoading) {
    return (
      <div className="flex h-9 w-[180px] animate-pulse items-center justify-center rounded-lg bg-[#E8E5EB] dark:bg-[#3D3935]">
        <span className="sr-only">Loading theme...</span>
      </div>
    );
  }

  return (
    <div
      className="inline-flex items-center rounded-lg border border-[#DEDDDB] bg-[#FDFBF7] p-1 dark:border-[#3D3935] dark:bg-[#2A2725]"
      role="radiogroup"
      aria-label="Theme selection"
    >
      {themeOptions.map((option) => {
        const isSelected = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => setTheme(option.value)}
            className={`
              flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200
              ${
                isSelected
                  ? "bg-[#E8A0BF] text-white shadow-sm"
                  : "text-[#A89B86] hover:text-[#4A4543] dark:text-[#B8A99A] dark:hover:text-[#F5F3F0]"
              }
            `}
          >
            {option.icon}
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Compact version for sidebars or smaller spaces
export function ThemeToggleCompact() {
  const { theme, setTheme, isLoading } = useTheme();

  if (isLoading) {
    return (
      <div className="flex h-8 w-24 animate-pulse items-center justify-center rounded-lg bg-[#E8E5EB] dark:bg-[#3D3935]">
        <span className="sr-only">Loading theme...</span>
      </div>
    );
  }

  return (
    <div
      className="inline-flex items-center rounded-lg border border-[#DEDDDB] bg-[#FDFBF7] p-0.5 dark:border-[#3D3935] dark:bg-[#2A2725]"
      role="radiogroup"
      aria-label="Theme selection"
    >
      {themeOptions.map((option) => {
        const isSelected = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={option.label}
            onClick={() => setTheme(option.value)}
            className={`
              flex items-center justify-center rounded-md p-1.5 transition-all duration-200
              ${
                isSelected
                  ? "bg-[#E8A0BF] text-white shadow-sm"
                  : "text-[#A89B86] hover:text-[#4A4543] dark:text-[#B8A99A] dark:hover:text-[#F5F3F0]"
              }
            `}
          >
            {option.icon}
          </button>
        );
      })}
    </div>
  );
}
