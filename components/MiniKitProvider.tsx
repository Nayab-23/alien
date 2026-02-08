"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { MiniKit } from "@worldcoin/minikit-js";

type AuthContextType = {
  isAuthenticated: boolean;
  user: { id: number; alienSubject: string } | null;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  user: null,
  isLoading: true,
  signIn: async () => {},
  signOut: () => {},
});

export function MiniKitProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ id: number; alienSubject: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_APP_ID;
    if (appId) {
      MiniKit.install(appId);
    } else {
      console.warn("NEXT_PUBLIC_APP_ID not set, MiniKit will not initialize");
    }

    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch("/api/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setIsAuthenticated(true);
      }
    } catch {
      // Expected to fail when not authenticated
    } finally {
      setIsLoading(false);
    }
  }

  async function signIn() {
    setIsLoading(true);
    try {
      // 1. Get nonce
      const nonceRes = await fetch("/api/nonce");
      if (!nonceRes.ok) {
        const errText = await nonceRes.text();
        throw new Error(`Failed to get nonce: ${errText}`);
      }
      const { nonce } = await nonceRes.json();

      // 2. Sign with MiniKit
      const { finalPayload } = await MiniKit.commandsAsync.walletAuth({ nonce });

      if (finalPayload.status === "error") {
        throw new Error(finalPayload.error_code);
      }

      // 3. Verify signature on backend
      const authRes = await fetch("/api/auth/siwe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: finalPayload, nonce }),
      });

      if (!authRes.ok) {
        const errText = await authRes.text();
        throw new Error(`Authentication failed: ${errText}`);
      }

      const { user: authenticatedUser } = await authRes.json();
      setUser(authenticatedUser);
      setIsAuthenticated(true);
    } catch (err) {
      console.error("Sign in failed:", err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  function signOut() {
    setUser(null);
    setIsAuthenticated(false);
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
