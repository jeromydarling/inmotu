import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { PublicUser } from "@shared/types";
import { api } from "../api/client";

export interface Capabilities {
  plan: string;
  role: string;
  can: Record<string, boolean>;
  riderLimit: number | null;
}

interface AuthCtx {
  user: PublicUser | null;
  caps: Capabilities | null;
  loading: boolean;
  setUser: (u: PublicUser | null) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const { user } = await api.me();
      setUser(user);
      if (user) {
        setCaps(await api.capabilities().catch(() => null));
      } else {
        setCaps(null);
      }
    } catch {
      setUser(null);
      setCaps(null);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await api.logout();
    setUser(null);
    setCaps(null);
  }

  // Setting a user (after login/register/demo) refreshes their capabilities.
  function setUserAndCaps(u: PublicUser | null) {
    setUser(u);
    if (u) api.capabilities().then(setCaps).catch(() => setCaps(null));
    else setCaps(null);
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <Ctx.Provider value={{ user, caps, loading, setUser: setUserAndCaps, refresh, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
