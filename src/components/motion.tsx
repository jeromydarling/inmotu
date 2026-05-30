import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type ElementType,
} from "react";

const reduce =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Fade + slide an element into view when it scrolls onscreen. */
export function Reveal({
  children,
  className = "",
  delay = 0,
  as: Tag = "div",
  y = 18,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: ElementType;
  y?: number;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(reduce);

  useEffect(() => {
    if (reduce) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as any}
      className={className}
      style={{
        transition: "opacity .7s cubic-bezier(.16,1,.3,1), transform .7s cubic-bezier(.16,1,.3,1)",
        transitionDelay: `${delay}ms`,
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : `translateY(${y}px)`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </Tag>
  );
}

/** Count a number up from 0 when it enters the viewport. */
export function CountUp({
  to,
  duration = 1400,
  suffix = "",
  prefix = "",
}: {
  to: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [val, setVal] = useState(reduce ? to : 0);

  useEffect(() => {
    if (reduce) return;
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setVal(Math.round(eased * to));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {val.toLocaleString()}
      {suffix}
    </span>
  );
}

/** Infinite horizontal ticker. Children are duplicated for a seamless loop. */
export function Marquee({
  children,
  className = "",
  reverse = false,
  speed = "marquee",
}: {
  children: ReactNode;
  className?: string;
  reverse?: boolean;
  speed?: "marquee" | "marquee-slow";
}) {
  return (
    <div className={`group flex overflow-hidden ${className}`}>
      <div
        className={`flex shrink-0 items-center gap-8 pr-8 ${
          reverse ? "animate-marquee-rev" : `animate-${speed}`
        } group-hover:[animation-play-state:paused]`}
      >
        {children}
        {children}
      </div>
    </div>
  );
}

/**
 * AI-generated image (served from /api/img/:slug). Renders over a brand
 * gradient and fades in once the photographic layer loads, so it always
 * looks intentional — even before Workers AI has warmed the cache.
 */
export function AiImage({
  slug,
  className = "",
  imgClassName = "",
  kenBurns = false,
  overlay = true,
}: {
  slug: string;
  className?: string;
  imgClassName?: string;
  kenBurns?: boolean;
  overlay?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={`relative overflow-hidden bg-carbon-850 ${className}`}>
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,#1a0f0a,transparent_60%)]" />
      <img
        src={`/api/img/${slug}`}
        alt=""
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`h-full w-full object-cover transition-[opacity,transform] duration-1000 ${
          loaded ? "opacity-100" : "opacity-0"
        } ${kenBurns ? "animate-ken-burns" : ""} ${imgClassName}`}
      />
      {overlay && (
        <div className="absolute inset-0 bg-gradient-to-t from-carbon-950 via-carbon-950/30 to-transparent" />
      )}
    </div>
  );
}

/** Decorative diagonal speed streaks that drift across a section. */
export function SpeedLines({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="absolute h-px w-40 animate-drift bg-gradient-to-r from-transparent via-ignition/50 to-transparent"
          style={{
            top: `${12 + i * 18}%`,
            animationDelay: `${i * 1.3}s`,
            animationDuration: `${6 + i}s`,
          }}
        />
      ))}
    </div>
  );
}
