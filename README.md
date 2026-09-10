# cordis-plugin-graph

A DSH / Cordis Web plugin that adds a **Plugin graph** tab to
`Settings → Plugins`, next to *Plugin list*. It renders a live, zoomable
[Cytoscape](https://js.cytoscape.org/) graph of the running Cordis runtime —
including what a static package graph can't show: which provider actually
resolved each `inject`, what's disabled, and tool calls flowing through in
real time.

## What you see

**Two planes** (toggle: `client` / `host` / `both`):

- **client** — the renderer Cordis context, inspected in-process: every
  `dsh-client-ui-*` plugin, the slot renderer, connection, theme, locale,
  settings.
- **host** — the engine context (sessions, agents, tools, model adapters,
  persistence), polled from a same-origin route the host half serves. Falls
  back gracefully to client-only where no web server is reachable (packaged
  desktop, headless).

**Nodes** = plugin fibers, coloured by lifecycle phase
(`active` / `pending` / `loading` / `failed` / `unloading` / `disposed`) plus
**`disabled`** for a Loader row turned off — so the graph shows the whole
composition, not only what's running. Size scales with services provided.

**Edges**, individually toggleable:

- `requires (inject)` — a fiber's hard `inject`, drawn to the fiber that
  actually resolved it.
- `provides to` — the reverse.
- `nested in (Loader tree)` — Loader-tree parent (composition / inheritance).

**Runtime activity** — while the host plane is shown, a live feed of the last
tool executions (from a `tools/result` subscription), and the tool node pulses
on each call. Run an agent task and watch it move through the graph.

Click a node → module specifier, Loader entry id, provided services, live
effect labels. Search by name/module. Recapture after a live enable/disable.

## Install

```sh
dsh plugin add cordis-plugin-graph
```

Restart the Host; the tab appears under Settings → Plugins. See
[`install/INSTALL.md`](./install/INSTALL.md) for GitHub / local-dir installs
and ACRYL Desktop.

## Portability

Uses only upstream primitives — `settings.plugins.tab`, the public
`@deepseek-ai/cordis` context API, and (optionally) `tools` + `webServer`
scoped injects that degrade independently. Works in any `web`-profile
deployment: ACRYL or stock DSH Desktop.

The renderer-plane inspection walk (`src/inspect.ts`) started as a trimmed
port of `acryl-desktop`'s `plugin-architecture-inspector.ts` — pure
`@deepseek-ai/cordis` public API.

## Build

```sh
pnpm install
pnpm run build      # lib/index.js + lib/inspect.js (host), lib/client.js (browser, cytoscape bundled)
pnpm run check      # build + typecheck + tests
```

## License

MIT
