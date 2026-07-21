# Profile Dashboard Banner Design

## Goal

Replace the profile README with one self-contained, shadcn-inspired SVG banner. The banner introduces Bernardo and displays animated GitHub statistics refreshed daily by GitHub Actions.

## Visual Design

The banner is a 1200 × 620 dark SVG using the shadcn zinc palette, one-pixel borders, short radii, restrained shadows, a subtle grid, and a neutral spotlight. It contains three regions:

1. An editorial hero with `Bernardo Fernandez`, `Software Engineer · Brazil`, the tagline `Building thoughtful products with clear code and precise interfaces.`, an availability indicator, and pills for TypeScript, React, VTEX IO, Python, and Golang.
2. A five-column statistics card showing yearly contributions, pull requests, owned public repositories, stars earned, and followers.
3. Two chart cards showing contribution activity for the last 14 days and the language distribution of owned, non-fork public repositories.

CSS animations embedded in the SVG animate the grid, spotlight, availability indicator, entrance sequence, activity bars, and language bars. A `prefers-reduced-motion: reduce` rule disables all animation. The banner has no JavaScript or interaction because GitHub profile READMEs only provide reliable image rendering.

## Data and Automation

The existing `update-stats.yml` workflow remains the automation entry point. On a daily schedule, manual dispatch, or a relevant push, it:

1. Checks out the repository and starts Node.js 20.
2. Runs one dependency-free Node.js generator with `GH_USERNAME` set to the repository owner and `GH_TOKEN` set to the built-in `github.token`.
3. Queries GitHub GraphQL for profile totals, contribution days, repositories, stars, and repository languages. Repository pagination continues until all owned, non-fork public repositories are included.
4. Builds the complete SVG in memory and writes `assets/banner.svg` only after a successful response and validation.
5. Commits and pushes only `assets/banner.svg` when its contents changed.

If GitHub returns an HTTP or GraphQL error, the generator exits non-zero before writing, preserving the last valid banner. Empty contribution and language data render zero-state tracks rather than producing invalid dimensions.

## Repository Changes

- `README.md` becomes a single centered image reference with descriptive alt text.
- `scripts/generate-banner.js` becomes the only generator and contains the query, aggregation, escaping, SVG template, and a local `--check` mode.
- `scripts/package.json` exposes only the banner generation and check commands.
- `.github/workflows/update-stats.yml` runs the single generator and commits the single asset.
- The three superseded card generators and their shared card helpers are removed.
- `assets/banner.svg` is generated and committed so the README always has a renderable fallback.

## Validation

`node scripts/generate-banner.js --check` uses fixture data to verify XML escaping, metric aggregation, zero-value handling, and a complete SVG document without accessing the network. The generated SVG is also parsed as XML when an XML parser is available locally, and the README is checked to ensure it references only `assets/banner.svg`.

## Deliberate Limits

The workflow updates once per day and shows public repository data available to the repository token. True hover or click interaction, external chart services, a custom font bundle, and separate light-mode artwork are excluded. They should be added only if GitHub gains reliable interactive embedding or the banner moves to a standalone website.
