import type { HttpClient } from '../http.js';
import { printJson, printKv } from '../format.js';

const PRODUCT_WRITE_CAPS = [
  'app:manage',
  'app:settings',
  'flow:edit',
  'flow:publish',
  'channel:manage',
  'experiment:manage',
  'media:manage',
  'rollout:approve',
] as const;

export const runWhoami = async (opts: {
  http: HttpClient;
  json?: boolean;
}): Promise<number> => {
  const [workspace, access] = await Promise.all([
    opts.http.get('/v1/dashboard/workspace') as Promise<{ name?: string }>,
    opts.http.get('/v1/dashboard/workspace-access') as Promise<{
      workspaceRole?: string;
      planKey?: string;
      capabilities?: string[];
    }>,
  ]);
  const caps = new Set(access.capabilities ?? []);
  const canWrite = PRODUCT_WRITE_CAPS.filter((c) => caps.has(c));
  const payload = {
    workspaceName: workspace.name ?? null,
    workspaceRole: access.workspaceRole ?? null,
    planKey: access.planKey ?? null,
    capabilities: access.capabilities ?? [],
    canWrite,
  };
  if (opts.json) printJson(payload);
  else {
    printKv([
      ['workspace', payload.workspaceName ?? ''],
      ['role', payload.workspaceRole ?? ''],
      ['plan', payload.planKey ?? ''],
      ['canWrite', canWrite.length ? canWrite.join(',') : '(none)'],
    ]);
  }
  return 0;
};
