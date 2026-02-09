"use client";

import { AlienProvider, useAlien } from "@alien_org/react";
import { createContext, useContext, useEffect, useState } from "react";
import { isDemoMode } from "@/lib/demoMode";

type AuthContextType = {
  isAuthenticated: boolean;
  user: { id: number; alienId: string } | null;
  isLoading: boolean;
  authToken: string | null;
};

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  user: null,
  isLoading: true,
  authToken: null,
});

function AuthBridge({ children }: { children: React.ReactNode }) {
  const { authToken, isBridgeAvailable } = useAlien();
  const [user, setUser] = useState<{ id: number; alienId: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authToken) {
      setIsLoading(false);
      return;
    }

    fetchUser(authToken);
  }, [authToken]);

  async function fetchUser(token: string) {
    try {
      const res = await fetch("/api/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch {
      // Expected to fail when not authenticated
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!user,
        user,
        isLoading: isLoading || (!isBridgeAvailable && !authToken),
        authToken: authToken ?? null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function MiniKitProvider({ children }: { children: React.ReactNode }) {
  if (isDemoMode()) {
    return (
      <AuthContext.Provider
        value={{
          isAuthenticated: true,
          user: { id: 1, alienId: "demo:you" },
          isLoading: false,
          authToken: "demo",
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  }
  return (
    <AlienProvider>
      <AuthBridge>{children}</AuthBridge>
    </AlienProvider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
