/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Sentry DSN for client-side error + replay reporting (federation-wide). */
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
