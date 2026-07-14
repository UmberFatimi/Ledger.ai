"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import type { CurrentUser } from "@/lib/types";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/transfer", label: "Send Money" },
  { href: "/transactions", label: "Transactions" },
];

export function NavBar({ user }: { user: CurrentUser | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (pathname === "/login") return null;

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/60 backdrop-blur-md dark:border-white/5 dark:bg-black/50">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link
            href={"/"}
            className="transition-transform hover:scale-[1.03] active:scale-[0.98]"
          >
            <div className="flex items-center justify-center gap-2 font-semibold tracking-tight">
              <Image
                src="/ledger-logo.svg"
                alt="Ledger logo"
                width={28}
                height={28}
                className="sm:h-[30px] sm:w-[30px]"
              />
              <span className="text-sm sm:text-base">Ledger.ai</span>
            </div>
          </Link>

          {/* Desktop nav links */}
          {user && (
            <nav className="hidden gap-4 text-sm md:flex">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative pb-1 after:absolute after:-bottom-[1px] after:left-0 after:h-0.5 after:bg-black after:transition-all after:duration-200 dark:after:bg-white ${
                    pathname === link.href
                      ? "font-medium text-black after:w-full dark:text-white"
                      : "text-zinc-500 after:w-0 hover:text-black hover:after:w-full dark:text-zinc-400 dark:hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        {/* Desktop user info + logout */}
        {user && (
          <div className="hidden items-center gap-4 text-sm md:flex">
            <span className="max-w-[140px] truncate text-zinc-500 dark:text-zinc-400">
              {user.name}
            </span>
            <button
              onClick={handleLogout}
              className="rounded-md border border-[#3cc4a9] bg-[#3cc4a9] px-3 py-1.5 text-black
                         shadow-md transition-all duration-150 hover:scale-[1.03] hover:bg-[#248673]
                         hover:shadow-lg active:scale-[0.97]"
            >
              Log out
            </button>
          </div>
        )}

        {/* Mobile hamburger toggle */}
        {user && (
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-black/10 md:hidden dark:border-white/10"
          >
            <div className="flex flex-col gap-[4px]">
              <span
                className={`h-[2px] w-5 bg-black transition-transform duration-200 dark:bg-white ${
                  menuOpen ? "translate-y-[6px] rotate-45" : ""
                }`}
              />
              <span
                className={`h-[2px] w-5 bg-black transition-opacity duration-200 dark:bg-white ${
                  menuOpen ? "opacity-0" : "opacity-100"
                }`}
              />
              <span
                className={`h-[2px] w-5 bg-black transition-transform duration-200 dark:bg-white ${
                  menuOpen ? "-translate-y-[6px] -rotate-45" : ""
                }`}
              />
            </div>
          </button>
        )}
      </div>

      {/* Mobile dropdown menu */}
      {user && menuOpen && (
        <div className="border-t border-black/5 bg-white/90 px-4 py-3 backdrop-blur-md md:hidden dark:border-white/5 dark:bg-black/70">
          <nav className="flex flex-col gap-3 text-sm">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={
                  pathname === link.href
                    ? "font-medium text-black dark:text-white"
                    : "text-zinc-500 dark:text-zinc-400"
                }
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex items-center justify-between border-t border-black/5 pt-3 dark:border-white/5">
            <span className="truncate text-sm text-zinc-500 dark:text-zinc-400">
              {user.name}
            </span>
            <button
              onClick={() => {
                setMenuOpen(false);
                handleLogout();
              }}
              className="rounded-md border border-[#3cc4a9] bg-[#3cc4a9] px-3 py-1.5 text-sm text-black
                         shadow-md transition-all duration-150 hover:bg-[#248673] active:scale-[0.97]"
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}