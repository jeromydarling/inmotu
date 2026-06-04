import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./state/auth";
import { ToastProvider } from "./state/toast";
import { ConfigProvider } from "./state/config";
import { initSentry } from "./lib/sentry";
import App from "./App";
import "./index.css";

initSentry();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <ConfigProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ConfigProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);

// Register the service worker (PWA install, offline shell, web push).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
