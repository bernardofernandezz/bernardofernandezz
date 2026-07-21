/**
 * Gera assets/stats-card.svg — um card estilo shadcn/ui com estatísticas
 * agregadas do perfil (commits, PRs, issues, estrelas, seguidores).
 *
 * Requer a env var GH_TOKEN (um PAT com escopo `read:user` e `repo` público
 * é suficiente) e GH_USERNAME.
 */
const fs = require("fs");
const path = require("path");
const theme = require("./lib/theme");
const { card, statBlock, vSeparator } = require("./lib/svg");

const USERNAME = process.env.GH_USERNAME;
const TOKEN = process.env.GH_TOKEN;

if (!USERNAME || !TOKEN) {
  console.error("Defina GH_USERNAME e GH_TOKEN antes de rodar este script.");
  process.exit(1);
}

const query = `
query ($login: String!) {
  user(login: $login) {
    followers { totalCount }
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalPullRequestReviewContributions
      contributionCalendar { totalContributions }
    }
    repositories(first: 100, ownerAffiliation: OWNER, isFork: false) {
      totalCount
      nodes { stargazerCount }
    }
  }
}`;

async function main() {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables: { login: USERNAME } }),
  });

  const json = await res.json();
  if (json.errors) {
    console.error(JSON.stringify(json.errors, null, 2));
    process.exit(1);
  }

  const u = json.data.user;
  const totalStars = u.repositories.nodes.reduce((sum, r) => sum + r.stargazerCount, 0);
  const cc = u.contributionsCollection;

  const stats = [
    { value: cc.contributionCalendar.totalContributions.toLocaleString("en-US"), label: "Contribuições (1a)" },
    { value: cc.totalPullRequestContributions.toLocaleString("en-US"), label: "Pull Requests" },
    { value: cc.totalIssueContributions.toLocaleString("en-US"), label: "Issues" },
    { value: totalStars.toLocaleString("en-US"), label: "Estrelas" },
    { value: u.repositories.totalCount.toLocaleString("en-US"), label: "Repositórios" },
    { value: u.followers.totalCount.toLocaleString("en-US"), label: "Seguidores" },
  ];

  const width = 760;
  const height = 140;
  const colWidth = (width - 40) / stats.length;

  const body = stats
    .map((s, i) => {
      const x = 20 + i * colWidth;
      const sep = i > 0 ? vSeparator({ x, y1: 14, y2: 74 }) : "";
      return sep + statBlock({ x: x + (i > 0 ? 20 : 0), y: 46, value: s.value, label: s.label });
    })
    .join("\n");

  const svg = card({
    width,
    height,
    title: `${USERNAME} · GitHub Stats`,
    subtitle: `atualizado em ${new Date().toISOString().slice(0, 10)}`,
    children: body,
  });

  const outDir = path.join(__dirname, "..", "assets");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "stats-card.svg"), svg);
  console.log("assets/stats-card.svg gerado com sucesso.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
