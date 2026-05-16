"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Loader2, AlertCircle } from "lucide-react";
import { API_URL, apiJson } from "@/lib/api";

interface QueryResult {
  data: Record<string, unknown>[];
  columns: string[];
  execution_time_ms?: number;
}

interface Props {
  workspaceId: string;
  dashboardId: string;
  open: boolean;
  onClose: () => void;
  onAdded?: () => void;
}

type ChartType = "chart" | "table" | "metric";
type ChartKind = "bar" | "line" | "pie" | "scatter";

export default function AddWidgetModal({ workspaceId, dashboardId, open, onClose, onAdded }: Props) {
  const [title, setTitle] = useState("");
  const [sql, setSql] = useState("");
  const [widgetType, setWidgetType] = useState<ChartType>("chart");
  const [chartKind, setChartKind] = useState<ChartKind>("bar");
  const [xAxis, setXAxis] = useState("");
  const [yAxis, setYAxis] = useState("");
  const [preview, setPreview] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle("");
      setSql("");
      setWidgetType("chart");
      setChartKind("bar");
      setXAxis("");
      setYAxis("");
      setPreview(null);
      setError(null);
    }
  }, [open]);

  const runPreview = useCallback(async () => {
    if (!sql.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/workspaces/${workspaceId}/query`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Query failed (${res.status})`);
      }
      const data = (await res.json()) as QueryResult;
      setPreview(data);
      if (data.columns.length > 0 && !xAxis) setXAxis(data.columns[0]);
      if (data.columns.length > 1 && !yAxis) setYAxis(data.columns[1]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [sql, workspaceId, xAxis, yAxis]);

  const save = useCallback(async () => {
    if (!title.trim() || !sql.trim()) {
      setError("Title and SQL are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const chartConfig =
        widgetType === "chart"
          ? { chart_type: chartKind, x_axis: xAxis, y_axis: yAxis, title }
          : null;
      await apiJson(`/dashboards/${encodeURIComponent(dashboardId)}/widgets`, {
        method: "POST",
        body: JSON.stringify({
          title,
          sql,
          chart_config: chartConfig,
          widget_type: widgetType,
        }),
      });
      onAdded?.();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [title, sql, widgetType, chartKind, xAxis, yAxis, dashboardId, onAdded, onClose]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ scale: 0.95, y: 10 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 10 }}
          className="w-full max-w-3xl max-h-[90vh] overflow-auto rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl flex flex-col"
        >
          <header className="flex items-center justify-between p-5 border-b border-zinc-800">
            <div>
              <h2 className="font-semibold text-zinc-100">Add widget</h2>
              <p className="text-xs text-zinc-500">
                Write SQL against your tables. Use table names from the sidebar.
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800">
              <X size={18} />
            </button>
          </header>

          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
                Title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Revenue by category"
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
                SQL
              </label>
              <textarea
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                placeholder="SELECT category, SUM(revenue) FROM test_sales GROUP BY category"
                rows={5}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-indigo-200 font-mono placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={runPreview}
                  disabled={loading || !sql.trim()}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-200 disabled:opacity-40"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                  Run preview
                </button>
              </div>
            </div>

            {preview && (
              <>
                <div className="rounded-lg border border-zinc-800 overflow-auto max-h-48">
                  <table className="w-full text-xs">
                    <thead className="bg-zinc-900 sticky top-0">
                      <tr>
                        {preview.columns.map((c) => (
                          <th key={c} className="text-left px-3 py-1.5 text-zinc-400 font-semibold uppercase tracking-wider">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.data.slice(0, 10).map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/50"}>
                          {preview.columns.map((c) => (
                            <td key={c} className="px-3 py-1 text-zinc-200 border-t border-zinc-800/60 max-w-[14rem] truncate">
                              {String(row[c] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-zinc-500">
                  {preview.data.length} rows · showing first {Math.min(preview.data.length, 10)}
                </p>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
                    Widget type
                  </label>
                  <div className="flex gap-2">
                    {(["chart", "table", "metric"] as ChartType[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setWidgetType(t)}
                        className={`px-3 py-1.5 text-sm rounded-md capitalize border ${
                          widgetType === t
                            ? "border-indigo-500 bg-indigo-500/10 text-indigo-200"
                            : "border-zinc-800 text-zinc-400 hover:bg-zinc-800/60"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {widgetType === "chart" && (
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
                        Chart
                      </label>
                      <select
                        value={chartKind}
                        onChange={(e) => setChartKind(e.target.value as ChartKind)}
                        className="w-full px-2 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100"
                      >
                        <option value="bar">Bar</option>
                        <option value="line">Line</option>
                        <option value="pie">Pie</option>
                        <option value="scatter">Scatter</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
                        X axis
                      </label>
                      <select
                        value={xAxis}
                        onChange={(e) => setXAxis(e.target.value)}
                        className="w-full px-2 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100"
                      >
                        {preview.columns.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
                        Y axis
                      </label>
                      <select
                        value={yAxis}
                        onChange={(e) => setYAxis(e.target.value)}
                        className="w-full px-2 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100"
                      >
                        {preview.columns.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-sm text-red-300">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <footer className="flex items-center justify-end gap-2 p-4 border-t border-zinc-800">
            <button onClick={onClose} className="px-3 py-2 text-sm text-zinc-300 hover:text-zinc-100">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving || !title.trim() || !sql.trim()}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium inline-flex items-center gap-2"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              Add widget
            </button>
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
