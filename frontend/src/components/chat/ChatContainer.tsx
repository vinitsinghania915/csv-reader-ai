"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ChatMessage, { ChatMessageProps } from "./ChatMessage";
import ChatInput from "./ChatInput";
import { Bot } from "lucide-react";

import { API_URL, apiJson } from "@/lib/api";

interface ChatContainerProps {
  workspaceId: string;
}

type ServerMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sql?: string | null;
  chart_config?: unknown;
};

const sessionKey = (workspaceId: string) => `chat:${workspaceId}:conversation_id`;

export default function ChatContainer({ workspaceId }: ChatContainerProps) {
  const router = useRouter();
  const search = useSearchParams();
  const urlConv = search?.get("conv") || null;

  const [messages, setMessages] = useState<ChatMessageProps[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(urlConv);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Resolve the "active" conversation: URL wins; otherwise fall back to
  // sessionStorage (so a hard-refresh on /workspaces/<id> lands you back
  // in your last conversation). "New chat" = visit the URL with no ?conv.
  useEffect(() => {
    if (urlConv) {
      setConversationId(urlConv);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(sessionKey(workspaceId), urlConv);
      }
      return;
    }
    if (typeof window === "undefined") return;
    const stored = window.sessionStorage.getItem(sessionKey(workspaceId));
    if (stored) {
      // Reflect stored conv into the URL so sidebar highlighting + share/reload work.
      router.replace(`/workspaces/${workspaceId}?conv=${encodeURIComponent(stored)}`);
    } else {
      setConversationId(null);
      setMessages([]);
    }
  }, [urlConv, workspaceId, router]);

  // Whenever the resolved conversationId changes, fetch its messages.
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    apiJson<{ id: string | null; messages: ServerMessage[] }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/chat/conversations/${encodeURIComponent(conversationId)}`
    )
      .then((data) => {
        if (cancelled) return;
        if (!data.id) {
          if (typeof window !== "undefined") {
            window.sessionStorage.removeItem(sessionKey(workspaceId));
          }
          setConversationId(null);
          setMessages([]);
          return;
        }
        setMessages(
          data.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            sql: m.sql || undefined,
            chart_config: m.chart_config as ChatMessageProps["chart_config"],
          }))
        );
      })
      .catch(() => {
        /* non-fatal — start fresh */
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId, workspaceId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const broadcastConversationsChanged = useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("conversations:changed", { detail: { workspaceId } }));
    }
  }, [workspaceId]);

  const handleSendMessage = async (text: string) => {
    const userMsgId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: userMsgId, role: "user", content: text }]);
    setIsLoading(true);

    const wasNew = !conversationId;

    try {
      const response = await fetch(`${API_URL}/workspaces/${workspaceId}/chat`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          ...(conversationId ? { conversation_id: conversationId } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();

      if (data.conversation_id) {
        setConversationId(data.conversation_id);
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(sessionKey(workspaceId), data.conversation_id);
        }
        if (wasNew) {
          router.replace(
            `/workspaces/${workspaceId}?conv=${encodeURIComponent(data.conversation_id)}`
          );
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.answer,
          sql: data.sql,
          chart_config: data.chart_config,
          data: data.data,
        },
      ]);

      if (wasNew) broadcastConversationsChanged();
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "Sorry, I ran into an error while analyzing your request. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 mb-24 pb-32" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto opacity-70">
            <div className="w-16 h-16 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center mb-6 border border-indigo-500/20 shadow-[0_0_30px_rgba(99,102,241,0.15)]">
              <Bot size={32} />
            </div>
            <h3 className="text-xl font-medium text-zinc-200 mb-2">How can I help you?</h3>
            <p className="text-sm text-zinc-400">
              Ask questions about your data, request specific metrics, or ask for trends and charts.
            </p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto flex flex-col w-full px-2">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} {...msg} workspaceId={workspaceId} />
            ))}

            {isLoading && (
              <div className="flex gap-4 w-full py-6 bg-zinc-900/20 border-y border-zinc-800/50">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Bot size={16} />
                </div>
                <div className="flex-1 flex items-center h-8">
                  <div className="flex space-x-1.5 items-center">
                    <div className="w-2 h-2 rounded-full bg-emerald-500/50 animate-bounce" style={{ animationDelay: "0ms" }}></div>
                    <div className="w-2 h-2 rounded-full bg-emerald-500/50 animate-bounce" style={{ animationDelay: "150ms" }}></div>
                    <div className="w-2 h-2 rounded-full bg-emerald-500/50 animate-bounce" style={{ animationDelay: "300ms" }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 md:left-60 right-0 p-4 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent pb-6 pt-10">
        <ChatInput onSend={handleSendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
}
