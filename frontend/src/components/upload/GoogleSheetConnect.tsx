"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle2, Link2, Loader2, Table, X } from "lucide-react";
import clsx from "clsx";

import { API_URL, apiJson } from "@/lib/api";

interface ConnectStatus {
  connected: boolean;
  email?: string;
  connected_at?: string;
}

interface DiscoverResponse {
  spreadsheet_id: string;
  title: string;
  tabs: { title: string }[];
}

interface ImportResponse {
  workspace_id: string;
  tables: { name: string; row_count: number }[];
}

interface Props {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
  onImported?: (r: ImportResponse) => void;
}

export default function GoogleSheetConnect({
  workspaceId,
  open,
  onClose,
  onImported,
}: Props) {
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [url, setUrl] = useState("");
  const [discover, setDiscover] = useState<DiscoverResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await apiJson<ConnectStatus>(`/auth/google/status`);
      setStatus(s);
    } catch (e) {
      setStatus({ connected: false });
    }
  }, []);

  useEffect(() => {
    if (open) {
      refreshStatus();
      setError(null);
      setDiscover(null);
      setSelected(new Set());
    }
  }, [open, refreshStatus]);

  const startOAuth = useCallback(() => {
    const next = `/workspaces/${encodeURIComponent(workspaceId)}`;
    window.location.href = `${API_URL}/auth/google/login?next=${encodeURIComponent(next)}`;
  }, [workspaceId]);

  const disconnect = useCallback(async () => {
    setLoading(true);
    try {
      await apiJson(`/auth/google/disconnect`, { method: "POST" });
      await refreshStatus();
      setDiscover(null);
    } finally {
      setLoading(false);
    }
  }, [refreshStatus]);

  const runDiscover = useCallback(async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const d = await apiJson<DiscoverResponse>(`/connectors/gsheet/discover`, {
        method: "POST",
        body: JSON.stringify({ workspace_id: workspaceId, spreadsheet_url: url.trim() }),
      });
      setDiscover(d);
      setSelected(new Set(d.tabs.map((t) => t.title)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [url, workspaceId]);

  const runImport = useCallback(async () => {
    if (!discover || selected.size === 0) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await apiJson<ImportResponse>(`/connectors/gsheet/import`, {
        method: "POST",
        body: JSON.stringify({
          workspace_id: workspaceId,
          spreadsheet_url: url.trim(),
          tabs: Array.from(selected),
        }),
      });
      onImported?.(resp);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [discover, selected, url, workspaceId, onImported, onClose]);

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
          className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl"
        >
          <header className="flex items-center justify-between p-5 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Table size={18} />
              </div>
              <div>
                <h2 className="font-semibold text-zinc-100">Connect Google Sheet</h2>
                <p className="text-xs text-zinc-500">
                  Import tabs as queryable tables.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            >
              <X size={18} />
            </button>
          </header>

          <div className="p-5 space-y-4">
            {!status?.connected ? (
              <div className="flex flex-col items-start gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-950/50">
                <p className="text-sm text-zinc-300">
                  Sign in with Google to let this workspace read your Sheets.
                </p>
                <button
                  onClick={startOAuth}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-zinc-900 font-medium text-sm hover:bg-zinc-100 transition"
                >
                  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                  Sign in with Google
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                <div className="flex items-center gap-2 text-sm text-emerald-300">
                  <CheckCircle2 size={16} />
                  <span>Connected as {status.email || "Google account"}</span>
                </div>
                <button
                  onClick={disconnect}
                  disabled={loading}
                  className="text-xs text-zinc-400 hover:text-zinc-200 underline underline-offset-2"
                >
                  Disconnect
                </button>
              </div>
            )}

            {status?.connected && (
              <div className="space-y-3">
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Spreadsheet URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="flex-1 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    onClick={runDiscover}
                    disabled={loading || !url.trim()}
                    className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium inline-flex items-center gap-2"
                  >
                    {loading && !discover ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                    Discover tabs
                  </button>
                </div>

                {discover && (
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 divide-y divide-zinc-800/70">
                    <div className="px-3 py-2 text-xs text-zinc-500">
                      <span className="text-zinc-300 font-medium">{discover.title}</span>
                      <span className="mx-2">·</span>
                      {discover.tabs.length} tab{discover.tabs.length === 1 ? "" : "s"}
                    </div>
                    <ul className="max-h-48 overflow-auto">
                      {discover.tabs.map((t) => {
                        const checked = selected.has(t.title);
                        return (
                          <li key={t.title}>
                            <label
                              className={clsx(
                                "flex items-center gap-3 px-3 py-2 text-sm cursor-pointer",
                                checked
                                  ? "text-zinc-100 hover:bg-zinc-800/60"
                                  : "text-zinc-400 hover:bg-zinc-800/40"
                              )}
                            >
                              <input
                                type="checkbox"
                                className="accent-indigo-500"
                                checked={checked}
                                onChange={(e) => {
                                  setSelected((prev) => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(t.title);
                                    else next.delete(t.title);
                                    return next;
                                  });
                                }}
                              />
                              <span className="truncate">{t.title}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-sm text-red-300">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <footer className="flex items-center justify-end gap-2 p-4 border-t border-zinc-800">
            <button
              onClick={onClose}
              className="px-3 py-2 text-sm text-zinc-300 hover:text-zinc-100"
            >
              Cancel
            </button>
            <button
              onClick={runImport}
              disabled={!discover || selected.size === 0 || loading}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium inline-flex items-center gap-2"
            >
              {loading && discover ? <Loader2 size={14} className="animate-spin" /> : null}
              Import {selected.size > 0 ? `${selected.size} tab${selected.size === 1 ? "" : "s"}` : ""}
            </button>
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
