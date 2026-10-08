import { resolveDateRange } from '../dateRange.js';
import { printJson, printTable } from '../format.js';
import type { HttpClient } from '../http.js';
import { flagString, parseEnvironment, type CliFlags } from '../query.js';

const need = (value: string | undefined, label: string): string => {
  if (!value) throw new Error(`Missing ${label}`);
  return value;
};

const cell = (value: unknown): string => {
  if (value == null) return '';
  return String(value);
};

export const CUSTOMERS_USAGE = `rheo customers: customer directory (customers:read)

  rheo customers overview <appId> [--env] [--start] [--end]
  rheo customers list <appId> [--env] [--start] [--end] [--q] [--limit] [--offset]
  rheo customers get <appId> <appUserId> [--env] [--start] [--end]
  rheo customers variables <appId> <appUserId> [--env]
`;

export const runCustomersCommand = async (opts: {
  http: HttpClient;
  args: string[];
  flags: CliFlags;
  json: boolean;
}): Promise<number> => {
  const [action, appIdArg, appUserIdArg] = opts.args;
  if (!action || action === 'help') {
    process.stdout.write(CUSTOMERS_USAGE);
    return action === 'help' ? 0 : 1;
  }

  const appId = need(appIdArg, '<appId>');
  const environment = parseEnvironment(flagString(opts.flags, 'env'));
  const base = `/v1/dashboard/apps/${appId}/customers`;

  if (action === 'overview') {
    const range = resolveDateRange({
      start: flagString(opts.flags, 'start'),
      end: flagString(opts.flags, 'end'),
    });
    const body = await opts.http.get(`${base}/overview`, {
      environment,
      startDate: range.startDate,
      endDate: range.endDate,
    });
    printJson(body);
    return 0;
  }

  if (action === 'list') {
    const range = resolveDateRange({
      start: flagString(opts.flags, 'start'),
      end: flagString(opts.flags, 'end'),
    });
    const body = (await opts.http.get(base, {
      environment,
      startDate: range.startDate,
      endDate: range.endDate,
      q: flagString(opts.flags, 'q'),
      limit: flagString(opts.flags, 'limit'),
      offset: flagString(opts.flags, 'offset'),
    })) as { items?: Array<Record<string, unknown>>; total?: number };
    if (opts.json) {
      printJson(body);
      return 0;
    }
    printTable(
      (body.items ?? []).map((row) => ({
        appUserId: cell(row.appUserId),
        email: cell(row.email),
        lastSeenAt: cell(row.lastSeenAt),
      })),
    );
    if (typeof body.total === 'number') process.stdout.write(`total ${body.total}\n`);
    return 0;
  }

  if (action === 'get') {
    const appUserId = need(appUserIdArg, '<appUserId>');
    const range = resolveDateRange({
      start: flagString(opts.flags, 'start'),
      end: flagString(opts.flags, 'end'),
    });
    const body = await opts.http.get(`${base}/${encodeURIComponent(appUserId)}`, {
      environment,
      startDate: range.startDate,
      endDate: range.endDate,
    });
    printJson(body);
    return 0;
  }

  if (action === 'variables') {
    const appUserId = need(appUserIdArg, '<appUserId>');
    const body = await opts.http.get(
      `${base}/${encodeURIComponent(appUserId)}/variables`,
      { environment },
    );
    printJson(body);
    return 0;
  }

  process.stderr.write(`Unknown customers command: ${action}\n`);
  process.stderr.write(CUSTOMERS_USAGE);
  return 1;
};
