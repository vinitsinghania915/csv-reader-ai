"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, User as UserIcon, PanelLeftClose, PanelLeft, LogOut, LayoutGrid } from "lucide-react";
import clsx from "clsx";
import { signInWithGoogle, signOut, useCurrentUser } from "@/lib/auth";

interface HeaderProps {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  showSidebarToggle?: boolean;
}

export default function Header({ sidebarOpen, toggleSidebar, showSidebarToggle = true }: HeaderProps) {
  const { user, isLoading } = useCurrentUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const isOnWorkspaces = pathname === "/workspaces";

  return (
    <header className="h-14 border-b border-zinc-800/60 bg-zinc-900/50 backdrop-blur-md flex items-center justify-between px-4 z-10">
      <div className="flex items-center gap-3">
        {showSidebarToggle && (
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
          </button>
        )}
        <Link href="/workspaces" className="flex items-center gap-3">
          <img src="/logo.png" alt="DataWeaver Logo" className="w-8 h-8 rounded-lg object-cover border border-zinc-800" />
          <h1 className="font-semibold tracking-tight text-zinc-100">DataWeaver (DW)</h1>
        </Link>

        {user && (
          <nav className="ml-2 md:ml-6 flex items-center gap-1">
            <Link
              href="/workspaces"
              className={clsx(
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors",
                isOnWorkspaces
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60"
              )}
            >
              <LayoutGrid size={14} />
              Workspaces
            </Link>
          </nav>
        )}
      </div>

      <div className="flex items-center gap-2 relative">
        {isLoading ? (
          <div className="w-9 h-9 rounded-full bg-zinc-800 animate-pulse" />
        ) : user ? (
          <>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full hover:bg-zinc-800 text-zinc-200 transition-colors"
              aria-label="Open account menu"
            >
              {user.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar_url}
                  alt=""
                  className="w-7 h-7 rounded-full border border-zinc-700"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-xs font-semibold">
                  {(user.name || user.email)[0]?.toUpperCase()}
                </div>
              )}
              <span className="text-sm hidden md:inline max-w-[10rem] truncate">
                {user.name || user.email}
              </span>
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl overflow-hidden"
                onMouseLeave={() => setMenuOpen(false)}
              >
                <div className="px-4 py-3 border-b border-zinc-800">
                  <p className="text-xs text-zinc-500">Signed in as</p>
                  <p className="text-sm text-zinc-100 truncate">{user.email}</p>
                </div>
                <Link
                  href="/workspaces"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
                  onClick={() => setMenuOpen(false)}
                >
                  <UserIcon size={14} /> Your workspaces
                </Link>
                <button
                  onClick={() => signOut()}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            )}
          </>
        ) : (
          <button
            onClick={() => signInWithGoogle()}
            className="px-3 py-1.5 rounded-lg bg-white text-zinc-900 text-sm font-medium hover:bg-zinc-100"
          >
            Sign in
          </button>
        )}
      </div>
    </header>
  );
}
