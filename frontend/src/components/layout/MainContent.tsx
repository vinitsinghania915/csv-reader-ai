"use client";

import { motion } from "framer-motion";

export default function MainContent({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 overflow-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900/40 via-zinc-950 to-zinc-950 p-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="h-full w-full max-w-7xl mx-auto"
      >
        {children}
      </motion.div>
    </main>
  );
}
