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
    // Install MiniKit
    MiniKit.install();

    // Check if already authenticated
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
    } catch (err) {
      console.error("Auth check failed:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function signIn() {
    setIsLoading(true);
    try {
      // 1. Get nonce
      const nonceRes = await fetch("/api/nonce");
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
        throw new Error("Authentication failed");
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
    // Clear cookies by calling logout endpoint if needed
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
