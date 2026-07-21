const theme = require("./theme");

/** Escapes text for safe SVG embedding */
function esc(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Wraps generated content in a shadcn-style card: rounded rect, 1px border, subtle shadow */
function card({ width, height, children, title, subtitle }) {
  const t = theme.dark;
  const headerH = title ? 56 : 24;
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" font-family="${theme.font.sans}">
  <style>
    .title { font: 600 15px ${theme.font.sans}; fill: ${t.foreground}; letter-spacing: -0.01em; }
    .subtitle { font: 400 11px ${theme.font.mono}; fill: ${t.mutedFg}; }
    .label { font: 500 12px ${theme.font.sans}; fill: ${t.muted}; }
    .value { font: 600 12px ${theme.font.mono}; fill: ${t.foreground}; }
    .stat-num { font: 700 20px ${theme.font.mono}; fill: ${t.foreground}; }
    .stat-label { font: 500 10px ${theme.font.sans}; fill: ${t.mutedFg}; text-transform: uppercase; letter-spacing: 0.06em; }
    rect.card { filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4)); }
  </style>
  <rect class="card" x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="${theme.radius.card}" fill="${t.card}" stroke="${t.border}"/>
  ${title ? `<text x="20" y="28" class="title">${esc(title)}</text>` : ""}
  ${subtitle ? `<text x="20" y="44" class="subtitle">${esc(subtitle)}</text>` : ""}
  <g transform="translate(0, ${headerH})">
    ${children}
  </g>
</svg>`;
}

/** A horizontal progress bar, shadcn <Progress> style: rounded track + rounded indicator */
function progressBar({ x, y, width, height = 6, value, max, color }) {
  const t = theme.dark;
  const pct = Math.max(0, Math.min(1, value / max));
  const w = Math.max(height, width * pct); // keep rounded caps visible even near 0
  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${height / 2}" fill="${t.track}"/>
    <rect x="${x}" y="${y}" width="${w}" height="${height}" rx="${height / 2}" fill="${color}"/>
  `;
}

/** A single stat block: big mono number + small uppercase label (shadcn <Card> stat pattern) */
function statBlock({ x, y, value, label }) {
  return `
    <text x="${x}" y="${y}" class="stat-num">${esc(value)}</text>
    <text x="${x}" y="${y + 18}" class="stat-label">${esc(label)}</text>
  `;
}

/** Vertical divider like shadcn <Separator orientation="vertical" /> */
function vSeparator({ x, y1, y2 }) {
  return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${theme.dark.border}" stroke-width="1"/>`;
}

module.exports = { esc, card, progressBar, statBlock, vSeparator };
