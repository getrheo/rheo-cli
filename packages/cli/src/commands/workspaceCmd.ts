import { resolveJsonPayload } from '../body.js';
import { printJson } from '../format.js';
import type { HttpClient } from '../http.js';
import type { CliFlags } from '../query.js';

export const runWorkspaceUpdate = async (opts: {
  http: HttpClient;
  flags: CliFlags;
}): Promise<number> => {
  printJson(await opts.http.patch('/v1/dashboard/workspace', resolveJsonPayload(opts.flags)));
  return 0;
};

export const runWorkspaceMauSidebar = async (opts: { http: HttpClient }): Promise<number> => {
  printJson(await opts.http.get('/v1/dashboard/mau-usage-sidebar'));
  return 0;
};
