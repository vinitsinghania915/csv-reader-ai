"use client";

import AppShell from "@/components/layout/AppShell";
import { apiJson } from "@/lib/api";
import { signInWithGoogle, useCurrentUser } from "@/lib/auth";
import { Database, Plus, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type WorkspaceCard = {
  id: string;
  name: string;
  table_count: number;
  created_at: string;
  updated_at: string;
};

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const secs = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default function WorkspacesPage() {
  const router = useRouter();
  const { user, isLoading } = useCurrentUser();
  const [workspaces, setWorkspaces] = useState<WorkspaceCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiJson<{ workspaces: WorkspaceCard[] }>("/workspaces");
      setWorkspaces(data.workspaces);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (isLoading) {
    return (
      <AppShell>
        <div className="h-full flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-indigo-500/40 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <div className="h-full flex flex-col items-center justify-center text-center gap-6">
          <h1 className="text-3xl font-bold text-zinc-100">Sign in to continue</h1>
          <p className="text-zinc-400 max-w-md">
            Sign in with Google to save and re-open your workspaces, and to connect
            Google Sheets.
          </p>
          <button
            onClick={() => signInWithGoogle("/workspaces")}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-zinc-900 font-medium hover:bg-zinc-100"
          >
            Sign in with Google
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Your workspaces</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Each workspace holds a set of tables you can query together.
            </p>
          </div>
          <button
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
          >
            <Plus size={16} /> New workspace
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg border border-red-500/20 bg-red-500/5 text-red-300 text-sm">
            {error}
          </div>
        )}

        {workspaces === null ? (
          <div className="text-zinc-500">Loading…</div>
        ) : workspaces.length === 0 ? (
          <EmptyState onNew={() => router.push("/")} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((w) => (
              <Link
                key={w.id}
                href={`/workspaces/${w.id}`}
                className="group p-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 hover:border-indigo-500/40 hover:bg-zinc-900 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <Database size={18} />
                  </div>
                  <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-md">
                    {w.table_count} table{w.table_count === 1 ? "" : "s"}
                  </span>
                </div>
                <h3 className="font-semibold text-zinc-100 truncate mb-1 group-hover:text-white">
                  {w.name}
                </h3>
                <p className="text-xs text-zinc-500">
                  Updated {formatRelative(w.updated_at)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="text-center py-16 rounded-2xl border border-dashed border-zinc-800">
      <div className="inline-flex p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-4">
        <Upload size={24} />
      </div>
      <h3 className="text-lg font-semibold text-zinc-100 mb-1">No workspaces yet</h3>
      <p className="text-sm text-zinc-500 mb-6">Upload a CSV or connect a Google Sheet to create one.</p>
      <button
        onClick={onNew}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
      >
        <Plus size={16} /> New workspace
      </button>
    </div>
  );
}
