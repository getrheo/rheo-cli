# @getrheo/cli

Rheo CLI for workspace members — read and write product content with a personal workspace API key.

## Install

```bash
npm install -g @getrheo/cli
# or
npx @getrheo/cli --help
```

## Auth

1. In the Rheo dashboard, open **Account → Personal** and create a **CLI API key** (`rheo_wk_…`). Any workspace member can mint a personal key.
2. Save it locally:

```bash
rheo auth login --api-key rheo_wk_…
```

Or set `RHEO_API_KEY` (and optionally `RHEO_API_URL`) for CI.

Keys are **workspace-scoped** and **user-bound**. Mutations follow your live workspace role (same capabilities as the dashboard).

## Commands

```bash
rheo whoami

# Apps
rheo apps list|get|create|update|branding|delete

# Flows
rheo flows list|get|draft|versions|version|create|update|save-draft|publish|archive|unarchive|duplicate

# Channels
rheo channels list|history|create|update|archive|unarchive|assign|unassign

# Experiments
rheo experiments list|get|stats|…|create|update|delete|add-variant|…|stop|promote

# Analytics (read; default last 7 UTC days)
rheo analytics app-overview <appId>
rheo analytics <kind> <flowId>

# Rollouts
rheo rollouts policy|policy-set|list|get|channel-list|submit|approve|reject

# Media
rheo media list|sign-upload|confirm|upload|rename|archive
```

Write bodies: `--body '{"…"}'` or `--file payload.json`. Destructive confirms use `--confirm-name`.

Out of scope: billing, members, workspace settings, AI helpers, notifications, customers.

Default API: `https://api.getrheo.io`. Override with `--api-url` or `RHEO_API_URL`.

## Docs

https://docs.getrheo.io/docs/developer-guide/cli
