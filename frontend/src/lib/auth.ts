"use client";

import { useCallback, useEffect, useState } from "react";
import { API_URL, apiJson } from "./api";

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
};

export function signInWithGoogle(next: string = "/workspaces"): void {
  // Full-page redirect so the OAuth round-trip returns into the backend,
  // which finishes with a 302 back to FRONTEND_URL and sets the session cookie.
  const url = `${API_URL}/auth/google/login?next=${encodeURIComponent(next)}`;
  window.location.href = url;
}

export async function signOut(): Promise<void> {
  await apiJson<{ ok: boolean }>("/auth/logout", { method: "POST" });
  window.location.href = "/";
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      const data = await apiJson<{ user: CurrentUser | null }>("/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { user, refresh, isLoading: user === undefined };
}
