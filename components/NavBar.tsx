"use client";

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

  async function handleLogout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (pathname === "/login") return null;

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/60 backdrop-blur-md dark:border-white/5 dark:bg-black/50">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <Link
            href={"/"}
            className="transition-transform hover:scale-[1.03] active:scale-[0.98]"
          >
            <div className="flex items-center justify-center gap-2 font-semibold tracking-tight">
              <Image
                src="/ledger-logo.svg"
                alt="Ledger logo"
                width={30}
                height={30}
                className=""
              />
              <span>Ledger.ai</span>
            </div>
          </Link>
          {user && (
            <nav className="flex gap-4 text-sm">
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
        {user && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">
              {user.name}
            </span>
            <button
              onClick={handleLogout}
              className="rounded-md border border-[#3cc4a9] px-3 py-1.5 bg-[#3cc4a9] text-black
             hover:bg-[#248673]  hover:scale-[1.03]
             active:scale-[0.97] shadow-md hover:shadow-lg
             transition-all duration-150"
            >
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
