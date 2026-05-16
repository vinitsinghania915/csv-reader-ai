"use client";

import { useState } from "react";
import { User, Bot, Code, Terminal, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import Visualizer from "./Visualizer";
import PinToDashboardButton from "@/components/dashboard/PinToDashboardButton";

export type MessageRole = "user" | "assistant";

export interface ChatMessageProps {
  id: string;
  role: MessageRole;
  content: string;
  sql?: string;
  chart_config?: any;
  data?: any[];
  workspaceId?: string;
}

export default function ChatMessage({ role, content, sql, chart_config, data, workspaceId }: ChatMessageProps) {
  const isUser = role === "user";
  const [showSql, setShowSql] = useState(false);

  return (
    <div className={clsx("flex gap-4 w-full py-6", isUser ? "" : "bg-zinc-900/20 border-y border-zinc-800/50")}>
      <div className={clsx(
        "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border",
        isUser 
          ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" 
          : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
      )}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="font-medium text-sm text-zinc-300 mb-1">
          {isUser ? "You" : "CSV Reader AI"}
        </div>
        
        <div className="text-zinc-100 text-[15px] leading-relaxed break-words whitespace-pre-wrap">
          {content}
        </div>

        {/* SQL Query Toggle + Pin to dashboard */}
        {sql && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowSql(!showSql)}
              className="flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors bg-zinc-800/50 px-3 py-1.5 rounded-md border border-zinc-700/50"
            >
              <Terminal size={14} />
              <span>{showSql ? "Hide generated SQL" : "View generated SQL"}</span>
              {showSql ? <ChevronUp size={14} className="ml-1" /> : <ChevronDown size={14} className="ml-1" />}
            </button>
            {!isUser && workspaceId && (
              <PinToDashboardButton
                workspaceId={workspaceId}
                defaultTitle={content.slice(0, 80)}
                sql={sql}
                chartConfig={chart_config}
              />
            )}
            
            <AnimatePresence>
              {showSql && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mt-3"
                >
                  <div className="bg-zinc-950 rounded-lg p-4 border border-zinc-800 overflow-x-auto relative group">
                    <div className="absolute top-2 right-2 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Code size={16} />
                    </div>
                    <pre className="text-sm text-indigo-300 font-mono">
                      <code>{sql}</code>
                    </pre>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Visualizer */}
        {chart_config && data && data.length > 0 && (
          <div className="mt-4">
            <Visualizer config={chart_config} data={data} />
          </div>
        )}
      </div>
    </div>
  );
}
