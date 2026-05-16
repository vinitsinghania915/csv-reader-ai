"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, AlertCircle } from "lucide-react";
import { apiJson } from "@/lib/api";

interface PreviewResponse {
  name: string;
  columns: string[];
  data: Record<string, unknown>[];
  total_rows: number;
}

interface Props {
  workspaceId: string;
  tableName: string | null;
  onClose: () => void;
}

export default function TablePreviewDrawer({ workspaceId, tableName, onClose }: Props) {
  const [data, setData] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tableName) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    apiJson<PreviewResponse>(
      `/workspaces/${encodeURIComponent(workspaceId)}/tables/${encodeURIComponent(tableName)}?rows=50`
    )
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, tableName]);

  return (
    <AnimatePresence>
      {tableName && (
        <motion.div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 h-full w-full max-w-3xl bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col"
          >
            <header className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Preview</p>
                <h2 className="font-semibold text-zinc-100 text-lg truncate">{tableName}</h2>
                {data && (
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {data.total_rows.toLocaleString()} rows · {data.columns.length} cols · showing{" "}
                    {data.data.length}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
              >
                <X size={18} />
              </button>
            </header>

            <div className="flex-1 overflow-auto">
              {loading && (
                <div className="h-full flex items-center justify-center text-zinc-500 gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Loading preview…
                </div>
              )}
              {error && (
                <div className="m-5 p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-red-300 text-sm flex items-start gap-2">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              {data && !loading && !error && (
                <div className="overflow-auto">
                  <table className="w-full text-sm border-separate border-spacing-0">
                    <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur z-10">
                      <tr>
                        {data.columns.map((c) => (
                          <th
                            key={c}
                            className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800"
                          >
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.data.map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/40"}>
                          {data.columns.map((c) => (
                            <td
                              key={c}
                              className="px-4 py-2 text-zinc-200 border-b border-zinc-800/60 max-w-[20rem] truncate"
                              title={formatCell(row[c])}
                            >
                              {formatCell(row[c])}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {data.data.length === 0 && (
                        <tr>
                          <td
                            colSpan={data.columns.length}
                            className="px-4 py-8 text-center text-zinc-500"
                          >
                            No rows.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
