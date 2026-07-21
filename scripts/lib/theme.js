// shadcn/ui-inspired design tokens (zinc palette, dark mode)
// Source of truth for every SVG card generated in this repo.
module.exports = {
  dark: {
    background: "#09090b",   // zinc-950
    card: "#0c0c0e",
    border: "#27272a",       // zinc-800
    borderMuted: "#1f1f23",
    foreground: "#fafafa",   // zinc-50
    muted: "#a1a1aa",        // zinc-400
    mutedFg: "#71717a",      // zinc-500
    accent: "#e4e4e7",       // zinc-200 (primary accent stays neutral, shadcn-style)
    ring: "#8b5cf6",         // violet-500, used sparingly as the single accent
    track: "#18181b",        // zinc-900 (progress track)
    success: "#4ade80",
    langColors: {
      TypeScript: "#3178c6",
      JavaScript: "#eab308",
      Python: "#3b82f6",
      Go: "#22d3ee",
      Rust: "#f97316",
      HTML: "#e34c26",
      CSS: "#a855f7",
      Shell: "#89e051",
      Java: "#b07219",
      "C++": "#f34b7d",
      Vue: "#41b883",
      Dart: "#00b4ab",
    },
  },
  font: {
    mono: "ui-monospace, 'SFMono-Regular', 'Menlo', 'Consolas', monospace",
    sans: "'Inter', 'Segoe UI', ui-sans-serif, system-ui, sans-serif",
  },
  radius: {
    card: 12,
    sm: 4,
    pill: 999,
  },
};
