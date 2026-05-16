"use client";

import AppShell from "@/components/layout/AppShell";
import { apiJson } from "@/lib/api";
import { LayoutDashboard, Plus } from "lucide-react";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

type Dashboard = {
  id: string;
  name: string;
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

export default function DashboardsListPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const [items, setItems] = useState<Dashboard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await apiJson<{ dashboards: Dashboard[] }>(
        `/workspaces/${encodeURIComponent(workspaceId)}/dashboards`
      );
      setItems(d.dashboards);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    const name = window.prompt("Dashboard name:", "");
    if (!name?.trim()) return;
    setCreating(true);
    try {
      await apiJson(`/workspaces/${encodeURIComponent(workspaceId)}/dashboards`, {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });
      await load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppShell workspaceId={workspaceId}>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Dashboards</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Saved views of your data — no re-asking the LLM.
            </p>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium"
          >
            <Plus size={16} /> New dashboard
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg border border-red-500/20 bg-red-500/5 text-red-300 text-sm">
            {error}
          </div>
        )}

        {items === null ? (
          <div className="text-zinc-500">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-dashed border-zinc-800">
            <div className="inline-flex p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-4">
              <LayoutDashboard size={24} />
            </div>
            <h3 className="text-lg font-semibold text-zinc-100 mb-1">No dashboards yet</h3>
            <p className="text-sm text-zinc-500 mb-6">
              Pin a chat answer, or create a dashboard and build widgets with SQL.
            </p>
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
            >
              <Plus size={16} /> New dashboard
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((d) => (
              <Link
                key={d.id}
                href={`/workspaces/${workspaceId}/dashboards/${d.id}`}
                className="group p-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 hover:border-indigo-500/40 hover:bg-zinc-900 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <LayoutDashboard size={18} />
                  </div>
                </div>
                <h3 className="font-semibold text-zinc-100 truncate mb-1 group-hover:text-white">
                  {d.name}
                </h3>
                <p className="text-xs text-zinc-500">Updated {formatRelative(d.updated_at)}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
