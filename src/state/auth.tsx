import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { PublicUser } from "@shared/types";
import { api } from "../api/client";

interface AuthCtx {
  user: PublicUser | null;
  loading: boolean;
  setUser: (u: PublicUser | null) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const { user } = await api.me();
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await api.logout();
    setUser(null);
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, setUser, refresh, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
