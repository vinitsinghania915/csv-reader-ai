"use client";

import { motion } from "framer-motion";
import { MessageSquare, Plus, Link2, Table, RefreshCw, ChevronLeft, LayoutDashboard } from "lucide-react";
import clsx from "clsx";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import GoogleSheetConnect from "@/components/upload/GoogleSheetConnect";
import SourceIcon from "@/components/shared/SourceIcon";
import TablePreviewDrawer from "@/components/tables/TablePreviewDrawer";
import { API_URL, apiJson } from "@/lib/api";

interface SidebarProps {
  isOpen: boolean;
  toggle?: () => void;
  workspaceId?: string | null;
}

type TableRow = {
  name: string;
  total_rows: number;
  column_count?: number;
  source_type?: string;
  origin?: string | null;
  last_synced_at?: string | null;
  resyncable?: boolean;
};
type ChatRow = { id: string; title?: string };
type DashboardRow = { id: string; name: string };

function formatRelative(iso?: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default function Sidebar({ isOpen, workspaceId }: SidebarProps) {
  const router = useRouter();
  const search = useSearchParams();
  const pathname = usePathname();
  const isOnSchema = !!workspaceId && pathname === `/workspaces/${workspaceId}/schema`;
  const isOnChat = !!workspaceId && pathname === `/workspaces/${workspaceId}`;
  const activeConvId = search?.get("conv") || null;
  const [tables, setTables] = useState<TableRow[]>([]);
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [dashboards, setDashboards] = useState<DashboardRow[]>([]);
  const [gsheetOpen, setGsheetOpen] = useState(false);
  const [resyncingTable, setResyncingTable] = useState<string | null>(null);
  const [previewTable, setPreviewTable] = useState<string | null>(null);

  const refreshTables = useCallback(() => {
    if (!workspaceId) return;
    fetch(`${API_URL}/workspaces/${workspaceId}/tables`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setTables(data.tables || []))
      .catch(console.error);
  }, [workspaceId]);

  const handleResync = useCallback(
    async (tableName: string) => {
      if (!workspaceId) return;
      setResyncingTable(tableName);
      try {
        await apiJson(
          `/connectors/gsheet/${encodeURIComponent(tableName)}/resync?workspace_id=${encodeURIComponent(
            workspaceId
          )}`,
          { method: "POST" }
        );
        refreshTables();
      } catch (e) {
        console.error("Resync failed", e);
      } finally {
        setResyncingTable(null);
      }
    },
    [workspaceId, refreshTables]
  );

  const refreshChats = useCallback(() => {
    if (!workspaceId) return;
    fetch(`${API_URL}/workspaces/${workspaceId}/chat/conversations`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setChats(data || []))
      .catch(console.error);
  }, [workspaceId]);

  const refreshDashboards = useCallback(() => {
    if (!workspaceId) return;
    fetch(`${API_URL}/workspaces/${workspaceId}/dashboards`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setDashboards(data.dashboards || []))
      .catch(console.error);
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    refreshTables();
    refreshChats();
    refreshDashboards();
  }, [workspaceId, refreshTables, refreshChats, refreshDashboards]);

  useEffect(() => {
    const onConvChanged = () => refreshChats();
    const onDashChanged = () => refreshDashboards();
    window.addEventListener("conversations:changed", onConvChanged);
    window.addEventListener("dashboards:changed", onDashChanged);
    return () => {
      window.removeEventListener("conversations:changed", onConvChanged);
      window.removeEventListener("dashboards:changed", onDashChanged);
    };
  }, [refreshChats, refreshDashboards]);

  // Auto-open Google Sheet modal when deep-linked (e.g., from a callback).
  useEffect(() => {
    if (search?.get("connect") === "google_sheet") {
      setGsheetOpen(true);
    }
  }, [search]);

  return (
    <motion.aside
      initial={false}
      animate={{ width: isOpen ? 240 : 0, opacity: isOpen ? 1 : 0 }}
      className="h-full border-r border-zinc-800/60 bg-zinc-900/40 flex flex-col overflow-hidden whitespace-nowrap"
      transition={{ type: "spring", bounce: 0, duration: 0.3 }}
    >
      <div className="p-4 flex-1 overflow-y-auto hidden-scrollbar">
        <Link
          href="/workspaces"
          className="mb-4 flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 transition-colors"
        >
          <ChevronLeft size={14} />
          <span>All workspaces</span>
        </Link>
        <button
          onClick={() => router.push("/")}
          className="w-full mb-6 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-500/20"
        >
          <Plus size={18} />
          <span>New Upload</span>
        </button>

        {workspaceId && (
          <>
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 px-2">
                Data Sources
              </h3>
              <ul className="space-y-1">
                {tables.map((t) => {
                  const isSyncing = resyncingTable === t.name;
                  return (
                    <li key={t.name} className="group">
                      <button
                        onClick={() => setPreviewTable(t.name)}
                        title={`Preview ${t.name}`}
                        className={clsx(
                          "w-full px-3 py-2 rounded-lg flex items-center gap-2 text-sm text-left transition-colors",
                          "hover:bg-zinc-800 text-zinc-300"
                        )}
                      >
                        <SourceIcon source={t.source_type || "csv"} size={16} />
                        <span className="truncate flex-1">{t.name}</span>
                        {t.resyncable ? (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResync(t.name);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.stopPropagation();
                                e.preventDefault();
                                handleResync(t.name);
                              }
                            }}
                            title={
                              t.last_synced_at
                                ? `Last synced ${formatRelative(t.last_synced_at)}. Click to refresh.`
                                : "Sync now"
                            }
                            className={clsx(
                              "p-1 rounded-md text-zinc-500 hover:text-blue-400 hover:bg-zinc-900",
                              isSyncing && "pointer-events-none opacity-50"
                            )}
                          >
                            <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
                          </span>
                        ) : null}
                        <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-md">
                          {t.total_rows}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button
                onClick={() => setGsheetOpen(true)}
                className="mt-2 w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-dashed border-zinc-800 hover:border-zinc-700 transition-colors"
              >
                <Table size={16} className="text-blue-400" />
                <span>Connect Google Sheet</span>
              </button>
            </div>

            <div className="mb-6">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 px-2">
                Workspace
              </h3>
              <nav className="space-y-1">
                <Link
                  href={`/workspaces/${workspaceId}`}
                  className={clsx(
                    "w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 text-sm transition-colors",
                    isOnChat
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  )}
                >
                  <MessageSquare size={16} />
                  <span>Chat</span>
                </Link>
                <Link
                  href={`/workspaces/${workspaceId}/schema`}
                  className={clsx(
                    "w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 text-sm transition-colors",
                    isOnSchema
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  )}
                >
                  <Link2 size={16} />
                  <span>Relationships</span>
                </Link>
                <Link
                  href={`/workspaces/${workspaceId}/dashboards`}
                  className={clsx(
                    "w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 text-sm transition-colors",
                    pathname?.startsWith(`/workspaces/${workspaceId}/dashboards`)
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  )}
                >
                  <LayoutDashboard size={16} />
                  <span>Dashboards</span>
                </Link>
              </nav>
            </div>

            {dashboards.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 px-2">
                  Your Dashboards
                </h3>
                <ul className="space-y-1">
                  {dashboards.map((d) => {
                    const isActive = pathname === `/workspaces/${workspaceId}/dashboards/${d.id}`;
                    return (
                      <li key={d.id}>
                        <Link
                          href={`/workspaces/${workspaceId}/dashboards/${d.id}`}
                          className={clsx(
                            "w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 text-sm transition-colors",
                            isActive
                              ? "bg-zinc-800 text-zinc-100"
                              : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                          )}
                        >
                          <LayoutDashboard size={14} />
                          <span className="truncate flex-1">{d.name}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3 px-2">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Chats
                </h3>
                <button
                  type="button"
                  title="New chat"
                  onClick={() => {
                    // Clear the remembered conversation for this workspace so the
                    // ChatContainer fallback doesn't immediately snap us back
                    // into the last conversation.
                    if (typeof window !== "undefined") {
                      window.sessionStorage.removeItem(`chat:${workspaceId}:conversation_id`);
                    }
                    router.push(`/workspaces/${workspaceId}`);
                  }}
                  className="text-zinc-500 hover:text-zinc-200 transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
              {chats.length === 0 ? (
                <p className="px-2 text-xs text-zinc-600">No past conversations.</p>
              ) : (
                <ul className="space-y-1">
                  {chats.map((chat) => {
                    const isActive = chat.id === activeConvId && isOnChat;
                    return (
                      <li key={chat.id}>
                        <Link
                          href={`/workspaces/${workspaceId}?conv=${encodeURIComponent(chat.id)}`}
                          className={clsx(
                            "w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 text-sm transition-colors",
                            isActive
                              ? "bg-zinc-800 text-zinc-100"
                              : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                          )}
                        >
                          <MessageSquare size={16} />
                          <span className="truncate flex-1">{chat.title || "Conversation"}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      {workspaceId && (
        <>
          <GoogleSheetConnect
            workspaceId={workspaceId}
            open={gsheetOpen}
            onClose={() => setGsheetOpen(false)}
            onImported={() => {
              setGsheetOpen(false);
              refreshTables();
            }}
          />
          <TablePreviewDrawer
            workspaceId={workspaceId}
            tableName={previewTable}
            onClose={() => setPreviewTable(null)}
          />
        </>
      )}
    </motion.aside>
  );
}
