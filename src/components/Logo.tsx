import { Link } from "react-router-dom";

export function Mark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#0E1117" />
      <path d="M7 23 L13 9 H17 L11 23 Z" fill="#FF4D14" />
      <path d="M15 23 L21 9 H25 L19 23 Z" fill="#FFB800" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2.5 ${className}`}>
      <Mark />
      <span className="font-display text-xl font-extrabold tracking-tightest text-white">
        in<span className="text-ignition">motu</span>
      </span>
    </Link>
  );
}
