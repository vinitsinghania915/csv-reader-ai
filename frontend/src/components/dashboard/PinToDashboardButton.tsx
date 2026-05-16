"use client";

import { useCallback, useEffect, useState } from "react";
import { Pin, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { apiJson } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

interface Dashboard {
  id: string;
  name: string;
}

interface Props {
  workspaceId: string;
  defaultTitle: string;
  sql: string;
  chartConfig: unknown;
}

export default function PinToDashboardButton({
  workspaceId,
  defaultTitle,
  sql,
  chartConfig,
}: Props) {
  const [open, setOpen] = useState(false);
  const [dashboards, setDashboards] = useState<Dashboard[] | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [title, setTitle] = useState(defaultTitle);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);

  const loadDashboards = useCallback(async () => {
    try {
      const d = await apiJson<{ dashboards: Dashboard[] }>(
        `/workspaces/${encodeURIComponent(workspaceId)}/dashboards`
      );
      setDashboards(d.dashboards);
      if (d.dashboards.length > 0 && !selectedId) {
        setSelectedId(d.dashboards[0].id);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [workspaceId, selectedId]);

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setError(null);
      setPinned(false);
      loadDashboards();
    }
  }, [open, defaultTitle, loadDashboards]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      let dashboardId = selectedId;
      if (!dashboardId || dashboardId === "__new__") {
        const name = newName.trim() || "New dashboard";
        const created = await apiJson<{ id: string }>(
          `/workspaces/${encodeURIComponent(workspaceId)}/dashboards`,
          { method: "POST", body: JSON.stringify({ name }) }
        );
        dashboardId = created.id;
      }
      await apiJson(`/dashboards/${encodeURIComponent(dashboardId)}/widgets`, {
        method: "POST",
        body: JSON.stringify({
          title: title.trim() || defaultTitle,
          sql,
          chart_config: chartConfig || null,
          widget_type: chartConfig ? "chart" : "table",
        }),
      });
      setPinned(true);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dashboards:changed"));
      }
      setTimeout(() => setOpen(false), 800);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Pin to dashboard"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-indigo-300 transition-colors bg-zinc-800/50 hover:bg-zinc-800 px-3 py-1.5 rounded-md border border-zinc-700/50"
      >
        <Pin size={12} />
        Pin to dashboard
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl"
            >
              <header className="flex items-center justify-between p-5 border-b border-zinc-800">
                <h2 className="font-semibold text-zinc-100">Pin to dashboard</h2>
              </header>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
                    Widget title
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
                    Dashboard
                  </label>
                  <select
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100"
                  >
                    {dashboards?.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                    <option value="__new__">+ Create new dashboard…</option>
                  </select>
                </div>
                {selectedId === "__new__" && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
                      New dashboard name
                    </label>
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Sales overview"
                      className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                )}
                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-sm text-red-300">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                {pinned && (
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-sm text-emerald-300">
                    <CheckCircle2 size={16} /> Pinned.
                  </div>
                )}
              </div>
              <footer className="flex items-center justify-end gap-2 p-4 border-t border-zinc-800">
                <button onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-zinc-300 hover:text-zinc-100">
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium inline-flex items-center gap-2"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Pin size={14} />}
                  Pin
                </button>
              </footer>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
