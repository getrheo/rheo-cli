# @getrheo/cli

Rheo CLI for workspace members — read and write product content with a personal workspace API key, plus local flow import via `rheo import`.

Published as **`3.0.0`**, aligned with `PLATFORM_SDK_VERSION` in `scripts/publish-package-registry.mjs`.

## Install

```bash
npm install -g @getrheo/cli
# or
npx @getrheo/cli --help
```

## Auth

1. In the Rheo dashboard, open **Account → Personal** and create a **CLI API key** (`rheo_wk_…`). Any workspace member can mint a personal key.
2. Save it locally (login validates the key against the API):

```bash
rheo auth login --api-key rheo_wk_… [--api-url http://127.0.0.1:4000]
```

Or set `RHEO_API_KEY` (and optionally `RHEO_API_URL`) for CI.

Keys are **workspace-scoped** and **user-bound**. Mutations follow your live workspace role (same capabilities as the dashboard).

## Commands

```bash
rheo version
rheo whoami

# Apps
rheo apps list|get|create|update|branding|delete
rheo apps keys list <appId>

# Customers
rheo customers overview|list <appId>
rheo customers get|variables <appId> <appUserId>

# Flows / banners
rheo flows list <appId> [--include-archived] | rheo flows …
rheo banners … | rheo flows comments … | rheo flows rheo-agent …

# Channels, experiments, analytics, rollouts, media, Engage
rheo channels … | rheo experiments … | rheo analytics …
rheo rollouts … | rheo media list|upload|usage …
rheo engage …   # content-blocks, composers: rheo engage help

# Workspace
rheo keys workspace list|create|revoke
rheo members … | rheo billing status | rheo notifications …
rheo me email-preferences … | rheo onboarding … | rheo self-serve …
rheo store-listing-lookup | rheo ai brand-colors|translate-chunk …

# Local import (no API; Rheo agent skill)
rheo import validate|normalize|summary|scaffold|audit|audit-publish|profile
```

Write bodies: `--body '{"…"}'` or `--file payload.json`. Destructive confirms use `--confirm-name`.

Global flags: `--json`, `--table` (force human output when not a TTY), `--dry-run` (mutating HTTP only), `--profile`, `--api-url`.

Not in the CLI: platform admin, Clerk login, Stripe checkout/portal/downgrade, visual preview, `/v1/sdk/*`.

Default API: `https://api.getrheo.io`. Override with `--api-url` or `RHEO_API_URL`.

## Docs

https://docs.getrheo.io/docs/developer-guide/cli
