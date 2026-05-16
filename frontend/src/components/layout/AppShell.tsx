"use client";

import { Suspense, useState } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";
import MainContent from "./MainContent";
import { useCurrentUser } from "@/lib/auth";

export default function AppShell({ children, workspaceId = null }: { children: React.ReactNode; workspaceId?: string | null }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user } = useCurrentUser();
  const showSidebar = Boolean(user);

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      {/* Sidebar only renders when signed in. Suspense is required because
          Sidebar reads useSearchParams, which bails out of prerendering. */}
      {showSidebar && (
        <Suspense fallback={null}>
          <Sidebar isOpen={sidebarOpen} toggle={() => setSidebarOpen(!sidebarOpen)} workspaceId={workspaceId} />
        </Suspense>
      )}

      <div className="flex flex-col flex-1 overflow-hidden">
        <Header
          sidebarOpen={sidebarOpen}
          toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          showSidebarToggle={showSidebar}
        />
        <MainContent>{children}</MainContent>
      </div>
    </div>
  );
}
