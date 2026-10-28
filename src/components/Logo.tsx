export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#0b1b3f" />
      <path d="M16 30a22 22 0 0 1 32 0" fill="none" stroke="#3ee6b5" strokeWidth="5" strokeLinecap="round" />
      <path d="M23 37a12 12 0 0 1 18 0" fill="none" stroke="#3ee6b5" strokeWidth="5" strokeLinecap="round" />
      <circle cx="32" cy="45" r="4.5" fill="#ffffff" />
    </svg>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      <span className={`font-display text-[17px] font-extrabold tracking-tight ${light ? "text-white" : "text-navy-900"}`}>
        Shop Cheap <span className={light ? "text-mint-400" : "text-mint-600"}>Internet</span>
      </span>
    </span>
  );
}
