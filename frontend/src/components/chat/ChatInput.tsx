"use client";

import { useState, useRef, useEffect } from "react";
import { Send, CornerDownLeft, Sparkles } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export default function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "inherit";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = () => {
    if (input.trim() && !isLoading) {
      onSend(input.trim());
      setInput("");
      // Reset height
      if (textareaRef.current) {
        textareaRef.current.style.height = "inherit";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      <div className="absolute -top-10 left-0 right-0 flex justify-center opacity-0 hover:opacity-100 transition-opacity">
        <div className="bg-zinc-800/80 backdrop-blur-sm text-xs text-zinc-400 px-3 py-1 rounded-full flex items-center gap-1.5 border border-zinc-700/50">
          <Sparkles size={12} className="text-indigo-400" />
          <span>Ask anything about your data...</span>
        </div>
      </div>
      
      <div className="relative glass-card shadow-[0_-10px_40px_rgba(0,0,0,0.2)] flex items-end p-2 transition-all focus-within:border-indigo-500/50 focus-within:shadow-[0_0_30px_rgba(99,102,241,0.15)]">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What are the top 5 products by revenue?"
          className="w-full max-h-48 min-h-[44px] bg-transparent text-zinc-100 placeholder:text-zinc-500 resize-none outline-none py-2.5 px-4 block"
          disabled={isLoading}
          rows={1}
        />
        
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || isLoading}
          className="shrink-0 mb-1 mr-1 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-lg transition-all flex items-center justify-center h-10 w-10 disabled:cursor-not-allowed group"
        >
          {isLoading ? (
            <div className="w-4 h-4 rounded-full border-2 border-zinc-300 border-t-transparent animate-spin" />
          ) : (
            <Send size={18} className="transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          )}
        </button>
      </div>
      <div className="text-center mt-2">
         <span className="text-[11px] text-zinc-500 flex items-center justify-center gap-1">
           Press <CornerDownLeft size={10} className="inline" /> Enter to send, Shift+Enter for new line
         </span>
      </div>
    </div>
  );
}
