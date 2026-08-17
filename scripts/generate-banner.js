const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const API_URL = "https://api.github.com";
const WIDTH = 1200;
const HEIGHT = 440;
const ACCENT = "#bef264";
const HAIRLINE = "#232328";
const BAR_COLORS = ["#bef264", "#6b6b74", "#4a4a52", "#33333a", "#232329"];

function esc(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

async function rest(pathname, token) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "bernardofernandezz-profile-readme",
  };
  if (token) headers.Authorization = `bearer ${token}`;
  const response = await fetch(`${API_URL}${pathname}`, { headers });
  if (!response.ok) throw new Error(`GitHub returned ${response.status} for ${pathname}`);
  return response.json();
}

function aggregate(user, repos) {
  const owned = repos.filter((repo) => !repo.fork);
  const stars = owned.reduce((sum, repo) => sum + repo.stargazers_count, 0);
  const counts = new Map();
  for (const repo of owned) {
    if (repo.language) counts.set(repo.language, (counts.get(repo.language) || 0) + 1);
  }
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const languages = [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, percent: total ? (count / total) * 100 : 0 }));

  return {
    company: user.company || "",
    stats: [
      [owned.length, "repositories"],
      [stars, "stars earned"],
      [user.followers, "followers"],
      [user.created_at.slice(0, 4), "shipping since"],
    ],
    languages,
  };
}

async function fetchStats(login, token) {
  const user = await rest(`/users/${login}`, token);
  const repos = [];
  for (let page = 1; ; page += 1) {
    const batch = await rest(`/users/${login}/repos?per_page=100&page=${page}&type=owner`, token);
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  return aggregate(user, repos);
}

function statsMarkup(stats) {
  const columnWidth = 1104 / stats.length;
  return stats.map(([value, label], index) => {
    const x = 48 + index * columnWidth;
    const separator = index
      ? `<line x1="${x}" y1="276" x2="${x}" y2="336" stroke="${HAIRLINE}"/>`
      : "";
    return `${separator}
      <g class="reveal" style="animation-delay:${150 + index * 70}ms">
        <text x="${x + 20}" y="314" class="stat-value">${typeof value === "number" ? formatNumber(value) : esc(value)}</text>
        <text x="${x + 20}" y="335" class="stat-label">${esc(label)}</text>
      </g>`;
  }).join("");
}

function languagesMarkup(languages) {
  if (!languages.length) {
    return `<rect x="48" y="396" width="1104" height="12" fill="${HAIRLINE}"/>
      <text x="48" y="428" class="legend">no public code yet</text>`;
  }
  const total = languages.reduce((sum, { percent }) => sum + percent, 0) || 1;
  let x = 48;
  const segments = languages.map(({ percent }, index) => {
    const width = (percent / total) * 1104;
    const segment = `<rect class="seg" style="animation-delay:${430 + index * 80}ms" x="${x.toFixed(1)}" y="396" width="${width.toFixed(1)}" height="12" fill="${BAR_COLORS[index] || BAR_COLORS[4]}"/>`;
    x += width;
    return segment;
  }).join("");
  const legend = languages
    .map(({ name, percent }) => `${esc(name)} ${percent.toFixed(0)}%`)
    .join(`<tspan fill="#3f3f46"> · </tspan>`);
  return `${segments}<text x="48" y="428" class="legend">${legend}</text>`;
}

function renderBanner({ login, company, stats, languages, updatedAt }) {
  return `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title description">
  <title id="title">Bernardo Fernandez — Software Engineer</title>
  <desc id="description">Live GitHub profile of ${esc(login)}: repositories, stars, followers and language mix, updated ${esc(updatedAt)}.</desc>
  <style>
    .sans { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
    .mono { font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; }
    .stat-value { fill:#f4f4f5; font:700 28px ui-monospace, 'SF Mono', Menlo, Consolas, monospace; }
    .stat-label { fill:#52525b; font:600 10px ui-monospace, 'SF Mono', Menlo, Consolas, monospace; letter-spacing:.14em; text-transform:uppercase; }
    .legend { fill:#a1a1aa; font:500 12px ui-monospace, 'SF Mono', Menlo, Consolas, monospace; }
    .reveal { animation:rise .6s cubic-bezier(.2,.8,.2,1) both; }
    .seg { transform-box:fill-box; transform-origin:left center; animation:fill .8s cubic-bezier(.2,.8,.2,1) both; }
    .dot { animation:blink 2.4s ease-in-out infinite; }
    @keyframes rise { from { opacity:0; transform:translateY(8px); } }
    @keyframes fill { from { transform:scaleX(0); } }
    @keyframes blink { 50% { opacity:.35; } }
    @media (prefers-reduced-motion:reduce) { .reveal,.seg,.dot { animation:none; } }
  </style>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#0b0b0d"/>
  <line x1="0" y1="44" x2="${WIDTH}" y2="44" stroke="${HAIRLINE}"/>
  <text x="48" y="27" class="mono" fill="#71717a" font-size="12">~/${esc(login)}</text>
  <circle cx="1018" cy="23" r="4" fill="${ACCENT}" class="dot"/>
  <text x="1152" y="27" text-anchor="end" class="mono" fill="#a1a1aa" font-size="12">currently building</text>

  <g class="reveal" style="animation-delay:40ms">
    <text x="48" y="116" class="mono" fill="#71717a" font-size="12" letter-spacing="3">SOFTWARE ENGINEER · BRAZIL</text>
    <text x="48" y="192" class="sans" fill="#f4f4f5" font-size="60" font-weight="700" letter-spacing="-2">Bernardo Fernandez<tspan fill="${ACCENT}">.</tspan></text>
    <text x="48" y="226" class="mono" fill="#a1a1aa" font-size="14">currently building things${company ? ` at ${esc(company)}` : ""}</text>
  </g>

  <line x1="48" y1="252" x2="1152" y2="252" stroke="${HAIRLINE}"/>
  ${statsMarkup(stats)}
  <line x1="48" y1="368" x2="1152" y2="368" stroke="${HAIRLINE}"/>
  <text x="48" y="388" class="stat-label">languages</text>
  <text x="1152" y="428" text-anchor="end" class="legend" fill="#3f3f46">updated ${esc(updatedAt)} · github actions</text>
  ${languagesMarkup(languages)}
  <rect x=".5" y=".5" width="${WIDTH - 1}" height="${HEIGHT - 1}" stroke="${HAIRLINE}"/>
</svg>`;
}

function validateSvg(svg) {
  if (!svg.startsWith("<svg") || !svg.endsWith("</svg>") || /NaN|undefined/.test(svg)) {
    throw new Error("Generated banner is not a complete SVG");
  }
}

function writeBanner(svg) {
  validateSvg(svg);
  const output = path.join(__dirname, "..", "assets", "banner.svg");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, svg);
  console.log(`Generated ${path.relative(process.cwd(), output)}.`);
}

function check() {
  const user = { company: "Amara Net Zero", followers: 7, created_at: "2022-11-23T18:22:00Z" };
  const repos = [
    { fork: false, stargazers_count: 5, language: "TypeScript" },
    { fork: false, stargazers_count: 2, language: "TypeScript" },
    { fork: false, stargazers_count: 1, language: "Go" },
    { fork: true, stargazers_count: 99, language: "TypeScript" },
  ];
  const data = aggregate(user, repos);
  assert.equal(esc("<A&B>"), "&lt;A&amp;B&gt;");
  assert.deepEqual(data.stats.map(([value]) => value), [3, 8, 7, "2022"]);
  assert.deepEqual(data.languages, [
    { name: "TypeScript", percent: 100 * (2 / 3) },
    { name: "Go", percent: 100 * (1 / 3) },
  ]);
  const svg = renderBanner({ login: "test", ...data, updatedAt: "2026-08-17" });
  validateSvg(svg);
  validateSvg(renderBanner({ login: "test", company: "", stats: [[0, "Zero"]], languages: [], updatedAt: "2026-08-17" }));
  assert.match(svg, /prefers-reduced-motion/);
  console.log("Banner checks passed.");
}

async function main() {
  if (process.argv.includes("--check")) return check();

  const login = process.env.GH_USERNAME || "bernardofernandezz";
  const data = await fetchStats(login, process.env.GH_TOKEN);
  writeBanner(renderBanner({
    login,
    ...data,
    updatedAt: new Date().toISOString().slice(0, 10),
  }));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
