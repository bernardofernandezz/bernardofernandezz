const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const API_URL = "https://api.github.com/graphql";
const WIDTH = 1200;
const HEIGHT = 620;

function esc(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function graphql(token, query, variables) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "bernardofernandezz-profile-readme",
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.json();
  if (!response.ok || body.errors) {
    throw new Error(body.errors?.map(({ message }) => message).join("; ") || `GitHub returned ${response.status}`);
  }
  return body.data;
}

async function fetchProfile(login, token) {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 13);
  from.setUTCHours(0, 0, 0, 0);

  const data = await graphql(token, `
    query ($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        followers { totalCount }
        contributionsCollection {
          totalPullRequestContributions
          contributionCalendar { totalContributions }
        }
        recent: contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            weeks { contributionDays { date contributionCount } }
          }
        }
      }
    }
  `, { login, from: from.toISOString(), to: to.toISOString() });

  if (!data.user) throw new Error(`GitHub user ${login} was not found`);
  return data.user;
}

async function fetchRepositories(login, token) {
  const repositories = [];
  let cursor = null;

  do {
    const data = await graphql(token, `
      query ($login: String!, $cursor: String) {
        user(login: $login) {
          repositories(
            first: 100
            after: $cursor
            ownerAffiliation: OWNER
            isFork: false
            privacy: PUBLIC
          ) {
            pageInfo { hasNextPage endCursor }
            nodes {
              stargazerCount
              languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
                edges { size node { name } }
              }
            }
          }
        }
      }
    `, { login, cursor });

    if (!data.user) throw new Error(`GitHub user ${login} was not found`);
    const page = data.user.repositories;
    repositories.push(...page.nodes);
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (cursor);

  return repositories;
}

function aggregate(profile, repositories) {
  const languageBytes = new Map();
  let stars = 0;

  for (const repository of repositories) {
    stars += repository.stargazerCount;
    for (const { size, node } of repository.languages.edges) {
      languageBytes.set(node.name, (languageBytes.get(node.name) || 0) + size);
    }
  }

  const totalBytes = [...languageBytes.values()].reduce((sum, size) => sum + size, 0);
  const languages = [...languageBytes]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, size]) => ({ name, percent: totalBytes ? (size / totalBytes) * 100 : 0 }));
  const days = profile.recent.contributionCalendar.weeks
    .flatMap(({ contributionDays }) => contributionDays)
    .slice(-14);

  return {
    stats: [
      [profile.contributionsCollection.contributionCalendar.totalContributions, "Contributions"],
      [profile.contributionsCollection.totalPullRequestContributions, "Pull requests"],
      [repositories.length, "Repositories"],
      [stars, "Stars earned"],
      [profile.followers.totalCount, "Followers"],
    ],
    days,
    languages,
  };
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function gridLines() {
  const vertical = Array.from({ length: 43 }, (_, i) => `<line x1="${i * 30}" y1="-30" x2="${i * 30}" y2="390"/>`);
  const horizontal = Array.from({ length: 15 }, (_, i) => `<line x1="-30" y1="${i * 30}" x2="1230" y2="${i * 30}"/>`);
  return [...vertical, ...horizontal].join("");
}

function pills() {
  const items = [
    ["TypeScript", 96],
    ["React", 68],
    ["VTEX IO", 82],
    ["Python", 72],
    ["Golang", 72],
  ];
  let x = 36;
  return items.map(([label, width]) => {
    const pill = `<g transform="translate(${x} 203)"><rect width="${width}" height="30" rx="7"/><text x="${width / 2}" y="19" text-anchor="middle">${label}</text></g>`;
    x += width + 8;
    return pill;
  }).join("");
}

function statsMarkup(stats) {
  const cardX = 36;
  const cardWidth = 1128;
  const columnWidth = cardWidth / stats.length;
  return stats.map(([value, label], index) => {
    const x = cardX + index * columnWidth;
    return `${index ? `<line x1="${x}" y1="293" x2="${x}" y2="353" class="separator"/>` : ""}
      <g class="reveal" style="animation-delay:${220 + index * 70}ms">
        <text x="${x + 24}" y="320" class="stat-value">${formatNumber(value)}</text>
        <text x="${x + 24}" y="343" class="stat-label">${esc(label)}</text>
      </g>`;
  }).join("");
}

function activityMarkup(days) {
  const safeDays = days.length ? days : Array.from({ length: 14 }, () => ({ date: "", contributionCount: 0 }));
  const max = Math.max(1, ...safeDays.map(({ contributionCount }) => contributionCount));
  const gap = 8;
  const width = 652;
  const barWidth = (width - gap * (safeDays.length - 1)) / safeDays.length;
  const bottom = 550;
  const chartHeight = 76;

  return safeDays.map(({ date, contributionCount }, index) => {
    const x = 60 + index * (barWidth + gap);
    const height = contributionCount ? Math.max(5, contributionCount / max * chartHeight) : 4;
    const day = date ? date.slice(8, 10) : "–";
    return `<g>
      <rect class="activity-bar" style="animation-delay:${380 + index * 45}ms" x="${x.toFixed(2)}" y="${(bottom - height).toFixed(2)}" width="${barWidth.toFixed(2)}" height="${height.toFixed(2)}" rx="4" fill="${contributionCount ? "#e4e4e7" : "#27272a"}"/>
      <text x="${(x + barWidth / 2).toFixed(2)}" y="570" text-anchor="middle" class="axis-label">${day}</text>
    </g>`;
  }).join("");
}

function languagesMarkup(languages) {
  const safeLanguages = languages.length ? languages : [{ name: "No public data", percent: 0 }];
  const max = Math.max(1, ...safeLanguages.map(({ percent }) => percent));
  return safeLanguages.map(({ name, percent }, index) => {
    const y = 464 + index * 30;
    const width = percent / max * 218;
    return `<g class="language-row" style="animation-delay:${500 + index * 90}ms">
      <text x="776" y="${y}" class="language-label">${esc(name)}</text>
      <rect x="874" y="${y - 8}" width="218" height="7" rx="3.5" class="track"/>
      <rect x="874" y="${y - 8}" width="${width.toFixed(2)}" height="7" rx="3.5" class="language-bar"/>
      <text x="1136" y="${y}" text-anchor="end" class="language-percent">${percent.toFixed(1)}%</text>
    </g>`;
  }).join("");
}

function renderBanner({ username, stats, days, languages, updatedAt }) {
  const recentTotal = days.reduce((sum, { contributionCount }) => sum + contributionCount, 0);
  return `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title description">
  <title id="title">Bernardo Fernandez — Software Engineer</title>
  <desc id="description">GitHub profile dashboard for ${esc(username)}, updated ${esc(updatedAt)}</desc>
  <defs>
    <clipPath id="frame"><rect width="1200" height="620" rx="18"/></clipPath>
    <radialGradient id="spotlight"><stop stop-color="#71717a" stop-opacity=".34"/><stop offset="1" stop-color="#09090b" stop-opacity="0"/></radialGradient>
    <linearGradient id="grid-fade" x1="0" y1="0" x2="0" y2="1"><stop stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient>
    <mask id="grid-mask"><rect width="1200" height="390" fill="url(#grid-fade)"/></mask>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="10" stdDeviation="20" flood-color="#000" flood-opacity=".28"/></filter>
  </defs>
  <style>
    .display { font-family: Georgia, 'Times New Roman', serif; }
    .mono { font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace; }
    .grid { stroke:#27272a; stroke-width:1; animation:grid-drift 14s linear infinite; }
    .spotlight { transform-origin:1080px 72px; animation:spotlight-pulse 5s ease-in-out infinite; }
    .status-ring { transform-box:fill-box; transform-origin:center; animation:status-ping 2.2s ease-out infinite; }
    .reveal { animation:rise .7s cubic-bezier(.2,.8,.2,1) both; }
    .pill rect { fill:#18181b; stroke:#27272a; }
    .pill text { fill:#d4d4d8; font:500 12px ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace; }
    .separator { stroke:#27272a; }
    .stat-value { fill:#fafafa; font:700 24px ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace; }
    .stat-label { fill:#71717a; font:600 10px ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace; letter-spacing:.08em; text-transform:uppercase; }
    .chart-title { fill:#fafafa; font:600 15px Georgia, 'Times New Roman', serif; }
    .chart-meta,.axis-label { fill:#71717a; font:500 10px ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace; }
    .activity-bar { transform-box:fill-box; transform-origin:center bottom; animation:bar-grow .75s cubic-bezier(.2,.8,.2,1) both; }
    .language-row { animation:rise .6s ease-out both; }
    .language-label,.language-percent { fill:#a1a1aa; font:500 11px ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace; }
    .track { fill:#27272a; }
    .language-bar { fill:#e4e4e7; transform-box:fill-box; transform-origin:left center; animation:bar-fill .9s cubic-bezier(.2,.8,.2,1) both; }
    @keyframes grid-drift { to { transform:translate(30px,30px); } }
    @keyframes spotlight-pulse { 50% { opacity:.55; transform:scale(1.08); } }
    @keyframes status-ping { 75%,100% { opacity:0; transform:scale(2.5); } }
    @keyframes rise { from { opacity:0; transform:translateY(10px); } }
    @keyframes bar-grow { from { opacity:.2; transform:scaleY(0); } }
    @keyframes bar-fill { from { transform:scaleX(0); } }
    @media (prefers-reduced-motion:reduce) {
      .grid,.spotlight,.status-ring,.reveal,.activity-bar,.language-row,.language-bar { animation:none; }
    }
  </style>
  <g clip-path="url(#frame)">
    <rect width="1200" height="620" fill="#09090b"/>
    <g class="grid" mask="url(#grid-mask)">${gridLines()}</g>
    <circle class="spotlight" cx="1080" cy="72" r="330" fill="url(#spotlight)"/>
    <line x1="0" y1="52" x2="1200" y2="52" stroke="#27272a"/>
    <text x="36" y="33" class="mono" fill="#71717a" font-size="11">bernardofernandezz.dev</text>
    <g transform="translate(1082 27)">
      <circle class="status-ring" r="5" fill="none" stroke="#fafafa" opacity=".55"/>
      <circle r="4" fill="#fafafa"/>
      <text x="14" y="4" class="mono" fill="#a1a1aa" font-size="11">available</text>
    </g>

    <g class="reveal" style="animation-delay:40ms">
      <text x="36" y="91" class="mono" fill="#a1a1aa" font-size="11" font-weight="600" letter-spacing="1.5">SOFTWARE ENGINEER · BRAZIL</text>
      <text x="36" y="145" class="display" fill="#fafafa" font-size="46" font-weight="700" letter-spacing="-1.8">Bernardo Fernandez</text>
      <text x="36" y="178" class="display" fill="#a1a1aa" font-size="17">Building thoughtful products with clear code and precise interfaces.</text>
    </g>
    <g class="pill reveal" style="animation-delay:130ms">${pills()}</g>

    <rect x="36" y="278" width="1128" height="90" rx="10" fill="#0c0c0e" stroke="#27272a" filter="url(#shadow)"/>
    ${statsMarkup(stats)}

    <rect x="36" y="388" width="700" height="196" rx="10" fill="#0c0c0e" stroke="#27272a"/>
    <text x="60" y="421" class="chart-title">Contribution activity</text>
    <text x="60" y="441" class="chart-meta">${formatNumber(recentTotal)} contributions · last 14 days</text>
    ${activityMarkup(days)}

    <rect x="752" y="388" width="412" height="196" rx="10" fill="#0c0c0e" stroke="#27272a"/>
    <text x="776" y="421" class="chart-title">Language mix</text>
    <text x="1136" y="421" text-anchor="end" class="chart-meta">public repositories</text>
    ${languagesMarkup(languages)}
    <text x="36" y="607" class="mono" fill="#52525b" font-size="9">UPDATED ${esc(updatedAt)} · GITHUB ACTIONS</text>
  </g>
  <rect x=".5" y=".5" width="1199" height="619" rx="17.5" stroke="#27272a"/>
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
  const profile = {
    followers: { totalCount: 7 },
    contributionsCollection: {
      totalPullRequestContributions: 12,
      contributionCalendar: { totalContributions: 99 },
    },
    recent: { contributionCalendar: { weeks: [{ contributionDays: [{ date: "2026-07-21", contributionCount: 3 }] }] } },
  };
  const repositories = [
    { stargazerCount: 5, languages: { edges: [{ size: 80, node: { name: "TypeScript" } }] } },
    { stargazerCount: 2, languages: { edges: [{ size: 20, node: { name: "Go" } }] } },
  ];
  const data = aggregate(profile, repositories);
  assert.equal(esc("<A&B>"), "&lt;A&amp;B&gt;");
  assert.deepEqual(data.stats.map(([value]) => value), [99, 12, 2, 7, 7]);
  assert.equal(data.languages[0].percent, 80);
  const svg = renderBanner({ username: "test", ...data, updatedAt: "2026-07-21" });
  validateSvg(svg);
  validateSvg(renderBanner({ username: "test", stats: [[0, "Zero"]], days: [], languages: [], updatedAt: "2026-07-21" }));
  assert.match(svg, /prefers-reduced-motion/);
  console.log("Banner checks passed.");
}

async function main() {
  if (process.argv.includes("--check")) return check();

  const username = process.env.GH_USERNAME;
  const token = process.env.GH_TOKEN;
  if (!username || !token) throw new Error("GH_USERNAME and GH_TOKEN are required");

  const [profile, repositories] = await Promise.all([
    fetchProfile(username, token),
    fetchRepositories(username, token),
  ]);
  const svg = renderBanner({
    username,
    ...aggregate(profile, repositories),
    updatedAt: new Date().toISOString().slice(0, 10),
  });
  writeBanner(svg);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
