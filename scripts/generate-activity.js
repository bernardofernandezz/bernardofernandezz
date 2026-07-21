/**
 * Gera assets/activity.svg — um mini gráfico de barras (sparkline) com
 * o número de contribuições por dia nos últimos 14 dias, no estilo de
 * um <ChartContainer> do shadcn/ui.
 */
const fs = require("fs");
const path = require("path");
const theme = require("./lib/theme");
const { card, esc } = require("./lib/svg");

const USERNAME = process.env.GH_USERNAME;
const TOKEN = process.env.GH_TOKEN;

if (!USERNAME || !TOKEN) {
  console.error("Defina GH_USERNAME e GH_TOKEN antes de rodar este script.");
  process.exit(1);
}

const query = `
query ($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

async function main() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 13);

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      variables: { login: USERNAME, from: from.toISOString(), to: to.toISOString() },
    }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));

  const days = json.data.user.contributionsCollection.contributionCalendar.weeks
    .flatMap((w) => w.contributionDays)
    .slice(-14);

  const width = 380;
  const height = 150;
  const chartTop = 20;
  const chartH = 70;
  const barGap = 6;
  const barW = (width - 40 - barGap * (days.length - 1)) / days.length;
  const max = Math.max(1, ...days.map((d) => d.contributionCount));
  const t = theme.dark;

  const bars = days
    .map((d, i) => {
      const x = 20 + i * (barW + barGap);
      const h = Math.max(2, (d.contributionCount / max) * chartH);
      const y = chartTop + (chartH - h);
      const active = d.contributionCount > 0;
      const weekday = new Date(d.date).toLocaleDateString("pt-BR", { weekday: "narrow" });
      return `
        <rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="${Math.min(3, barW / 2)}" fill="${active ? t.ring : t.track}"/>
        <text x="${x + barW / 2}" y="${chartTop + chartH + 16}" text-anchor="middle" class="stat-label">${esc(weekday)}</text>
      `;
    })
    .join("\n");

  const total = days.reduce((s, d) => s + d.contributionCount, 0);

  const svg = card({
    width,
    height,
    title: "Atividade · últimos 14 dias",
    subtitle: `${total} contribuições`,
    children: bars,
  });

  const outDir = path.join(__dirname, "..", "assets");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "activity.svg"), svg);
  console.log("assets/activity.svg gerado com sucesso.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
