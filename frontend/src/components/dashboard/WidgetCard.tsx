"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Trash2, AlertCircle, Terminal, ChevronDown, ChevronUp } from "lucide-react";
import Visualizer from "@/components/chat/Visualizer";
import { apiJson } from "@/lib/api";

interface ChartConfig {
  chart_type: "bar" | "line" | "pie" | "scatter" | "area";
  x_axis: string;
  y_axis: string;
  title: string;
  color?: string | null;
}

export interface Widget {
  id: string;
  title: string;
  widget_type: string;
  sql: string;
  chart_config: ChartConfig | null;
  position: number;
}

interface WidgetData {
  widget_id: string;
  title: string;
  chart_config: ChartConfig | null;
  data: Record<string, unknown>[];
  columns: string[];
}

interface Props {
  widget: Widget;
  onDeleted?: () => void;
}

export default function WidgetCard({ widget, onDeleted }: Props) {
  const [data, setData] = useState<WidgetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSql, setShowSql] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiJson<WidgetData>(`/widgets/${encodeURIComponent(widget.id)}/data`);
      setData(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [widget.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async () => {
    if (!confirm(`Delete widget "${widget.title}"?`)) return;
    try {
      await apiJson(`/widgets/${encodeURIComponent(widget.id)}`, { method: "DELETE" });
      onDeleted?.();
    } catch (e) {
      alert(`Failed to delete: ${(e as Error).message}`);
    }
  };

  const renderBody = () => {
    if (loading && !data) {
      return (
        <div className="h-64 flex items-center justify-center text-zinc-500 gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      );
    }
    if (error) {
      return (
        <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5 text-red-300 text-sm flex items-start gap-2">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      );
    }
    if (!data || !data.data || data.data.length === 0) {
      return <div className="h-24 flex items-center justify-center text-zinc-500 text-sm">No data.</div>;
    }

    // Metric: single row, single-ish column → big number
    if (widget.widget_type === "metric") {
      const row = data.data[0];
      const firstKey = data.columns[0] || Object.keys(row)[0];
      const value = row[firstKey];
      return (
        <div className="py-6 flex flex-col items-start">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{firstKey}</p>
          <p className="text-4xl font-semibold text-zinc-100 tabular-nums">
            {typeof value === "number" ? value.toLocaleString() : String(value ?? "—")}
          </p>
        </div>
      );
    }

    // Table fallback
    if (widget.widget_type === "table" || !data.chart_config) {
      return (
        <div className="overflow-auto max-h-80 border border-zinc-800 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 sticky top-0">
              <tr>
                {data.columns.map((c) => (
                  <th key={c} className="text-left px-3 py-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.data.slice(0, 100).map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/40"}>
                  {data.columns.map((c) => (
                    <td key={c} className="px-3 py-1.5 text-zinc-200 border-b border-zinc-800/60 max-w-[18rem] truncate">
                      {formatCell(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return <Visualizer data={data.data} config={data.chart_config} />;
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h3 className="font-semibold text-zinc-100 truncate">{widget.title}</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSql((v) => !v)}
            title="Toggle SQL"
            className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
          >
            <Terminal size={14} />
            {showSql ? <ChevronUp size={12} className="inline ml-0.5" /> : <ChevronDown size={12} className="inline ml-0.5" />}
          </button>
          <button
            onClick={load}
            disabled={loading}
            title="Refresh"
            className="p-1.5 rounded-md text-zinc-500 hover:text-indigo-400 hover:bg-zinc-800 disabled:opacity-40"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={handleDelete}
            title="Delete"
            className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-zinc-800"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {showSql && (
        <pre className="mb-3 text-xs text-indigo-300 bg-zinc-950 border border-zinc-800 rounded-md p-3 overflow-x-auto">
          <code>{widget.sql}</code>
        </pre>
      )}

      {renderBody()}
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
