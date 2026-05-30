import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../api/client";

interface AppConfig {
  mapboxToken: string | null;
  loaded: boolean;
}

const Ctx = createContext<AppConfig>({ mapboxToken: null, loaded: false });

// Fetches /api/meta/config once for the whole app (the Mapbox token never
// changes per session), instead of refetching on every MapView mount.
export function ConfigProvider({ children }: { children: ReactNode }) {
  const [cfg, setCfg] = useState<AppConfig>({ mapboxToken: null, loaded: false });
  useEffect(() => {
    api
      .config()
      .then((c) => setCfg({ mapboxToken: c.mapbox_token || null, loaded: true }))
      .catch(() => setCfg({ mapboxToken: null, loaded: true }));
  }, []);
  return <Ctx.Provider value={cfg}>{children}</Ctx.Provider>;
}

export const useConfig = () => useContext(Ctx);
