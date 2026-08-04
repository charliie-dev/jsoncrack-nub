<!-- PROJECT LOGO -->
<p align="center">
  <a href="https://github.com/AykutSarac/jsoncrack.com">
   <img src="./apps/www/public/assets/192.png" height="50" alt="Logo">
  </a>

  <h1 align="center">JSON Crack</h1>

  <p align="center">
    The open-source JSON Editor.
    <br />
    <a href="https://jsoncrack.com"><strong>Learn more »</strong></a>
    <br />
    <br />
    <a href="https://todiagram.com?utm_source=jsoncrack&utm_medium=readme_header">ToDiagram</a>
    ·
    <a href="https://discord.gg/yVyTtCRueq">Discord</a>
    ·
    <a href="https://jsoncrack.com">Website</a>
    ·
    <a href="https://github.com/AykutSarac/jsoncrack.com/issues">Issues</a>
  </p>
</p>

<!-- ABOUT THE PROJECT -->

## About the Project

<img width="100%" alt="JSON Crack editor" src="./apps/www/public/assets/editor.webp">

## Visualize JSON into interactive graphs

JSON Crack is a tool for visualizing JSON data in a structured, interactive graphs, making it easier to explore, format, and validate JSON. It offers features like converting JSON to other formats (CSV, YAML), generating JSON Schema, executing queries, and exporting visualizations as images. Designed for both readability and usability.

* **Visualizer**: Instantly convert JSON, YAML, CSV, and XML into interactive graphs or trees in dark or light mode.
* **Convert**: Seamlessly transform data formats, like JSON to CSV or XML to JSON, for easy sharing.
* **Format & Validate**: Beautify and validate JSON, YAML, and CSV for clear and accurate data.
* **Code Generation**: Generate TypeScript interfaces, Golang structs, Kotlin data classes, Rust serde types, and JSON Schema.
* **JSON Schema**: Create and validate JSON Schema.
* **Advanced Tools**: Run jq and JSON path queries.
* **Export Image**: Download your visualization as PNG, JPEG, or SVG.
* **Privacy**: All data processing is local; nothing is stored on our servers.

## Recognition

<a href="https://news.ycombinator.com/item?id=32626873">
  <img
    style="width: 250px; height: 54px;" width="250" height="54"
    alt="Featured on Hacker News"
    src="https://hackernews-badge.vercel.app/api?id=32626873"
  />
</a>

<a href="https://producthunt.com/posts/JSON-Crack?utm_source=badge-featured&utm_medium=badge&utm_souce=badge-jsoncrack" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=332281&theme=light" alt="JSON Crack | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>

## Integrations

- [npm Package (`jsoncrack-react`)](https://www.npmjs.com/package/jsoncrack-react)

## Contributing

- Found a bug or missing feature? Open an issue on [GitHub Issues](https://github.com/AykutSarac/jsoncrack.com/issues).
- Want to contribute code or docs? Start with our [contribution guide](./CONTRIBUTING.md).

## Sponsors & Support

If you find JSON Crack useful, you can support the project by using [ToDiagram](https://todiagram.com?utm_source=jsoncrack&utm_medium=readme_sponsors). For sponsorship inquiries, reach out at contact@todiagram.com.

## Stay Up-to-Date

JSON Crack officially launched as v1.0 on the 17th of February 2022 and we've come a long way so far. Watch **releases** of this repository to be notified of future updates:

<a href="https://github.com/AykutSarac/jsoncrack.com"><img src="https://img.shields.io/github/stars/AykutSarac/jsoncrack.com" alt="Star at GitHub" /></a>

<!-- GETTING STARTED -->

## Getting Started

### Prerequisites

- [mise](https://mise.jdx.dev/) (recommended) — installs the pinned nub version automatically
- Or [nub](https://nubjs.com/) >= 0.6 and Node.js 26.5.1 installed manually

## Development

### Setup

1. Clone the repo:

   ```sh
   git clone https://github.com/charliie-dev/jsoncrack-nub.git
   cd jsoncrack-nub
   ```

2. Install dependencies:

   ```sh
   nub install
   ```

3. Optional — override any app defaults locally:

   ```sh
   cp apps/www/.env.example apps/www/.env.local
   ```

   `apps/www/.env` holds the committed defaults and is tracked, so overwriting it
   leaves your checkout permanently dirty and risks committing your own values.
   `.env.local` is gitignored and takes precedence, so put local changes there.

4. Start the dev server:

   ```sh
   nub run dev
   ```

   The editor is available at http://localhost:3000.

### Scripts

```sh
nub run dev        # Start the dev server on port 3000
nub run build      # Build the static export
nub run start      # Serve the built export on port 3000
nub run lint       # Typecheck, lint, and check formatting
nub run lint:fix   # Fix lint and formatting issues
nub run test       # Run the test suite
nub run analyze    # Build with the bundle analyzer
nub run clean      # Remove build outputs
```

With mise installed, `mise run <task>` wraps each of these and adds:

```sh
mise run typecheck           # tsc only, skipping eslint and prettier
mise run audit               # Fail on fixable critical/high advisories
mise run audit:all           # Show every advisory, including unfixable ones
mise run bundle-size         # Raw and gzipped size of the export
mise run deptree             # Dependency tree
PKG=postcss mise run deptree # Why a specific package is installed
DEEP=1 mise run clean        # Also remove node_modules
```

Plus the `dc:*` Docker tasks below.

### Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_NODE_LIMIT` | `1200` | Node count above which the graph shows a "not supported" panel instead of laying out. Raising it removes the only guard against a huge document hanging the tab — measure first |
| `NEXT_TELEMETRY_DISABLED` | `1` | Disable Next.js telemetry |
| `NEXT_PUBLIC_DISABLE_EXTERNAL_MODE` | `true` | Hides the external-mode dialog, the "Upgrade to Pro Editor" toolbar link and the "Choose your editor" modal. Set to `false` to get all three back |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | _(empty)_ | Google Analytics measurement ID (optional) |
| `NEXT_PUBLIC_SITE_URL` | `https://jsoncrack.com` | Public base URL. Drives the sitemap, robots.txt, and every page's canonical and Open Graph URL |
| `PORT` | `8080` | Host port published by Docker Compose |
| `TAG` | `latest` | Image tag `docker compose pull` fetches |

App variables live in `apps/www/.env` (put local overrides in the gitignored
`apps/www/.env.local`). `PORT`, `TAG` and `NEXT_PUBLIC_SITE_URL` are read from the root
`.env` by Docker Compose.

### Docker

Pulling the published image is the quickest path and needs no registry credentials:

```sh
cp .env.example .env
docker compose pull
docker compose up -d

# The editor is available at http://localhost:8080
```

Building from source instead requires a `docker login dhi.io` first, because the
Dockerfile's production stage pulls [Docker Hardened Images](https://docs.docker.com/dhi/):

```sh
docker login dhi.io
docker compose up -d --build
```

To run on a different port:

```sh
PORT=3000 docker compose up -d
```

To point a self-hosted instance at its own origin, which sets the canonical URLs, Open Graph
URLs, sitemap and robots.txt together:

```sh
NEXT_PUBLIC_SITE_URL=https://json.example.com docker compose up -d --build
```

The container runs unprivileged as uid 65532 with a read-only root filesystem, every Linux
capability dropped, `no-new-privileges`, and size-capped tmpfs mounts. Request logs go to
the container's stdout, so `docker compose logs -f` shows them.

With mise:

```sh
mise run dc:up         # Build and start
mise run dc:status     # Show container status
mise run dc:logs       # Tail logs
mise run dc:down       # Stop and remove
mise run dc:validate   # Validate the compose config
```

The container runs unprivileged as uid 65532 with a read-only root filesystem, all Linux
capabilities dropped, and `no-new-privileges` set.

<!-- LICENSE -->

## License

See [`LICENSE`](/LICENSE.md) for more information.
