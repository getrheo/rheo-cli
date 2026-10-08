import { resolveJsonPayload } from '../body.js';
import { printJson, printTable } from '../format.js';
import type { HttpClient } from '../http.js';
import type { CliFlags } from '../query.js';

const need = (value: string | undefined, label: string): string => {
  if (!value) throw new Error(`Missing ${label}`);
  return value;
};

export const MEMBERS_USAGE = `rheo members: workspace members

  rheo members list
  rheo members invite --body|--file
  rheo members update <userId> --body|--file
  rheo members remove <userId>
  rheo members transfer-ownership --body|--file
`;

export const runMembersCommand = async (opts: {
  http: HttpClient;
  args: string[];
  flags: CliFlags;
  json: boolean;
}): Promise<number> => {
  const [action, userId] = opts.args;
  if (!action || action === 'help') {
    process.stdout.write(MEMBERS_USAGE);
    return action === 'help' ? 0 : 1;
  }

  if (action === 'list') {
    const body = (await opts.http.get('/v1/dashboard/members')) as {
      items?: Array<{ userId: string; email?: string; role?: string }>;
    };
    if (opts.json) {
      printJson(body);
      return 0;
    }
    printTable(
      (body.items ?? []).map((row) => ({
        userId: row.userId,
        email: row.email ?? '',
        role: row.role ?? '',
      })),
    );
    return 0;
  }
  if (action === 'invite') {
    printJson(await opts.http.post('/v1/dashboard/members/invite', resolveJsonPayload(opts.flags)));
    return 0;
  }
  if (action === 'update') {
    const id = need(userId, '<userId>');
    printJson(
      await opts.http.patch(`/v1/dashboard/members/${id}`, resolveJsonPayload(opts.flags)),
    );
    return 0;
  }
  if (action === 'remove') {
    const id = need(userId, '<userId>');
    printJson(await opts.http.delete(`/v1/dashboard/members/${id}`));
    return 0;
  }
  if (action === 'transfer-ownership') {
    printJson(
      await opts.http.post(
        '/v1/dashboard/members/transfer-ownership',
        resolveJsonPayload(opts.flags),
      ),
    );
    return 0;
  }

  process.stderr.write(`Unknown members command: ${action}\n`);
  process.stderr.write(MEMBERS_USAGE);
  return 1;
};
