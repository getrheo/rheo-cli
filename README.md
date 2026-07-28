# rheo-cli

Public home for [`@getrheo/cli`](https://www.npmjs.com/package/%40getrheo%2Fcli) — Rheo CLI for workspace members (reads and role-gated writes).

## Package

| npm | Description |
| --- | --- |
| [`@getrheo/cli`](https://www.npmjs.com/package/%40getrheo%2Fcli) | `rheo` binary — auth, whoami, apps, flows, channels, experiments, analytics, rollouts, media |

**Current release line:** `2.3.0.x` (publish on git tag `v2.3.0`).

## Install

```bash
npm install -g @getrheo/cli
rheo --help
```

Create a workspace API key in the dashboard (**Account → Personal**), then:

```bash
rheo auth login --api-key rheo_wk_…
rheo apps list
```

Writes follow your live workspace role (same capabilities as the dashboard).

## Development

```bash
pnpm install
pnpm verify
```

[Documentation](https://docs.getrheo.io/docs/developer-guide/cli) · [CONTRIBUTING](./CONTRIBUTING.md) · [MIT](./LICENSE)
