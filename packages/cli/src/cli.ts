import { resolveAuth, resolveConfigPath } from './config.js';
import { createHttpClient, CliHttpError } from './http.js';
import { resolveJsonPayload, requireFlag } from './body.js';
import { flagBool, flagString, type CliFlags } from './query.js';
import { preferJson } from './output.js';
import { runVersion } from './version.js';
import { runAuthLogin, runAuthLogout, runAuthStatus } from './commands/auth.js';
import { runWhoami } from './commands/whoami.js';
import {
  runAppsBranding,
  runAppsCreate,
  runAppsDelete,
  runAppsGet,
  runAppsList,
  runAppsUpdate,
} from './commands/apps.js';
import {
  runFlowsArchive,
  runFlowsCreate,
  runFlowsDraft,
  runFlowsDuplicate,
  runFlowsGet,
  runFlowsList,
  runFlowsPublish,
  runFlowsSaveDraft,
  runFlowsUnarchive,
  runFlowsUpdate,
  runFlowsVersion,
  runFlowsVersions,
} from './commands/flows.js';
import {
  runChannelsArchive,
  runChannelsAssign,
  runChannelsCreate,
  runChannelsHistory,
  runChannelsList,
  runChannelsUnarchive,
  runChannelsUnassign,
  runChannelsUpdate,
} from './commands/channels.js';
import {
  runExperimentsAddVariant,
  runExperimentsCohortKeys,
  runExperimentsCohortValues,
  runExperimentsCreate,
  runExperimentsDelete,
  runExperimentsDeleteVariant,
  runExperimentsExtend,
  runExperimentsGet,
  runExperimentsList,
  runExperimentsPromote,
  runExperimentsReorderVariants,
  runExperimentsStats,
  runExperimentsStatsTimeseries,
  runExperimentsStatus,
  runExperimentsStop,
  runExperimentsUpdate,
  runExperimentsUpdateVariant,
} from './commands/experiments.js';
import {
  FLOW_ANALYTICS_KINDS,
  isFlowAnalyticsKind,
  runAnalyticsAppOverview,
  runAnalyticsFlow,
} from './commands/analytics.js';
import {
  runRolloutsApprove,
  runRolloutsChannelList,
  runRolloutsGet,
  runRolloutsList,
  runRolloutsPolicy,
  runRolloutsPolicySet,
  runRolloutsReject,
  runRolloutsSubmit,
} from './commands/rollouts.js';
import {
  runMediaArchive,
  runMediaConfirm,
  runMediaList,
  runMediaRename,
  runMediaSignUpload,
  runMediaUpload,
} from './commands/media.js';
import { printBanner } from './banner.js';
import { ENGAGE_USAGE, runEngageCommand } from './commands/engage.js';
import {
  PRODUCT_ANALYTICS_USAGE,
  runProductAnalyticsCommand,
} from './commands/productAnalytics.js';
import { runCustomersCommand } from './commands/customers.js';
import { BANNERS_USAGE, runBannersCommand } from './commands/banners.js';
import { KEYS_USAGE, runAppsKeysList, runKeysCommand } from './commands/keys.js';
import { MEMBERS_USAGE, runMembersCommand } from './commands/members.js';
import { BILLING_USAGE, runBillingStatus } from './commands/billing.js';
import { runWorkspaceMauSidebar, runWorkspaceUpdate } from './commands/workspaceCmd.js';
import {
  runFlowCommentsCommand,
  runFlowRheoAgent,
  runRolloutsComment,
} from './commands/comments.js';
import {
  runAiBrandColors,
  runAiTranslateChunk,
  runAppsAttributionSignal,
  runMeCommand,
  runMediaUsage,
  runNotificationsCommand,
  runOnboardingCommand,
  runSelfServeCommand,
  runStoreListingLookup,
} from './commands/workspaceSurface.js';
import { IMPORT_USAGE, runImportCommand } from './commands/importCmd.js';

export type GlobalFlags = {
  json: boolean;
  table: boolean;
  dryRun: boolean;
  profile?: string;
  apiUrl?: string;
  help: boolean;
};

const usage = `rheo: Rheo CLI (agent-oriented; writes follow your workspace role)

Auth:
  rheo auth login --api-key <key> [--profile <name>] [--api-url <url>]
  rheo auth logout [--profile <name>]
  rheo auth status [--profile <name>]
  rheo version

Workspace / apps:
  rheo whoami | rheo workspace show | rheo workspace update --body|--file
  rheo workspace mau-sidebar
  rheo apps list | rheo apps get <appId>
  rheo apps create --body|--file
  rheo apps update <appId> --body|--file
  rheo apps branding <appId> --body|--file
  rheo apps delete <appId> --confirm-name <name>
  rheo apps keys list <appId>
  rheo apps attribution-signal <appId>

Customers:
  rheo customers overview|list <appId>
  rheo customers get|variables <appId> <appUserId>

Flows:
  rheo flows list <appId> [--include-archived] | rheo flows get <flowId>
  rheo flows draft <flowId> [--out <file>]
  rheo flows versions <flowId> | rheo flows version <flowId> <versionId> [--out <file>]
  rheo flows create <appId> --body|--file
  rheo flows update <flowId> --body|--file
  rheo flows save-draft <flowId> --body|--file
  rheo flows publish <flowId> [--body|--file]
  rheo flows archive|unarchive <flowId>
  rheo flows duplicate <flowId> [--body|--file]
  rheo flows comments … | rheo flows rheo-agent <flowId> --body|--file

Banners (rheo banners help):
  rheo banners list|create <appId> …
  rheo banners get|update|draft|publish|rheo-agent <bannerId> …

Channels:
  rheo channels list <appId> [--include-archived]
  rheo channels history <appId> <channelId> [--limit N] [--offset N]
  rheo channels create <appId> --body|--file
  rheo channels update <appId> <channelId> --body|--file
  rheo channels archive <appId> <channelId> --confirm-name <name>
  rheo channels unarchive <appId> <channelId>
  rheo channels assign <appId> <channelId> --body|--file
  rheo channels unassign <appId> <channelId>

Experiments:
  rheo experiments list <appId> | rheo experiments get <experimentId>
  rheo experiments stats|stats-timeseries|cohort-keys <experimentId>
  rheo experiments cohort-values <experimentId> --dimension <dim>
  rheo experiments create <appId> --body|--file
  rheo experiments update|delete|status|extend|stop|promote <experimentId> …
  rheo experiments add-variant|reorder-variants <experimentId> --body|--file
  rheo experiments update-variant|delete-variant <experimentId> <variantId> …

Analytics (default --env live; omit dates → last 7 UTC days):
  rheo analytics app-overview <appId>
  rheo analytics <kind> <flowId>
  kinds: ${FLOW_ANALYTICS_KINDS.join(', ')}
  rheo analytics product <view> <appId>
  product views: rheo analytics product help

Rollouts:
  rheo rollouts policy | rheo rollouts policy-set --body|--file
  rheo rollouts list | rheo rollouts get <id>
  rheo rollouts channel-list <appId> <channelId>
  rheo rollouts submit|approve|reject …
  rheo rollouts comment <id> --body|--file

Media:
  rheo media list
  rheo media sign-upload --body|--file
  rheo media confirm --body|--file
  rheo media upload --file <path> [--type] [--content-type] [--name]
  rheo media rename <assetId> --name-stem <stem>
  rheo media archive <assetId>
  rheo media usage <assetId>

Engage (full list: rheo engage help):
  rheo engage overview|health|settings|provider|contacts|templates|segments …
  rheo engage content-blocks|broadcasts|automations|topics|consent|deliverability …
  rheo engage attribute-keys|event-names|test-send|preview-merge-tags|audience-estimate|preference-preview

Keys / members / billing:
  rheo keys workspace list|create|revoke …
  rheo members list|invite|update|remove|transfer-ownership …
  rheo billing status

Workspace surface:
  rheo notifications list [--unread] | read <id> | read-all
  rheo me email-preferences [get|update] | rheo me signup-attribution --body|--file
  rheo onboarding get|verify|complete|dismiss …
  rheo self-serve status|accept-terms|complete-profile-name|complete-workspace-name|tour-dismiss …
  rheo store-listing-lookup --body|--file
  rheo ai brand-colors <appId> --body|--file | rheo ai translate-chunk --body|--file

Local import (rheo import help):
  rheo import validate|normalize|summary|scaffold|audit|audit-publish|profile …

Global flags:
  --json              JSON output (lists); mutations/analytics/stats always JSON
  --table             Force human tables when stdout is not a TTY
  --dry-run           Print mutating HTTP without calling the API
  --profile <name>    Config profile
  --api-url <url>     Override API base URL
  -h, --help          Show help

Env: RHEO_API_KEY, RHEO_API_URL, RHEO_CONFIG_PATH
`;

const VALUE_FLAGS = new Set([
  'api-key',
  'out',
  'env',
  'start',
  'end',
  'version-id',
  'flow-id',
  'dimension',
  'custom-key',
  'limit',
  'offset',
  'cohorts',
  'cohort-dimension',
  'cohort-key',
  'body',
  'file',
  'confirm-name',
  'type',
  'content-type',
  'name',
  'name-stem',
  'q',
  'days',
  'cursor',
  'status',
  'note',
  'platform',
  'segment-id',
  'grain',
  'source',
  'campaign',
  'medium',
  'content',
  'term',
  'adset',
  'creative',
  'country',
  'region',
  'city',
  'browsers',
  'operating-systems',
  'devices',
  'page',
  'entry',
  'exit',
  'value',
  'xf-op-acquisition-channel',
  'xf-op-referrer',
  'xf-op-source',
  'xf-op-campaign',
  'xf-op-medium',
  'xf-op-country',
  'xf-op-region',
  'xf-op-browser',
  'xf-op-os',
  'xf-op-device',
  'xf-op-page',
  'xf-op-event',
  'xf-op-entry',
  'xf-op-exit',
  'filter',
]);

/** Repeated flags. Commas in one value are additional entries. */
const MULTI_VALUE_FLAGS = new Set([
  'xf-acquisition-channel',
  'xf-referrer',
  'xf-source',
  'xf-campaign',
  'xf-medium',
  'xf-country',
  'xf-region',
  'xf-browser',
  'xf-os',
  'xf-device',
  'xf-page',
  'xf-event',
  'xf-entry',
  'xf-exit',
]);

const BOOL_FLAGS = new Set([
  'include-archived',
  'json',
  'table',
  'dry-run',
  'unread',
  'offline-profile',
  'write',
]);

const takeFlagValue = (argv: string[], i: number): { value: string; next: number } | null => {
  const cur = argv[i];
  if (!cur) return null;
  if (cur.includes('=') && cur.startsWith('--')) {
    return { value: cur.slice(cur.indexOf('=') + 1), next: i };
  }
  const next = argv[i + 1];
  if (!next || next.startsWith('-')) return null;
  return { value: next, next: i + 1 };
};

const splitMulti = (raw: string): string[] =>
  raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

const appendMultiFlag = (flags: CliFlags, name: string, raw: string): void => {
  const parts = splitMulti(raw);
  if (parts.length === 0) throw new Error(`--${name} requires a value`);
  const current = flags[name];
  const prev = Array.isArray(current) ? current : [];
  flags[name] = [...prev, ...parts];
};

export const parseArgv = (argv: string[]): {
  globals: GlobalFlags;
  command: string[];
  flags: CliFlags;
} => {
  const globals: GlobalFlags = { json: false, table: false, dryRun: false, help: false };
  const command: string[] = [];
  const flags: CliFlags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === '-h' || arg === '--help') {
      globals.help = true;
      continue;
    }
    if (arg === '--json') {
      globals.json = true;
      continue;
    }
    if (arg === '--table') {
      globals.table = true;
      continue;
    }
    if (arg === '--dry-run') {
      globals.dryRun = true;
      continue;
    }
    if (arg === '--profile' || arg.startsWith('--profile=')) {
      const taken = takeFlagValue(argv, i);
      if (!taken) throw new Error('--profile requires a value');
      globals.profile = taken.value;
      i = taken.next;
      continue;
    }
    if (arg === '--api-url' || arg.startsWith('--api-url=')) {
      const taken = takeFlagValue(argv, i);
      if (!taken) throw new Error('--api-url requires a value');
      globals.apiUrl = taken.value;
      i = taken.next;
      continue;
    }

    const eq = arg.startsWith('--') ? arg.indexOf('=') : -1;
    const name = arg.startsWith('--')
      ? eq >= 0
        ? arg.slice(2, eq)
        : arg.slice(2)
      : null;

    if (name && BOOL_FLAGS.has(name) && eq < 0) {
      flags[name] = true;
      continue;
    }
    if (name && MULTI_VALUE_FLAGS.has(name)) {
      const taken = takeFlagValue(argv, i);
      if (!taken) throw new Error(`--${name} requires a value`);
      appendMultiFlag(flags, name, taken.value);
      i = taken.next;
      continue;
    }
    if (name && VALUE_FLAGS.has(name)) {
      const taken = takeFlagValue(argv, i);
      if (!taken) throw new Error(`--${name} requires a value`);
      flags[name] = taken.value;
      i = taken.next;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown flag: ${arg}`);
    }
    command.push(arg);
  }
  return { globals, command, flags };
};

const needArg = (value: string | undefined, label: string): string | null => {
  if (!value) {
    process.stderr.write(`Missing ${label}\n`);
    return null;
  }
  return value;
};

export const runCli = async (argv: string[]): Promise<number> => {
  const importIdx = argv.indexOf('import');
  if (importIdx >= 0) {
    let globals: GlobalFlags;
    try {
      globals = parseArgv(argv.slice(0, importIdx)).globals;
    } catch (err) {
      process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
      return 1;
    }
    if (globals.help) {
      process.stdout.write(IMPORT_USAGE);
      return 0;
    }
    return runImportCommand(argv.slice(importIdx + 1));
  }

  let parsed;
  try {
    parsed = parseArgv(argv);
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }

  const { globals, command, flags } = parsed;
  const jsonOut = preferJson({ json: globals.json, table: globals.table });
  if (globals.help || command.length === 0) {
    if (!jsonOut) printBanner();
    process.stdout.write(usage);
    return command.length === 0 && !globals.help ? 1 : 0;
  }

  const [cmd, sub, ...rest] = command;

  if (cmd === 'version') {
    return runVersion({ json: jsonOut });
  }

  if (cmd === 'auth') {
    if (sub === 'login') {
      const apiKey = flagString(flags, 'api-key') ?? '';
      if (!apiKey) {
        process.stderr.write('Missing --api-key\n');
        return 1;
      }
      return await runAuthLogin({
        apiKey,
        profile: globals.profile ?? 'default',
        apiUrl: globals.apiUrl,
        json: jsonOut,
        configPath: resolveConfigPath(),
      });
    }
    if (sub === 'logout') {
      return runAuthLogout({
        profile: globals.profile,
        json: jsonOut,
        configPath: resolveConfigPath(),
      });
    }
    if (sub === 'status') {
      return runAuthStatus({
        profile: globals.profile,
        apiUrl: globals.apiUrl,
        json: jsonOut,
        configPath: resolveConfigPath(),
      });
    }
    process.stderr.write(`Unknown auth command: ${sub ?? '(none)'}\n`);
    return 1;
  }

  if (cmd === 'login') {
    const apiKey = flagString(flags, 'api-key') ?? '';
    if (!apiKey) {
      process.stderr.write('Missing --api-key\n');
      return 1;
    }
    return await runAuthLogin({
      apiKey,
      profile: globals.profile ?? 'default',
      apiUrl: globals.apiUrl,
      json: jsonOut,
    });
  }
  if (cmd === 'logout') {
    return runAuthLogout({ profile: globals.profile, json: jsonOut });
  }

  if (cmd === 'analytics' && sub === 'product' && (!rest[0] || rest[0] === 'help')) {
    process.stdout.write(PRODUCT_ANALYTICS_USAGE);
    return rest[0] === 'help' ? 0 : 1;
  }

  let auth;
  try {
    auth = resolveAuth({ profile: globals.profile, apiUrl: globals.apiUrl });
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }
  const http = createHttpClient({
    apiUrl: auth.apiUrl,
    apiKey: auth.apiKey,
    dryRun: globals.dryRun,
  });

  const rangeFlags = {
    start: flagString(flags, 'start'),
    end: flagString(flags, 'end'),
  };

  const jsonBody = (opts?: { optional?: boolean; emptyObjectWhenMissing?: boolean }) =>
    resolveJsonPayload(flags, opts);

  try {
    if (cmd === 'whoami' || (cmd === 'workspace' && sub === 'show')) {
      return await runWhoami({ http, json: jsonOut });
    }
    if (cmd === 'workspace' && sub === 'update') {
      return await runWorkspaceUpdate({ http, flags });
    }
    if (cmd === 'workspace' && sub === 'mau-sidebar') {
      return await runWorkspaceMauSidebar({ http });
    }

    if (cmd === 'apps' && sub === 'list') return await runAppsList({ http, json: jsonOut });
    if (cmd === 'apps' && sub === 'get') {
      const appId = needArg(rest[0], '<appId>');
      if (!appId) return 1;
      return await runAppsGet({ http, appId, json: jsonOut });
    }
    if (cmd === 'apps' && sub === 'keys' && rest[0] === 'list') {
      const appId = needArg(rest[1], '<appId>');
      if (!appId) return 1;
      return await runAppsKeysList({ http, appId, json: jsonOut });
    }
    if (cmd === 'apps' && sub === 'attribution-signal') {
      const appId = needArg(rest[0], '<appId>');
      if (!appId) return 1;
      return await runAppsAttributionSignal({ http, appId });
    }
    if (cmd === 'apps' && sub === 'create') {
      return await runAppsCreate({ http, body: jsonBody() });
    }
    if (cmd === 'apps' && sub === 'update') {
      const appId = needArg(rest[0], '<appId>');
      if (!appId) return 1;
      return await runAppsUpdate({ http, appId, body: jsonBody() });
    }
    if (cmd === 'apps' && sub === 'branding') {
      const appId = needArg(rest[0], '<appId>');
      if (!appId) return 1;
      return await runAppsBranding({ http, appId, body: jsonBody() });
    }
    if (cmd === 'apps' && sub === 'delete') {
      const appId = needArg(rest[0], '<appId>');
      if (!appId) return 1;
      return await runAppsDelete({
        http,
        appId,
        confirmName: requireFlag(flags, 'confirm-name'),
      });
    }

    if (cmd === 'flows' && sub === 'list') {
      const appId = needArg(rest[0], '<appId>');
      if (!appId) return 1;
      return await runFlowsList({
        http,
        appId,
        includeArchived: flagBool(flags, 'include-archived'),
        json: jsonOut,
      });
    }
    if (cmd === 'flows' && sub === 'get') {
      const flowId = needArg(rest[0], '<flowId>');
      if (!flowId) return 1;
      return await runFlowsGet({ http, flowId, json: jsonOut });
    }
    if (cmd === 'flows' && sub === 'draft') {
      const flowId = needArg(rest[0], '<flowId>');
      if (!flowId) return 1;
      return await runFlowsDraft({
        http,
        flowId,
        out: flagString(flags, 'out'),
        json: jsonOut,
      });
    }
    if (cmd === 'flows' && sub === 'versions') {
      const flowId = needArg(rest[0], '<flowId>');
      if (!flowId) return 1;
      return await runFlowsVersions({ http, flowId, json: jsonOut });
    }
    if (cmd === 'flows' && sub === 'version') {
      const flowId = needArg(rest[0], '<flowId>');
      const versionId = needArg(rest[1], '<versionId>');
      if (!flowId || !versionId) return 1;
      return await runFlowsVersion({
        http,
        flowId,
        versionId,
        out: flagString(flags, 'out'),
        json: jsonOut,
      });
    }
    if (cmd === 'flows' && sub === 'create') {
      const appId = needArg(rest[0], '<appId>');
      if (!appId) return 1;
      return await runFlowsCreate({ http, appId, body: jsonBody() });
    }
    if (cmd === 'flows' && sub === 'update') {
      const flowId = needArg(rest[0], '<flowId>');
      if (!flowId) return 1;
      return await runFlowsUpdate({ http, flowId, body: jsonBody() });
    }
    if (cmd === 'flows' && sub === 'save-draft') {
      const flowId = needArg(rest[0], '<flowId>');
      if (!flowId) return 1;
      return await runFlowsSaveDraft({ http, flowId, body: jsonBody() });
    }
    if (cmd === 'flows' && sub === 'publish') {
      const flowId = needArg(rest[0], '<flowId>');
      if (!flowId) return 1;
      return await runFlowsPublish({
        http,
        flowId,
        body: jsonBody({ optional: true, emptyObjectWhenMissing: true }),
      });
    }
    if (cmd === 'flows' && sub === 'archive') {
      const flowId = needArg(rest[0], '<flowId>');
      if (!flowId) return 1;
      return await runFlowsArchive({ http, flowId });
    }
    if (cmd === 'flows' && sub === 'unarchive') {
      const flowId = needArg(rest[0], '<flowId>');
      if (!flowId) return 1;
      return await runFlowsUnarchive({ http, flowId });
    }
    if (cmd === 'flows' && sub === 'duplicate') {
      const flowId = needArg(rest[0], '<flowId>');
      if (!flowId) return 1;
      return await runFlowsDuplicate({
        http,
        flowId,
        body: jsonBody({ optional: true, emptyObjectWhenMissing: true }),
      });
    }
    if (cmd === 'flows' && sub === 'comments') {
      return await runFlowCommentsCommand({
        http,
        args: rest,
        flags,
        json: jsonOut,
      });
    }
    if (cmd === 'flows' && sub === 'rheo-agent') {
      const flowId = needArg(rest[0], '<flowId>');
      if (!flowId) return 1;
      return await runFlowRheoAgent({ http, flowId, flags });
    }

    if (cmd === 'customers') {
      return await runCustomersCommand({
        http,
        args: [sub, ...rest].filter(Boolean) as string[],
        flags,
        json: jsonOut,
      });
    }

    if (cmd === 'banners') {
      if (!sub || sub === 'help') {
        process.stdout.write(BANNERS_USAGE);
        return sub === 'help' ? 0 : 1;
      }
      return await runBannersCommand({
        http,
        args: [sub, ...rest],
        flags,
        json: jsonOut,
      });
    }

    if (cmd === 'channels' && sub === 'list') {
      const appId = needArg(rest[0], '<appId>');
      if (!appId) return 1;
      return await runChannelsList({
        http,
        appId,
        includeArchived: flagBool(flags, 'include-archived'),
        json: jsonOut,
      });
    }
    if (cmd === 'channels' && sub === 'history') {
      const appId = needArg(rest[0], '<appId>');
      const channelId = needArg(rest[1], '<channelId>');
      if (!appId || !channelId) return 1;
      return await runChannelsHistory({
        http,
        appId,
        channelId,
        limit: flagString(flags, 'limit'),
        offset: flagString(flags, 'offset'),
        json: jsonOut,
      });
    }
    if (cmd === 'channels' && sub === 'create') {
      const appId = needArg(rest[0], '<appId>');
      if (!appId) return 1;
      return await runChannelsCreate({ http, appId, body: jsonBody() });
    }
    if (cmd === 'channels' && sub === 'update') {
      const appId = needArg(rest[0], '<appId>');
      const channelId = needArg(rest[1], '<channelId>');
      if (!appId || !channelId) return 1;
      return await runChannelsUpdate({ http, appId, channelId, body: jsonBody() });
    }
    if (cmd === 'channels' && sub === 'archive') {
      const appId = needArg(rest[0], '<appId>');
      const channelId = needArg(rest[1], '<channelId>');
      if (!appId || !channelId) return 1;
      return await runChannelsArchive({
        http,
        appId,
        channelId,
        confirmName: requireFlag(flags, 'confirm-name'),
      });
    }
    if (cmd === 'channels' && sub === 'unarchive') {
      const appId = needArg(rest[0], '<appId>');
      const channelId = needArg(rest[1], '<channelId>');
      if (!appId || !channelId) return 1;
      return await runChannelsUnarchive({ http, appId, channelId });
    }
    if (cmd === 'channels' && sub === 'assign') {
      const appId = needArg(rest[0], '<appId>');
      const channelId = needArg(rest[1], '<channelId>');
      if (!appId || !channelId) return 1;
      return await runChannelsAssign({ http, appId, channelId, body: jsonBody() });
    }
    if (cmd === 'channels' && sub === 'unassign') {
      const appId = needArg(rest[0], '<appId>');
      const channelId = needArg(rest[1], '<channelId>');
      if (!appId || !channelId) return 1;
      return await runChannelsUnassign({ http, appId, channelId });
    }

    if (cmd === 'experiments' && sub === 'list') {
      const appId = needArg(rest[0], '<appId>');
      if (!appId) return 1;
      return await runExperimentsList({
        http,
        appId,
        includeArchived: flagBool(flags, 'include-archived'),
        json: jsonOut,
      });
    }
    if (cmd === 'experiments' && sub === 'get') {
      const experimentId = needArg(rest[0], '<experimentId>');
      if (!experimentId) return 1;
      return await runExperimentsGet({ http, experimentId });
    }
    if (cmd === 'experiments' && sub === 'stats') {
      const experimentId = needArg(rest[0], '<experimentId>');
      if (!experimentId) return 1;
      return await runExperimentsStats({
        http,
        experimentId,
        ...rangeFlags,
        cohorts: flagString(flags, 'cohorts'),
        cohortDimension: flagString(flags, 'cohort-dimension'),
        cohortKey: flagString(flags, 'cohort-key'),
        customKey: flagString(flags, 'custom-key'),
      });
    }
    if (cmd === 'experiments' && sub === 'stats-timeseries') {
      const experimentId = needArg(rest[0], '<experimentId>');
      if (!experimentId) return 1;
      return await runExperimentsStatsTimeseries({
        http,
        experimentId,
        ...rangeFlags,
        cohorts: flagString(flags, 'cohorts'),
        cohortDimension: flagString(flags, 'cohort-dimension'),
        cohortKey: flagString(flags, 'cohort-key'),
        customKey: flagString(flags, 'custom-key'),
      });
    }
    if (cmd === 'experiments' && sub === 'cohort-keys') {
      const experimentId = needArg(rest[0], '<experimentId>');
      if (!experimentId) return 1;
      return await runExperimentsCohortKeys({
        http,
        experimentId,
        ...rangeFlags,
        cohorts: flagString(flags, 'cohorts'),
      });
    }
    if (cmd === 'experiments' && sub === 'cohort-values') {
      const experimentId = needArg(rest[0], '<experimentId>');
      if (!experimentId) return 1;
      return await runExperimentsCohortValues({
        http,
        experimentId,
        dimension: requireFlag(flags, 'dimension'),
        customKey: flagString(flags, 'custom-key'),
        ...rangeFlags,
        cohorts: flagString(flags, 'cohorts'),
      });
    }
    if (cmd === 'experiments' && sub === 'create') {
      const appId = needArg(rest[0], '<appId>');
      if (!appId) return 1;
      return await runExperimentsCreate({ http, appId, body: jsonBody() });
    }
    if (cmd === 'experiments' && sub === 'update') {
      const experimentId = needArg(rest[0], '<experimentId>');
      if (!experimentId) return 1;
      return await runExperimentsUpdate({ http, experimentId, body: jsonBody() });
    }
    if (cmd === 'experiments' && sub === 'delete') {
      const experimentId = needArg(rest[0], '<experimentId>');
      if (!experimentId) return 1;
      return await runExperimentsDelete({ http, experimentId });
    }
    if (cmd === 'experiments' && sub === 'add-variant') {
      const experimentId = needArg(rest[0], '<experimentId>');
      if (!experimentId) return 1;
      return await runExperimentsAddVariant({ http, experimentId, body: jsonBody() });
    }
    if (cmd === 'experiments' && sub === 'update-variant') {
      const experimentId = needArg(rest[0], '<experimentId>');
      const variantId = needArg(rest[1], '<variantId>');
      if (!experimentId || !variantId) return 1;
      return await runExperimentsUpdateVariant({
        http,
        experimentId,
        variantId,
        body: jsonBody(),
      });
    }
    if (cmd === 'experiments' && sub === 'delete-variant') {
      const experimentId = needArg(rest[0], '<experimentId>');
      const variantId = needArg(rest[1], '<variantId>');
      if (!experimentId || !variantId) return 1;
      return await runExperimentsDeleteVariant({ http, experimentId, variantId });
    }
    if (cmd === 'experiments' && sub === 'reorder-variants') {
      const experimentId = needArg(rest[0], '<experimentId>');
      if (!experimentId) return 1;
      return await runExperimentsReorderVariants({ http, experimentId, body: jsonBody() });
    }
    if (cmd === 'experiments' && sub === 'status') {
      const experimentId = needArg(rest[0], '<experimentId>');
      if (!experimentId) return 1;
      return await runExperimentsStatus({ http, experimentId, body: jsonBody() });
    }
    if (cmd === 'experiments' && sub === 'extend') {
      const experimentId = needArg(rest[0], '<experimentId>');
      if (!experimentId) return 1;
      return await runExperimentsExtend({ http, experimentId, body: jsonBody() });
    }
    if (cmd === 'experiments' && sub === 'stop') {
      const experimentId = needArg(rest[0], '<experimentId>');
      if (!experimentId) return 1;
      return await runExperimentsStop({ http, experimentId, body: jsonBody() });
    }
    if (cmd === 'experiments' && sub === 'promote') {
      const experimentId = needArg(rest[0], '<experimentId>');
      if (!experimentId) return 1;
      return await runExperimentsPromote({ http, experimentId, body: jsonBody() });
    }

    if (cmd === 'analytics' && sub === 'app-overview') {
      const appId = needArg(rest[0], '<appId>');
      if (!appId) return 1;
      return await runAnalyticsAppOverview({
        http,
        appId,
        env: flagString(flags, 'env'),
        flowId: flagString(flags, 'flow-id'),
        ...rangeFlags,
      });
    }
    if (cmd === 'analytics' && sub === 'product') {
      return await runProductAnalyticsCommand({ http, args: rest, flags });
    }
    if (cmd === 'analytics' && sub && isFlowAnalyticsKind(sub)) {
      const flowId = needArg(rest[0], '<flowId>');
      if (!flowId) return 1;
      return await runAnalyticsFlow({
        http,
        kind: sub,
        flowId,
        env: flagString(flags, 'env'),
        versionId: flagString(flags, 'version-id'),
        dimension: flagString(flags, 'dimension'),
        customKey: flagString(flags, 'custom-key'),
        ...rangeFlags,
      });
    }

    if (cmd === 'rollouts' && sub === 'policy') return await runRolloutsPolicy({ http });
    if (cmd === 'rollouts' && sub === 'policy-set') {
      return await runRolloutsPolicySet({ http, body: jsonBody() });
    }
    if (cmd === 'rollouts' && sub === 'list') {
      return await runRolloutsList({ http, json: jsonOut });
    }
    if (cmd === 'rollouts' && sub === 'channel-list') {
      const appId = needArg(rest[0], '<appId>');
      const channelId = needArg(rest[1], '<channelId>');
      if (!appId || !channelId) return 1;
      return await runRolloutsChannelList({ http, appId, channelId });
    }
    if (cmd === 'rollouts' && sub === 'get') {
      const id = needArg(rest[0], '<id>');
      if (!id) return 1;
      return await runRolloutsGet({ http, id });
    }
    if (cmd === 'rollouts' && sub === 'submit') {
      return await runRolloutsSubmit({ http, body: jsonBody() });
    }
    if (cmd === 'rollouts' && sub === 'approve') {
      const id = needArg(rest[0], '<id>');
      if (!id) return 1;
      return await runRolloutsApprove({
        http,
        id,
        body: jsonBody({ optional: true, emptyObjectWhenMissing: true }),
      });
    }
    if (cmd === 'rollouts' && sub === 'reject') {
      const id = needArg(rest[0], '<id>');
      if (!id) return 1;
      return await runRolloutsReject({
        http,
        id,
        body: jsonBody({ optional: true, emptyObjectWhenMissing: true }),
      });
    }
    if (cmd === 'rollouts' && sub === 'comment') {
      const id = needArg(rest[0], '<id>');
      if (!id) return 1;
      return await runRolloutsComment({ http, id, flags });
    }

    if (cmd === 'media' && sub === 'list') {
      return await runMediaList({ http, json: jsonOut });
    }
    if (cmd === 'media' && sub === 'sign-upload') {
      return await runMediaSignUpload({ http, body: jsonBody() });
    }
    if (cmd === 'media' && sub === 'confirm') {
      return await runMediaConfirm({ http, body: jsonBody() });
    }
    if (cmd === 'media' && sub === 'upload') {
      return await runMediaUpload({
        http,
        filePath: requireFlag(flags, 'file'),
        type: flagString(flags, 'type'),
        contentType: flagString(flags, 'content-type'),
        name: flagString(flags, 'name'),
      });
    }
    if (cmd === 'media' && sub === 'rename') {
      const assetId = needArg(rest[0], '<assetId>');
      if (!assetId) return 1;
      return await runMediaRename({
        http,
        assetId,
        nameStem: requireFlag(flags, 'name-stem'),
      });
    }
    if (cmd === 'media' && sub === 'archive') {
      const assetId = needArg(rest[0], '<assetId>');
      if (!assetId) return 1;
      return await runMediaArchive({ http, assetId });
    }
    if (cmd === 'media' && sub === 'usage') {
      const assetId = needArg(rest[0], '<assetId>');
      if (!assetId) return 1;
      return await runMediaUsage({ http, assetId });
    }

    if (cmd === 'engage') {
      if (!sub || sub === 'help') {
        process.stdout.write(ENGAGE_USAGE);
        return sub === 'help' ? 0 : 1;
      }
      return await runEngageCommand({
        http,
        args: [sub, ...rest],
        flags,
        json: jsonOut,
      });
    }

    if (cmd === 'keys') {
      if (!sub || sub === 'help') {
        process.stdout.write(KEYS_USAGE);
        return sub === 'help' ? 0 : 1;
      }
      return await runKeysCommand({
        http,
        args: [sub, ...rest],
        flags,
        json: jsonOut,
      });
    }

    if (cmd === 'members') {
      if (!sub || sub === 'help') {
        process.stdout.write(MEMBERS_USAGE);
        return sub === 'help' ? 0 : 1;
      }
      return await runMembersCommand({
        http,
        args: [sub, ...rest],
        flags,
        json: jsonOut,
      });
    }

    if (cmd === 'billing') {
      if (sub === 'status') return await runBillingStatus({ http });
      process.stdout.write(BILLING_USAGE);
      return sub === 'help' ? 0 : 1;
    }

    if (cmd === 'notifications') {
      return await runNotificationsCommand({
        http,
        args: [sub, ...rest].filter(Boolean) as string[],
        flags,
        json: jsonOut,
      });
    }

    if (cmd === 'me') {
      return await runMeCommand({
        http,
        args: [sub, ...rest].filter(Boolean) as string[],
        flags,
      });
    }

    if (cmd === 'onboarding') {
      return await runOnboardingCommand({
        http,
        args: [sub, ...rest].filter(Boolean) as string[],
        flags,
      });
    }

    if (cmd === 'self-serve') {
      return await runSelfServeCommand({
        http,
        args: [sub, ...rest].filter(Boolean) as string[],
        flags,
      });
    }

    if (cmd === 'store-listing-lookup') {
      return await runStoreListingLookup({ http, flags });
    }

    if (cmd === 'ai' && sub === 'brand-colors') {
      const appId = needArg(rest[0], '<appId>');
      if (!appId) return 1;
      return await runAiBrandColors({ http, appId, flags });
    }
    if (cmd === 'ai' && sub === 'translate-chunk') {
      return await runAiTranslateChunk({ http, flags });
    }

    process.stderr.write(`Unknown command: ${command.join(' ')}\n`);
    process.stderr.write(usage);
    return 1;
  } catch (err) {
    if (err instanceof CliHttpError) {
      process.stderr.write(`${err.message}\n`);
      return err.status === 401 || err.status === 403 ? 2 : 1;
    }
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }
};
