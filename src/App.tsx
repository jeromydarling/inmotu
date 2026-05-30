import { Routes, Route, Outlet, Navigate, useLocation } from "react-router-dom";
import { Header, Footer } from "./components/Layout";
import { useAuth } from "./state/auth";
import { Spinner } from "./components/ui";

import Landing from "./pages/Landing";
import Grid from "./pages/Grid";
import EventDetail from "./pages/EventDetail";
import Tracks from "./pages/Tracks";
import TrackDetail from "./pages/TrackDetail";
import Frontline from "./pages/Frontline";
import Pricing from "./pages/Pricing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";

function Shell() {
  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function Protected() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading)
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<Landing />} />
        <Route path="/grid" element={<Grid />} />
        <Route path="/events/:slug" element={<EventDetail />} />
        <Route path="/tracks" element={<Tracks />} />
        <Route path="/tracks/:slug" element={<TrackDetail />} />
        <Route path="/frontline" element={<Frontline />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<Protected />}>
          <Route path="/app" element={<Dashboard />} />
          <Route path="/app/*" element={<Dashboard />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

function NotFound() {
  return (
    <div className="container-page flex flex-col items-center justify-center py-32 text-center">
      <div className="font-display text-7xl font-black text-ignition">404</div>
      <p className="mt-2 text-white/60">This stretch of track doesn't exist.</p>
    </div>
  );
}
