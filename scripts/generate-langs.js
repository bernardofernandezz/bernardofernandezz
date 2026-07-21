/**
 * Gera assets/top-langs.svg — barras de progresso estilo shadcn/ui <Progress/>
 * mostrando as linguagens mais usadas nos repositórios do usuário.
 */
const fs = require("fs");
const path = require("path");
const theme = require("./lib/theme");
const { card, progressBar, esc } = require("./lib/svg");

const USERNAME = process.env.GH_USERNAME;
const TOKEN = process.env.GH_TOKEN;

if (!USERNAME || !TOKEN) {
  console.error("Defina GH_USERNAME e GH_TOKEN antes de rodar este script.");
  process.exit(1);
}

const query = `
query ($login: String!, $cursor: String) {
  user(login: $login) {
    repositories(first: 100, after: $cursor, ownerAffiliation: OWNER, isFork: false) {
      pageInfo { hasNextPage endCursor }
      nodes {
        languages(first: 5, orderBy: {field: SIZE, direction: DESC}) {
          edges { size node { name color } }
        }
      }
    }
  }
}`;

async function fetchAllRepos() {
  let cursor = null;
  let repos = [];
  for (;;) {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { login: USERNAME, cursor } }),
    });
    const json = await res.json();
    if (json.errors) throw new Error(JSON.stringify(json.errors));
    const page = json.data.user.repositories;
    repos = repos.concat(page.nodes);
    if (!page.pageInfo.hasNextPage) break;
    cursor = page.pageInfo.endCursor;
  }
  return repos;
}

async function main() {
  const repos = await fetchAllRepos();
  const totals = {};
  for (const repo of repos) {
    for (const edge of repo.languages.edges) {
      const name = edge.node.name;
      totals[name] = (totals[name] || 0) + edge.size;
      totals.__colors = totals.__colors || {};
      totals.__colors[name] = edge.node.color || theme.dark.ring;
    }
  }
  const colors = totals.__colors || {};
  delete totals.__colors;

  const sorted = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const grandTotal = sorted.reduce((sum, [, v]) => sum + v, 0);

  const width = 380;
  const rowH = 34;
  const height = 40 + sorted.length * rowH;

  // barras relativas à linguagem #1, para que a maior leitura fique "cheia"
  const max = sorted[0][1];
  const bodyFixed = sorted
    .map(([name, size], i) => {
      const pct = ((size / grandTotal) * 100).toFixed(1);
      const y = i * rowH;
      const color = colors[name] || theme.dark.ring;
      return `
        <text x="20" y="${y + 12}" class="label">${esc(name)}</text>
        <text x="${width - 20}" y="${y + 12}" text-anchor="end" class="value">${pct}%</text>
        ${progressBar({ x: 20, y: y + 18, width: width - 40, value: size, max, color })}
      `;
    })
    .join("\n");

  const svg = card({
    width,
    height,
    title: "Top Linguagens",
    children: bodyFixed,
  });

  const outDir = path.join(__dirname, "..", "assets");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "top-langs.svg"), svg);
  console.log("assets/top-langs.svg gerado com sucesso.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
