import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Logo, Mark } from "./Logo";
import { useAuth } from "../state/auth";
import { NotificationBell } from "./NotificationBell";

const navItems = [
  { to: "/grid", label: "The Grid" },
  { to: "/map", label: "Map" },
  { to: "/tracks", label: "Tracks" },
  { to: "/standings", label: "Standings" },
  { to: "/frontline", label: "Frontline" },
  { to: "/rules", label: "Rules" },
  { to: "/pricing", label: "Pricing" },
];

export function Header() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-carbon-950/80 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive ? "text-white" : "text-white/55 hover:text-white"
                  }`
                }
              >
                {i.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              <NotificationBell />
              <Link to="/app" className="btn-ghost btn-sm">
                Dashboard
              </Link>
              <button
                onClick={async () => {
                  await logout();
                  nav("/");
                }}
                className="btn-ghost btn-sm"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost btn-sm">
                Sign in
              </Link>
              <Link to="/demo" className="btn-ghost btn-sm">
                Try demo
              </Link>
              <Link to="/register" className="btn-primary btn-sm">
                Start free
              </Link>
            </>
          )}
        </div>

        <button
          className="btn-ghost btn-sm md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
        >
          ☰
        </button>
      </div>

      {open && (
        <div className="border-t border-white/[0.06] md:hidden">
          <div className="container-page flex flex-col gap-1 py-3">
            {navItems.map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-white/70"
              >
                {i.label}
              </NavLink>
            ))}
            <div className="mt-2 flex gap-2">
              {user ? (
                <Link to="/app" className="btn-primary btn-sm flex-1" onClick={() => setOpen(false)}>
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link to="/login" className="btn-ghost btn-sm flex-1" onClick={() => setOpen(false)}>
                    Sign in
                  </Link>
                  <Link to="/register" className="btn-primary btn-sm flex-1" onClick={() => setOpen(false)}>
                    Start free
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-24 border-t border-white/[0.06]">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2">
            <Mark className="h-6 w-6" />
            <span className="font-display text-lg font-extrabold">
              in<span className="text-ignition">motu</span>
            </span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-white/45">
            A home for the whole racing family. Built for the people in the pits, the tracks they
            gather at, and everyone they hand it down to.
          </p>
        </div>
        <FooterCol
          title="Product"
          links={[
            ["The Grid", "/grid"],
            ["Tracks", "/tracks"],
            ["Frontline", "/frontline"],
            ["Pricing", "/pricing"],
          ]}
        />
        <FooterCol
          title="Community"
          links={[
            ["Right to Race", "/frontline"],
            ["Endangered Tracks", "/frontline"],
            ["For Operators", "/pricing"],
          ]}
        />
        <FooterCol
          title="Account"
          links={[
            ["Sign in", "/login"],
            ["Start free", "/register"],
            ["Dashboard", "/app"],
          ]}
        />
      </div>
      <div className="border-t border-white/[0.06]">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-xs text-white/35 sm:flex-row">
          <span>© {new Date().getFullYear()} inmotu. Nobody races alone.</span>
          <span className="font-mono">inmotu.pro · built on Cloudflare's edge</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-white/40">{title}</h4>
      <ul className="space-y-2">
        {links.map(([label, to]) => (
          <li key={label + to}>
            <Link to={to} className="text-sm text-white/55 transition hover:text-white">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
