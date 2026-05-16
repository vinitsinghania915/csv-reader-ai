"use client";

import AppShell from "@/components/layout/AppShell";
import UploadZone from "@/components/upload/UploadZone";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import { API_URL } from "@/lib/api";
import { signInWithGoogle, useCurrentUser } from "@/lib/auth";

export default function Home() {
  const router = useRouter();
  const { user, isLoading } = useCurrentUser();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");

  const handleUpload = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setIsUploading(true);
      setError(null);

      const file = files[0];
      const effectiveName = workspaceName.trim() || file.name.replace(/\.[^.]+$/, "") || "New workspace";

      const formData = new FormData();
      formData.append("file", file);
      formData.append("workspace_name", effectiveName);

      try {
        const res = await fetch(`${API_URL}/upload`, {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || `Upload failed (${res.status})`);
        }
        const data = await res.json();
        if (data.workspace_id) {
          router.push(`/workspaces/${data.workspace_id}`);
          return;
        }
        throw new Error("Upload response missing workspace_id");
      } catch (e) {
        console.error("Upload failed", e);
        setError((e as Error).message);
        setIsUploading(false);
      }
    },
    [router, workspaceName]
  );

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
        <div className="h-full flex flex-col items-center justify-center text-center gap-6 px-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-sm font-medium border border-indigo-500/20">
            Sign in required
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-100">
            Chat with your{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-indigo-600">
              CSV data
            </span>
          </h1>
          <p className="text-lg text-zinc-400 max-w-lg">
            Sign in with Google to upload datasets, connect Google Sheets, and
            save your workspaces.
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
      <AnimatePresence mode="wait">
        <motion.div
          key="upload"
          className="h-full flex flex-col items-center justify-center -mt-10 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-100 mb-4">
              New workspace
            </h1>
            <p className="text-base text-zinc-400 max-w-lg mx-auto">
              Upload a file to create a workspace. You&apos;ll be able to connect
              Google Sheets once it&apos;s created.
            </p>
          </motion.div>

          {error && (
            <div className="mb-4 w-full max-w-2xl p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-red-300 text-sm">
              {error}
            </div>
          )}

          {isUploading ? (
            <div className="w-full max-w-2xl px-12 py-16 rounded-2xl glass-card flex flex-col items-center justify-center border-indigo-500/30">
              <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
              <h3 className="text-lg font-medium text-zinc-200">Processing Data...</h3>
              <p className="text-sm text-zinc-500">This might take a few seconds.</p>
            </div>
          ) : (
            <div className="w-full max-w-2xl flex flex-col gap-4">
              <div>
                <label
                  htmlFor="workspace-name"
                  className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2"
                >
                  Workspace name
                </label>
                <input
                  id="workspace-name"
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="e.g. Q1 sales analysis"
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
                />
                <p className="text-xs text-zinc-500 mt-1.5">
                  Optional — defaults to the file name.
                </p>
              </div>
              <UploadZone onUpload={handleUpload} maxSizeMB={2048} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}
