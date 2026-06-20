"use client";

import AppShell from "@/components/layout/AppShell";
import UploadZone from "@/components/upload/UploadZone";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BarChart3, 
  Database, 
  MessageSquare, 
  Sparkles, 
  ArrowRight, 
  Check, 
  Zap, 
  Shield, 
  Terminal, 
  ArrowRightLeft,
  Play,
  GitMerge
} from "lucide-react";

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
      <div className="min-h-screen bg-zinc-950 text-zinc-100 overflow-y-auto selection:bg-indigo-500/30 selection:text-indigo-200">
        {/* Custom SaaS Navbar */}
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-900/80 bg-zinc-950/70 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="DataWeaver Logo" className="w-8 h-8 rounded-lg object-cover border border-zinc-800" />
              <span className="font-bold tracking-tight text-lg text-zinc-100">DataWeaver</span>
            </div>
            
            <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
              <a href="#features" className="hover:text-zinc-100 transition-colors">Features</a>
              <a href="#engine" className="hover:text-zinc-100 transition-colors">Engine</a>
              <a href="#pricing" className="hover:text-zinc-100 transition-colors">Pricing</a>
            </nav>

            <button
              onClick={() => signInWithGoogle("/workspaces")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white hover:bg-zinc-100 text-zinc-950 text-sm font-semibold transition-colors"
            >
              Sign In
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <section className="relative pt-32 pb-24 md:pt-40 md:pb-32 px-6 overflow-hidden">
          {/* Subtle grid background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#09090b_1px,transparent_1px),linear-gradient(to_bottom,#09090b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-60 pointer-events-none" />
          
          {/* Radial color glows */}
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 items-center relative z-10">
            {/* Left Column: Headline & copy */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-semibold border border-indigo-500/20 shadow-sm animate-pulse">
                <Sparkles size={12} />
                Now Live: Interactive Dashboard Builder
              </div>
              
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.1] text-zinc-100">
                Weave Spreadsheets Into{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400">
                  Chat-Driven Analytics
                </span>
              </h1>
              
              <p className="text-lg md:text-xl text-zinc-400 max-w-xl leading-relaxed">
                Connect your CSVs, Excel files, and Google Sheets. Ask questions in plain English, query multiple tables simultaneously, and weave dynamic dashboards in seconds.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button
                  onClick={() => signInWithGoogle("/workspaces")}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white hover:bg-zinc-100 text-zinc-950 font-semibold text-base transition-all shadow-lg hover:shadow-indigo-500/10"
                >
                  Get Started Free <ArrowRight size={16} />
                </button>
                <a
                  href="#engine"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800/80 text-zinc-300 font-semibold border border-zinc-800 transition-colors"
                >
                  <Play size={16} fill="currentColor" className="text-zinc-400" /> Explore Engine Tech
                </a>
              </div>

              {/* Stat callouts */}
              <div className="grid grid-cols-3 gap-6 pt-10 border-t border-zinc-900/60 max-w-lg">
                <div>
                  <div className="text-2xl font-bold text-zinc-200">100%</div>
                  <div className="text-xs text-zinc-500">In-Browser Privacy</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-zinc-200">&lt; 1s</div>
                  <div className="text-xs text-zinc-500">Query Latency</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-zinc-200">Polars</div>
                  <div className="text-xs text-zinc-500">Analytical Engine</div>
                </div>
              </div>
            </div>

            {/* Right Column: Visual Dashboard Mock */}
            <div className="lg:col-span-5 relative">
              {/* Outer decorative box */}
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-emerald-500/10 rounded-2xl blur-2xl pointer-events-none" />
              
              <div className="relative bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/60 p-6 rounded-2xl shadow-2xl space-y-6">
                {/* Visual Header */}
                <div className="flex items-center justify-between border-b border-zinc-800/50 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500/70" />
                    <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
                    <span className="w-3 h-3 rounded-full bg-green-500/70" />
                  </div>
                  <span className="text-xs font-mono text-zinc-500">workspace_sales_q2.db</span>
                </div>

                {/* Simulated schema joining */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-xs font-mono text-zinc-400 gap-2">
                    <div className="bg-zinc-800/60 p-2.5 rounded-lg border border-zinc-700/40 space-y-1">
                      <div className="font-bold text-indigo-400 text-[10px]">orders.parquet</div>
                      <div>id (INT)</div>
                      <div className="text-zinc-500">cust_id (FK)</div>
                      <div>total (FLOAT)</div>
                    </div>

                    <div className="flex flex-col items-center shrink-0">
                      <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30 font-bold mb-1">Joined</span>
                      <ArrowRightLeft size={14} className="text-indigo-400 animate-pulse" />
                    </div>

                    <div className="bg-zinc-800/60 p-2.5 rounded-lg border border-zinc-700/40 space-y-1">
                      <div className="font-bold text-emerald-400 text-[10px]">customers.parquet</div>
                      <div className="text-zinc-500">id (PK)</div>
                      <div>name (TEXT)</div>
                      <div>segment (TEXT)</div>
                    </div>
                  </div>

                  {/* Chat simulation */}
                  <div className="bg-zinc-950/80 rounded-xl p-3.5 border border-zinc-900 space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] bg-indigo-500/20 text-indigo-400 font-semibold px-2 py-0.5 rounded">Prompt</span>
                      <span className="text-xs text-zinc-300">"Total sales by customer segment"</span>
                    </div>
                    
                    <div className="border-t border-zinc-900/60 my-2" />
                    
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold">
                        <Terminal size={10} />
                        <span>Generated SQL (DuckDB)</span>
                      </div>
                      <pre className="text-[10px] font-mono text-indigo-300 leading-tight">
{`SELECT c.segment, SUM(o.total) as sales 
FROM orders o 
JOIN customers c ON o.cust_id = c.id 
GROUP BY 1`}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 px-6 border-t border-zinc-900 bg-zinc-900/10 relative">
          <div className="max-w-7xl mx-auto space-y-16">
            <div className="text-center max-w-2xl mx-auto space-y-4">
              <h2 className="text-3xl md:text-4xl font-bold text-zinc-100">
                Unlock the analytical power of your data
              </h2>
              <p className="text-base text-zinc-400">
                DataWeaver maps, connects, and optimizes raw spreadsheets automatically so you can get insights via natural conversation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="bg-zinc-900/30 border border-zinc-800/40 p-8 rounded-2xl hover:border-zinc-850 hover:bg-zinc-900/50 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-6 group-hover:scale-110 transition-transform">
                  <MessageSquare size={22} />
                </div>
                <h3 className="text-xl font-bold text-zinc-200 mb-3">Conversational Chat-to-SQL</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  No need to write SQL or configure pivot tables. Ask questions in plain English. Our advanced compiler generates precise, isolated queries and explains the answers contextually.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-zinc-900/30 border border-zinc-800/40 p-8 rounded-2xl hover:border-zinc-850 hover:bg-zinc-900/50 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-6 group-hover:scale-110 transition-transform">
                  <Database size={22} />
                </div>
                <h3 className="text-xl font-bold text-zinc-200 mb-3">Polars & Parquet Ingestion</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Upload CSV, Excel, or TSV files. The Data Engine converts them into standardized, columnar Parquet tables. This reduces storage by up to 90% and ensures lightning-fast queries.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-zinc-900/30 border border-zinc-800/40 p-8 rounded-2xl hover:border-zinc-850 hover:bg-zinc-900/50 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
                  <GitMerge size={22} />
                </div>
                <h3 className="text-xl font-bold text-zinc-200 mb-3">Auto-Relationship Discovery</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Our system scans data profiles, naming formats, and cardinality overlaps to automatically identify relationships (Primary Key/Foreign Key) across separate spreadsheets.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Engine Technology Section */}
        <section id="engine" className="py-24 px-6 border-t border-zinc-900 relative">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            <div className="lg:col-span-6 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
                <Zap size={12} />
                High-Performance Core
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-zinc-100 tracking-tight">
                Powered by DuckDB & Columnar Storage
              </h2>
              <p className="text-zinc-400 leading-relaxed">
                Traditional platforms read spreadsheets row-by-row, which is slow and memory-intensive. DataWeaver parses files using Polars and exposes them to DuckDB via memory mapping. 
              </p>
              <ul className="space-y-3.5 text-zinc-300 text-sm font-medium">
                <li className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0"><Check size={12} /></span>
                  Query millions of rows in milliseconds
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0"><Check size={12} /></span>
                  Strict local privacy — your business logic stays isolated
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0"><Check size={12} /></span>
                  Join separate CSV and Google Sheets in one query
                </li>
              </ul>
            </div>

            <div className="lg:col-span-6">
              <div className="bg-zinc-900/30 border border-zinc-800/55 p-6 rounded-2xl space-y-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block">Performance Benchmark (Seconds)</span>
                <div className="space-y-4 pt-2">
                  <div>
                    <div className="flex justify-between text-xs font-mono text-zinc-400 mb-1">
                      <span>Row-based Python Parsing (Pandas)</span>
                      <span>12.4s</span>
                    </div>
                    <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="bg-red-500/50 h-full rounded-full" style={{ width: "95%" }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-mono text-zinc-400 mb-1">
                      <span>Standard SQL Database Ingestion</span>
                      <span>4.8s</span>
                    </div>
                    <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="bg-yellow-500/50 h-full rounded-full" style={{ width: "40%" }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-mono text-zinc-300 mb-1">
                      <span className="font-bold text-emerald-400">DataWeaver (Polars + DuckDB)</span>
                      <span className="font-bold text-emerald-400">0.24s</span>
                    </div>
                    <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="bg-emerald-400 h-full rounded-full" style={{ width: "4%" }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-24 px-6 border-t border-zinc-900 bg-zinc-900/10">
          <div className="max-w-7xl mx-auto space-y-16">
            <div className="text-center max-w-2xl mx-auto space-y-4">
              <h2 className="text-3xl md:text-4xl font-bold text-zinc-100">Simple, Transparent Pricing</h2>
              <p className="text-base text-zinc-400">Start analyzing your datasets for free, and scale as your requirements expand.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Free Tier */}
              <div className="bg-zinc-950 border border-zinc-800 p-8 rounded-2xl space-y-6 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="text-sm font-semibold text-zinc-400 uppercase tracking-widest">Free Plan</div>
                  <div className="text-4xl font-black text-zinc-100">$0<span className="text-sm font-normal text-zinc-500"> / month</span></div>
                  <p className="text-sm text-zinc-400">For individual analysts, developers, and practitioners seeking fast spreadsheet analysis.</p>
                  <hr className="border-zinc-800/80 my-4" />
                  <ul className="space-y-3 text-xs text-zinc-300 font-medium">
                    <li className="flex items-center gap-2"><Check size={14} className="text-indigo-400" /> Unlimited Local Workspaces</li>
                    <li className="flex items-center gap-2"><Check size={14} className="text-indigo-400" /> CSV, TSV, and Excel File Uploads</li>
                    <li className="flex items-center gap-2"><Check size={14} className="text-indigo-400" /> Full Google Sheets Integration</li>
                    <li className="flex items-center gap-2"><Check size={14} className="text-indigo-400" /> 2 GB File Ingestion Limit</li>
                  </ul>
                </div>
                <button
                  onClick={() => signInWithGoogle("/workspaces")}
                  className="w-full py-2.5 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900 hover:bg-zinc-800/60 text-zinc-200 font-semibold text-sm transition-colors mt-6"
                >
                  Get Started Free
                </button>
              </div>

              {/* Pro Tier */}
              <div className="bg-zinc-950 border-2 border-indigo-500/50 p-8 rounded-2xl space-y-6 flex flex-col justify-between relative shadow-2xl shadow-indigo-500/5">
                <div className="absolute top-0 right-6 -translate-y-1/2 bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-indigo-400/20">
                  Most Popular
                </div>
                <div className="space-y-4">
                  <div className="text-sm font-semibold text-indigo-400 uppercase tracking-widest">Pro Plan</div>
                  <div className="text-4xl font-black text-zinc-100">$29<span className="text-sm font-normal text-zinc-500"> / month</span></div>
                  <p className="text-sm text-zinc-400">For teams needing permanent storage, advanced data visualizations, and database integrations.</p>
                  <hr className="border-zinc-800/80 my-4" />
                  <ul className="space-y-3 text-xs text-zinc-300 font-medium">
                    <li className="flex items-center gap-2"><Check size={14} className="text-indigo-400" /> Everything in Free</li>
                    <li className="flex items-center gap-2"><Check size={14} className="text-indigo-400" /> Unlimited Upload File Size</li>
                    <li className="flex items-center gap-2"><Check size={14} className="text-indigo-400" /> Advanced Chart Customizer & Dashboards</li>
                    <li className="flex items-center gap-2"><Check size={14} className="text-indigo-400" /> Remote Storage Connections (AWS S3, Postgres)</li>
                  </ul>
                </div>
                <button
                  onClick={() => signInWithGoogle("/workspaces")}
                  className="w-full py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-sm transition-colors mt-6 shadow-md shadow-indigo-500/20"
                >
                  Sign Up (Coming Soon)
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Final Call to Action */}
        <section className="py-24 px-6 border-t border-zinc-900 relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
          <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-zinc-100 leading-tight">
              Ready to weave your spreadsheets into actionable insights?
            </h2>
            <p className="text-lg text-zinc-400 max-w-xl mx-auto">
              Get setup in 30 seconds. Ingest your spreadsheets, link your datasets, and query them naturally.
            </p>
            <button
              onClick={() => signInWithGoogle("/workspaces")}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white hover:bg-zinc-100 text-zinc-950 font-bold text-base transition-colors shadow-xl"
            >
              Sign in with Google <ArrowRight size={18} />
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-zinc-900 py-12 px-6 bg-zinc-950 text-zinc-500 text-sm">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="DataWeaver Logo" className="w-6 h-6 rounded-md object-cover border border-zinc-800" />
              <span className="font-bold text-zinc-300">DataWeaver (DW)</span>
            </div>
            <div>&copy; {new Date().getFullYear()} DataWeaver. All rights reserved.</div>
            <div className="flex gap-6">
              <a href="#features" className="hover:text-zinc-300 transition-colors">Features</a>
              <a href="#pricing" className="hover:text-zinc-300 transition-colors">Pricing</a>
              <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-zinc-300 transition-colors">GitHub</a>
            </div>
          </div>
        </footer>
      </div>
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
