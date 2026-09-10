# Installation

`cordis-plugin-graph` is a standard Cordis plugin (npm package). It installs
with one `dsh plugin add` command and survives restarts.

## Install

### From npm (recommended)

```bash
dsh plugin --profile web add cordis-plugin-graph
```

### From GitHub

```bash
dsh plugin --profile web add git+https://github.com/acryldev/cordis-plugin-graph.git
```

### From a local directory

```bash
dsh plugin --profile web add file:/path/to/cordis-plugin-graph
```

After installing, **restart the Host**. A **Plugin graph** tab appears in
Settings -> Plugins, next to *Plugin list*.

## Install into ACRYL Desktop

ACRYL Desktop hosts the same DSH plugin runtime. Open the Desktop's built-in
terminal (Settings -> "Open ACRYL Terminal") and run the same command against
the Desktop's active profile:

```bash
dsh plugin --profile desktop add cordis-plugin-graph
```

Then reload the window (or restart the app). The tab appears under
Settings -> Plugins.

## Uninstall

```bash
dsh plugin --profile <name> remove cordis-plugin-graph
```
