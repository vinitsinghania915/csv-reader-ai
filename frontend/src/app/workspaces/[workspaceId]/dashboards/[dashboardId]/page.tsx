"use client";

import AppShell from "@/components/layout/AppShell";
import WidgetCard, { Widget } from "@/components/dashboard/WidgetCard";
import AddWidgetModal from "@/components/dashboard/AddWidgetModal";
import { apiJson } from "@/lib/api";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";

interface DashboardResponse {
  id: string;
  name: string;
  workspace_id: string;
  widgets: Widget[];
}

export default function DashboardDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string; dashboardId: string }>;
}) {
  const { workspaceId, dashboardId } = use(params);
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await apiJson<DashboardResponse>(
        `/dashboards/${encodeURIComponent(dashboardId)}`
      );
      setDashboard(d);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [dashboardId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRename = async () => {
    if (!dashboard) return;
    const name = window.prompt("Rename dashboard", dashboard.name);
    if (!name?.trim() || name === dashboard.name) return;
    try {
      await apiJson(`/dashboards/${encodeURIComponent(dashboardId)}`, {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim() }),
      });
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleDelete = async () => {
    if (!dashboard) return;
    if (!confirm(`Delete dashboard "${dashboard.name}"? Its widgets will be removed too.`)) return;
    try {
      await apiJson(`/dashboards/${encodeURIComponent(dashboardId)}`, { method: "DELETE" });
      router.push(`/workspaces/${workspaceId}/dashboards`);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <AppShell workspaceId={workspaceId}>
      <div className="p-8 max-w-6xl mx-auto">
        <div className="flex items-start justify-between mb-6 gap-4">
          <div className="min-w-0">
            <Link
              href={`/workspaces/${workspaceId}/dashboards`}
              className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-200 mb-2"
            >
              <ArrowLeft size={12} /> All dashboards
            </Link>
            <h1
              onClick={handleRename}
              title="Click to rename"
              className="text-2xl font-bold text-zinc-100 cursor-text hover:text-white truncate"
            >
              {dashboard?.name || "…"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
            >
              <Plus size={16} /> Add widget
            </button>
            <button
              onClick={handleDelete}
              title="Delete dashboard"
              className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg border border-red-500/20 bg-red-500/5 text-red-300 text-sm">
            {error}
          </div>
        )}

        {dashboard === null ? (
          <div className="text-zinc-500">Loading…</div>
        ) : dashboard.widgets.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-dashed border-zinc-800">
            <h3 className="text-lg font-semibold text-zinc-100 mb-1">No widgets yet</h3>
            <p className="text-sm text-zinc-500 mb-6">
              Pin a chat answer, or build a widget here from scratch.
            </p>
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
            >
              <Plus size={16} /> Add widget
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {dashboard.widgets.map((w) => (
              <WidgetCard key={w.id} widget={w} onDeleted={load} />
            ))}
          </div>
        )}
      </div>

      <AddWidgetModal
        workspaceId={workspaceId}
        dashboardId={dashboardId}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={load}
      />
    </AppShell>
  );
}
