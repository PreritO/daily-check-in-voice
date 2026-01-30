"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { ThemeToggleCompact } from "@/components/ThemeToggle";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    href: "/",
    label: "Home",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/calls",
    label: "Call History",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    href: "/schedule",
    label: "Schedule",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

function NavLink({ item, isCollapsed }: { item: NavItem; isCollapsed: boolean }) {
  const pathname = usePathname();
  const isActive = pathname === item.href;

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      title={isCollapsed ? item.label : undefined}
      className={`flex items-center gap-4 rounded-xl px-4 py-3 text-base font-medium transition-all duration-200 ${
        isActive
          ? "bg-[#F9E4EC] text-[#4A4543] shadow-sm dark:bg-[#E8A0BF]/20 dark:text-[#F5F3F0]"
          : "text-[#A89B86] hover:bg-[#E8E5EB] hover:text-[#4A4543] hover:shadow-sm dark:text-[#B8A99A] dark:hover:bg-[#3D3935] dark:hover:text-[#F5F3F0]"
      } ${isCollapsed ? "justify-center px-3" : ""}`}
    >
      <span className="flex-shrink-0">{item.icon}</span>
      {!isCollapsed && (
        <span className="sidebar-text-transition whitespace-nowrap">{item.label}</span>
      )}
    </Link>
  );
}

function CollapseButton({
  isCollapsed,
  onClick,
}: {
  isCollapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-[#A89B86] transition-all duration-200 hover:bg-[#E8E5EB] hover:text-[#4A4543] dark:text-[#B8A99A] dark:hover:bg-[#3D3935] dark:hover:text-[#F5F3F0]"
      aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      <svg
        className={`h-5 w-5 transition-transform duration-300 ${isCollapsed ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
      </svg>
    </button>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, signOut, isLoading } = useAuth();
  const router = useRouter();

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored !== null) {
      setIsCollapsed(stored === "true");
    }
  }, []);

  // Save collapsed state to localStorage
  const toggleCollapsed = () => {
    const newValue = !isCollapsed;
    setIsCollapsed(newValue);
    localStorage.setItem("sidebar-collapsed", String(newValue));
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="ambient-bg flex h-screen overflow-hidden">
      {/* Mobile menu backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - fixed position, full height, never scrolls with content */}
      <aside
        className={`sidebar-transition fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[#DEDDDB] bg-white/95 backdrop-blur-sm dark:border-[#3D3935] dark:bg-[#363230]/95 ${
          isCollapsed ? "w-20" : "w-64"
        } ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      >
        {/* Sidebar header */}
        <div className={`flex h-20 flex-shrink-0 items-center border-b border-[#DEDDDB] dark:border-[#3D3935] ${isCollapsed ? "justify-center px-2" : "justify-between px-5"}`}>
          <div className={`flex items-center gap-3 ${isCollapsed ? "justify-center" : ""}`}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F9E4EC] shadow-sm dark:bg-[#E8A0BF]/20">
              <svg className="h-6 w-6 text-[#E8A0BF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            {!isCollapsed && (
              <span className="sidebar-text-transition font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
                Miro
              </span>
            )}
          </div>
          {!isCollapsed && (
            <div className="hidden lg:block">
              <CollapseButton isCollapsed={isCollapsed} onClick={toggleCollapsed} />
            </div>
          )}
        </div>

        {/* Collapse button when collapsed (centered) */}
        {isCollapsed && (
          <div className="hidden flex-shrink-0 justify-center py-4 lg:flex">
            <CollapseButton isCollapsed={isCollapsed} onClick={toggleCollapsed} />
          </div>
        )}

        {/* Navigation - takes available space, can scroll if needed */}
        <nav className={`flex-1 space-y-2 overflow-y-auto p-4 ${isCollapsed ? "px-2" : "px-4"}`} aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} isCollapsed={isCollapsed} />
          ))}
        </nav>

        {/* Footer - Theme Toggle + User section */}
        <div className={`flex-shrink-0 border-t border-[#DEDDDB] p-4 dark:border-[#3D3935] ${isCollapsed ? "px-2" : "px-4"} space-y-4`}>
          {/* Theme Toggle */}
          <div className={`${isCollapsed ? "flex justify-center" : ""}`}>
            <ThemeToggleCompact />
          </div>

          {/* User section */}
          {isLoading ? (
            <div className="animate-pulse">
              <div className={`h-4 rounded bg-[#E8E5EB] dark:bg-[#3D3935] ${isCollapsed ? "w-10 mx-auto" : "w-32"}`} />
            </div>
          ) : user ? (
            <div className={`space-y-3 ${isCollapsed ? "flex flex-col items-center" : ""}`}>
              {!isCollapsed && (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8F5E9] shadow-sm dark:bg-[#A8D5BA]/20">
                    <svg
                      className="h-5 w-5 text-[#A8D5BA]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium text-[#4A4543] dark:text-[#F5F3F0]">
                      {user.user_metadata?.name || "User"}
                    </p>
                    <p className="truncate text-sm text-[#A89B86] dark:text-[#B8A99A]">
                      {user.email}
                    </p>
                  </div>
                </div>
              )}
              <button
                onClick={handleSignOut}
                title={isCollapsed ? "Sign out" : undefined}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-base text-[#A89B86] transition-all duration-200 hover:bg-[#E8E5EB] hover:text-[#4A4543] dark:text-[#B8A99A] dark:hover:bg-[#3D3935] dark:hover:text-[#F5F3F0] ${isCollapsed ? "justify-center w-full px-3" : "w-full"}`}
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                {!isCollapsed && <span>Sign out</span>}
              </button>
            </div>
          ) : null}
        </div>

        {/* Close button for mobile */}
        <button
          className="absolute right-4 top-6 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-label="Close navigation menu"
        >
          <svg className="h-6 w-6 text-[#A89B86]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </aside>

      {/* Main content area - scrolls independently */}
      <div className={`flex flex-1 flex-col transition-all duration-300 ${isCollapsed ? "lg:ml-20" : "lg:ml-64"}`}>
        {/* Mobile header */}
        <header className="sticky top-0 z-20 flex h-20 flex-shrink-0 items-center gap-4 border-b border-[#DEDDDB] bg-white/95 px-6 backdrop-blur-sm dark:border-[#3D3935] dark:bg-[#363230]/95 lg:hidden">
          <button
            className="text-[#A89B86] transition-colors duration-200 hover:text-[#4A4543] dark:text-[#B8A99A] dark:hover:text-[#F5F3F0]"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={isMobileMenuOpen}
          >
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F9E4EC] shadow-sm dark:bg-[#E8A0BF]/20">
              <svg className="h-6 w-6 text-[#E8A0BF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <span className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
              Miro
            </span>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
