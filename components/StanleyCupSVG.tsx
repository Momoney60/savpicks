// Inline SVG Stanley Cup — no PNG dependency, scales cleanly, theme-aware.
export default function StanleyCupSVG({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 80 130"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Stanley Cup"
    >
      <defs>
        <linearGradient id="cupSilver" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f1f5f9" />
          <stop offset="35%" stopColor="#cbd5e1" />
          <stop offset="65%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
        <linearGradient id="cupHighlight" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.25" />
        </linearGradient>
      </defs>

      <g stroke="#0f172a" strokeWidth="0.6" strokeLinejoin="round">
        <path d="M 14 6 Q 14 26 26 30 L 26 38 L 54 38 L 54 30 Q 66 26 66 6 Z" fill="url(#cupSilver)" />
        <ellipse cx="40" cy="6" rx="26" ry="5" fill="url(#cupSilver)" />
        <ellipse cx="40" cy="6" rx="20" ry="3" fill="#0f172a" opacity="0.35" />

        <rect x="30" y="36" width="20" height="14" fill="url(#cupSilver)" />
        <rect x="28" y="48" width="24" height="2" fill="#475569" />

        <g fill="url(#cupSilver)">
          <rect x="18" y="50" width="44" height="12" />
          <rect x="16" y="63" width="48" height="12" />
          <rect x="14" y="76" width="52" height="12" />
          <rect x="12" y="89" width="56" height="12" />
          <rect x="10" y="102" width="60" height="12" />
        </g>
        <g fill="#475569">
          <rect x="18" y="62" width="44" height="1" />
          <rect x="16" y="75" width="48" height="1" />
          <rect x="14" y="88" width="52" height="1" />
          <rect x="12" y="101" width="56" height="1" />
          <rect x="10" y="114" width="60" height="1" />
        </g>

        <rect x="8" y="115" width="64" height="6" fill="url(#cupSilver)" />
        <ellipse cx="40" cy="123" rx="32" ry="3" fill="#475569" />
      </g>

      <path d="M 14 6 Q 14 26 26 30 L 26 38 L 54 38 L 54 30 Q 66 26 66 6 Z" fill="url(#cupHighlight)" />
    </svg>
  );
}