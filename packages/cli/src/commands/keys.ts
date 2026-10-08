import { resolveJsonPayload } from '../body.js';
import { printJson, printTable } from '../format.js';
import type { HttpClient } from '../http.js';
import type { CliFlags } from '../query.js';

const need = (value: string | undefined, label: string): string => {
  if (!value) throw new Error(`Missing ${label}`);
  return value;
};

export const KEYS_USAGE = `rheo keys: workspace API keys (CLI keys)

  rheo keys workspace list
  rheo keys workspace create --body|--file
  rheo keys workspace revoke <id>
`;

export const runAppsKeysList = async (opts: {
  http: HttpClient;
  appId: string;
  json?: boolean;
}): Promise<number> => {
  const body = (await opts.http.get(`/v1/dashboard/apps/${opts.appId}/keys`)) as {
    items?: Array<{ id: string; prefix?: string; createdAt?: string; revokedAt?: string | null }>;
  };
  if (opts.json) {
    printJson(body);
    return 0;
  }
  printTable(
    (body.items ?? []).map((row) => ({
      id: row.id,
      prefix: row.prefix ?? '',
      createdAt: row.createdAt ?? '',
      revoked: row.revokedAt ? 'yes' : 'no',
    })),
  );
  return 0;
};

export const runKeysCommand = async (opts: {
  http: HttpClient;
  args: string[];
  flags: CliFlags;
  json: boolean;
}): Promise<number> => {
  const [scope, action, id] = opts.args;
  if (!scope || scope === 'help') {
    process.stdout.write(KEYS_USAGE);
    return scope === 'help' ? 0 : 1;
  }
  if (scope !== 'workspace') {
    process.stderr.write(`Unknown keys scope: ${scope}\n`);
    process.stderr.write(KEYS_USAGE);
    return 1;
  }

  if (action === 'list') {
    const body = (await opts.http.get('/v1/dashboard/workspace-api-keys')) as {
      items?: Array<{ id: string; name?: string; prefix?: string; createdAt?: string }>;
    };
    if (opts.json) {
      printJson(body);
      return 0;
    }
    printTable(
      (body.items ?? []).map((row) => ({
        id: row.id,
        name: row.name ?? '',
        prefix: row.prefix ?? '',
        createdAt: row.createdAt ?? '',
      })),
    );
    return 0;
  }
  if (action === 'create') {
    printJson(
      await opts.http.post('/v1/dashboard/workspace-api-keys', resolveJsonPayload(opts.flags)),
    );
    return 0;
  }
  if (action === 'revoke') {
    const keyId = need(id, '<id>');
    printJson(await opts.http.delete(`/v1/dashboard/workspace-api-keys/${keyId}`));
    return 0;
  }

  process.stderr.write(`Unknown keys workspace command: ${action ?? '(none)'}\n`);
  process.stderr.write(KEYS_USAGE);
  return 1;
};
