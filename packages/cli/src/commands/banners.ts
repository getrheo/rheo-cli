import { resolveJsonPayload } from '../body.js';
import { printJson, printKv, printTable, writeOutFile } from '../format.js';
import type { HttpClient } from '../http.js';
import { flagBool, flagString, type CliFlags } from '../query.js';

const need = (value: string | undefined, label: string): string => {
  if (!value) throw new Error(`Missing ${label}`);
  return value;
};

export const BANNERS_USAGE = `rheo banners: in-app banners

  rheo banners help
  rheo banners list <appId> [--include-archived]
  rheo banners create <appId> --body|--file
  rheo banners get|update|draft|save-draft|publish|versions|archive|duplicate <bannerId> …
  rheo banners version <bannerId> <versionId> [--out <file>]
  rheo banners rheo-agent <bannerId> --body|--file
`;

type BannerItem = {
  id: string;
  name?: string;
  status?: string;
  updatedAt?: string;
  archivedAt?: string | null;
};

export const runBannersCommand = async (opts: {
  http: HttpClient;
  args: string[];
  flags: CliFlags;
  json: boolean;
}): Promise<number> => {
  const [action, a, b] = opts.args;
  if (!action || action === 'help') {
    process.stdout.write(BANNERS_USAGE);
    return action === 'help' ? 0 : 1;
  }

  const jsonBody = () => resolveJsonPayload(opts.flags);
  const optionalBody = () =>
    resolveJsonPayload(opts.flags, { optional: true, emptyObjectWhenMissing: true });

  if (action === 'list') {
    const appId = need(a, '<appId>');
    const body = (await opts.http.get(`/v1/dashboard/apps/${appId}/banners`, {
      includeArchived: flagBool(opts.flags, 'include-archived') ? 'true' : undefined,
    })) as { items: BannerItem[] };
    if (opts.json) {
      printJson(body);
      return 0;
    }
    printTable(
      body.items.map((row) => ({
        id: row.id,
        name: row.name ?? '',
        status: row.status ?? '',
        archived: row.archivedAt ? 'yes' : 'no',
      })),
    );
    return 0;
  }

  if (action === 'create') {
    const appId = need(a, '<appId>');
    printJson(await opts.http.post(`/v1/dashboard/apps/${appId}/banners`, jsonBody()));
    return 0;
  }

  const bannerId = need(a, '<bannerId>');
  const base = `/v1/dashboard/banners/${bannerId}`;

  if (action === 'get') {
    const body = await opts.http.get(base);
    if (opts.json) {
      printJson(body);
      return 0;
    }
    const banner = (body as { banner?: BannerItem }).banner ?? (body as BannerItem);
    printKv([
      ['id', banner.id],
      ['name', banner.name ?? ''],
      ['status', banner.status ?? ''],
    ]);
    return 0;
  }
  if (action === 'update') {
    printJson(await opts.http.patch(base, jsonBody()));
    return 0;
  }
  if (action === 'draft') {
    const body = await opts.http.get(`${base}/draft`);
    const out = flagString(opts.flags, 'out');
    if (out) {
      await writeOutFile(out, body);
      if (opts.json) printJson({ ok: true, out });
      else process.stdout.write(`Wrote ${out}\n`);
      return 0;
    }
    printJson(body);
    return 0;
  }
  if (action === 'save-draft') {
    printJson(await opts.http.put(`${base}/draft`, jsonBody()));
    return 0;
  }
  if (action === 'publish') {
    printJson(await opts.http.post(`${base}/publish`, optionalBody()));
    return 0;
  }
  if (action === 'versions') {
    const body = (await opts.http.get(`${base}/versions`)) as {
      items?: Array<{ id: string; versionNumber?: number; createdAt?: string }>;
    };
    if (opts.json) {
      printJson(body);
      return 0;
    }
    printTable(
      (body.items ?? []).map((v) => ({
        id: v.id,
        version: v.versionNumber ?? '',
        createdAt: v.createdAt ?? '',
      })),
    );
    return 0;
  }
  if (action === 'version') {
    const versionId = need(b, '<versionId>');
    const body = await opts.http.get(`${base}/versions/${versionId}`);
    const out = flagString(opts.flags, 'out');
    if (out) {
      await writeOutFile(out, body);
      if (opts.json) printJson({ ok: true, out });
      else process.stdout.write(`Wrote ${out}\n`);
      return 0;
    }
    printJson(body);
    return 0;
  }
  if (action === 'archive') {
    printJson(await opts.http.post(`${base}/archive`));
    return 0;
  }
  if (action === 'duplicate') {
    printJson(await opts.http.post(`${base}/duplicate`, optionalBody()));
    return 0;
  }
  if (action === 'rheo-agent') {
    await opts.http.stream('POST', `${base}/rheo-agent`, jsonBody());
    return 0;
  }

  process.stderr.write(`Unknown banners command: ${action}\n`);
  process.stderr.write(BANNERS_USAGE);
  return 1;
};
