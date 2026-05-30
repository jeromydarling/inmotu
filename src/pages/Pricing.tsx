import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiErr } from "../api/client";
import { Badge } from "../components/ui";
import { Reveal } from "../components/motion";
import { useAuth } from "../state/auth";
import { useToast } from "../state/toast";

const tiers = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    cadence: "forever",
    tagline: "Your place in the paddock, on us.",
    features: [
      "Full event calendar & registration deadlines",
      "1 rider profile",
      "Track directory & endangered map",
      "Right to Race advocacy tools",
    ],
    cta: "Start free",
    highlight: false,
  },
  {
    id: "family",
    name: "Family",
    price: "$9.99",
    cadence: "/mo · or $79/yr",
    tagline: "The TeamSnap for racing families.",
    features: [
      "Unlimited rider profiles",
      "Road to the Ranch ladder tracker",
      "Budget tracker & maintenance logs",
      "Season photo timeline & yearbook",
      "Event updates from your tracks",
    ],
    cta: "Upgrade to Family",
    highlight: true,
  },
  {
    id: "pro",
    name: "Pro / Team",
    price: "$19.99",
    cadence: "/mo",
    tagline: "Team ops that rival the pros.",
    features: [
      "Everything in Family",
      "The Garage: setup database",
      "Endurance stint planner",
      "Sponsorship portfolio manager",
      "Multi-rider team management",
    ],
    cta: "Upgrade to Pro",
    highlight: false,
  },
  {
    id: "tower",
    name: "The Tower",
    price: "from $49",
    cadence: "/mo · operators",
    tagline: "Run your track like a business.",
    features: [
      "Online event registration",
      "Series points & live standings",
      "Sponsor management",
      "Communication center",
      "Economic impact reports",
    ],
    cta: "Talk to us",
    highlight: false,
  },
];

export default function Pricing() {
  const { user, caps } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [msg, setMsg] = useState<string | null>(null);
  const currentPlan = caps?.plan ?? "free";

  async function choose(id: string) {
    if (id === "free") {
      nav(user ? "/app" : "/register");
      return;
    }
    if (!user) {
      nav("/register");
      return;
    }
    try {
      const { url } = await api.checkout(id);
      if (url) window.location.href = url;
    } catch (e) {
      if (e instanceof ApiErr && e.code === "billing_not_configured") {
        setMsg("Checkout will open once Stripe billing is enabled. Hang tight — we're almost there.");
      } else {
        toast.error(e instanceof Error ? e.message : "Couldn't start checkout. Try again.");
      }
    }
  }

  return (
    <div className="container-page py-14">
      <div className="mx-auto max-w-2xl text-center">
        <p className="eyebrow">Pricing</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tightest sm:text-5xl">
          Built to rival pro tools. Priced for the paddock.
        </h1>
        <p className="mt-3 text-white/55">
          The calendar and the cause are free forever — that part belongs to everyone. Upgrade when
          your family or team is ready for more.
        </p>
      </div>

      {msg && (
        <div className="mx-auto mt-6 max-w-2xl rounded-xl border border-amber/30 bg-amber/10 px-4 py-3 text-center text-sm text-amber-400">
          {msg}
        </div>
      )}

      <div className="mt-10 grid gap-4 lg:grid-cols-4">
        {tiers.map((t, i) => {
          const isCurrent = user != null && t.id === currentPlan;
          return (
          <Reveal key={t.id} delay={i * 80} className="h-full">
          <div
            className={`panel relative flex h-full flex-col p-6 transition duration-300 hover:-translate-y-1 ${
              isCurrent ? "border-flag-green/40" : t.highlight ? "border-ignition/40 shadow-glow" : "hover:border-white/20"
            }`}
          >
            {isCurrent ? (
              <div className="absolute -top-3 left-6">
                <Badge tone="green">Your plan</Badge>
              </div>
            ) : t.highlight ? (
              <div className="absolute -top-3 left-6">
                <Badge tone="live">Most popular</Badge>
              </div>
            ) : null}
            <h3 className="font-display text-xl font-extrabold">{t.name}</h3>
            <p className="mt-1 text-xs text-white/45">{t.tagline}</p>
            <div className="mt-4 flex items-end gap-1">
              <span className="font-display text-3xl font-black">{t.price}</span>
              <span className="mb-1 text-xs text-white/40">{t.cadence}</span>
            </div>
            <ul className="mt-5 flex-1 space-y-2.5">
              {t.features.map((f) => (
                <li key={f} className="flex gap-2 text-sm text-white/65">
                  <span className="text-ignition">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => choose(t.id)}
              disabled={isCurrent}
              className={`${t.highlight && !isCurrent ? "btn-primary" : "btn-ghost"} mt-6 w-full`}
            >
              {isCurrent ? "Current plan" : t.cta}
            </button>
          </div>
          </Reveal>
          );
        })}
      </div>

      <div className="mx-auto mt-10 max-w-2xl text-center text-sm text-white/40">
        Operators also pay just <span className="text-white/70">1.5% per registration</span> —
        below the incumbents — so migrating from free Facebook events is a no-brainer.{" "}
        <Link to="/register" className="text-ignition">
          Get started
        </Link>
        .
      </div>
    </div>
  );
}
