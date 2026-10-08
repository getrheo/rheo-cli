import { resolveJsonPayload } from '../body.js';
import { printJson, printTable } from '../format.js';
import type { HttpClient } from '../http.js';
import { flagString, type CliFlags } from '../query.js';

const need = (value: string | undefined, label: string): string => {
  if (!value) throw new Error(`Missing ${label}`);
  return value;
};

export const FLOW_COMMENTS_USAGE = `rheo flows comments:

  rheo flows comments list <flowId> [--filter <value>]
  rheo flows comments get <flowId> <threadId>
  rheo flows comments create <flowId> --body|--file
  rheo flows comments reply <flowId> <threadId> --body|--file
  rheo flows comments archive|restore <flowId> <threadId>
`;

export const runFlowCommentsCommand = async (opts: {
  http: HttpClient;
  args: string[];
  flags: CliFlags;
  json: boolean;
}): Promise<number> => {
  const [action, flowIdArg, threadIdArg] = opts.args;
  if (!action || action === 'help') {
    process.stdout.write(FLOW_COMMENTS_USAGE);
    return action === 'help' ? 0 : 1;
  }
  const flowId = need(flowIdArg, '<flowId>');
  const base = `/v1/dashboard/flows/${flowId}/comments`;

  if (action === 'list') {
    const body = (await opts.http.get(base, {
      filter: flagString(opts.flags, 'filter'),
    })) as { items?: Array<Record<string, unknown>> };
    if (opts.json) {
      printJson(body);
      return 0;
    }
    printTable(
      (body.items ?? []).map((row) => ({
        id: String(row.id ?? ''),
        status: String(row.status ?? ''),
        updatedAt: String(row.updatedAt ?? ''),
      })),
    );
    return 0;
  }
  if (action === 'get') {
    const threadId = need(threadIdArg, '<threadId>');
    printJson(await opts.http.get(`${base}/${threadId}`));
    return 0;
  }
  if (action === 'create') {
    printJson(await opts.http.post(base, resolveJsonPayload(opts.flags)));
    return 0;
  }
  if (action === 'reply') {
    const threadId = need(threadIdArg, '<threadId>');
    printJson(
      await opts.http.post(`${base}/${threadId}/messages`, resolveJsonPayload(opts.flags)),
    );
    return 0;
  }
  if (action === 'archive') {
    const threadId = need(threadIdArg, '<threadId>');
    printJson(await opts.http.post(`${base}/${threadId}/archive`));
    return 0;
  }
  if (action === 'restore') {
    const threadId = need(threadIdArg, '<threadId>');
    printJson(await opts.http.post(`${base}/${threadId}/restore`));
    return 0;
  }

  process.stderr.write(`Unknown flows comments command: ${action}\n`);
  process.stderr.write(FLOW_COMMENTS_USAGE);
  return 1;
};

export const runFlowRheoAgent = async (opts: {
  http: HttpClient;
  flowId: string;
  flags: CliFlags;
}): Promise<number> => {
  await opts.http.stream(
    'POST',
    `/v1/dashboard/flows/${opts.flowId}/rheo-agent`,
    resolveJsonPayload(opts.flags),
  );
  return 0;
};

export const runRolloutsComment = async (opts: {
  http: HttpClient;
  id: string;
  flags: CliFlags;
}): Promise<number> => {
  printJson(
    await opts.http.post(
      `/v1/dashboard/rollout-requests/${opts.id}/comments`,
      resolveJsonPayload(opts.flags),
    ),
  );
  return 0;
};
