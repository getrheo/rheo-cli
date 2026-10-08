import type { HttpClient } from '../http.js';
import { printJson, printKv, printTable, writeOutFile } from '../format.js';

type FlowItem = {
  id: string;
  name: string;
  status?: string;
  updatedAt?: string;
};

export const runFlowsList = async (opts: {
  http: HttpClient;
  appId: string;
  includeArchived?: boolean;
  json?: boolean;
}): Promise<number> => {
  const body = (await opts.http.get(`/v1/dashboard/apps/${opts.appId}/flows`, {
    includeArchived: opts.includeArchived ? 'true' : undefined,
  })) as {
    items: FlowItem[];
  };
  if (opts.json) {
    printJson(body);
    return 0;
  }
  printTable(
    body.items.map((f) => ({
      id: f.id,
      name: f.name,
      status: f.status ?? '',
      updatedAt: f.updatedAt ?? '',
    })),
  );
  return 0;
};

export const runFlowsGet = async (opts: {
  http: HttpClient;
  flowId: string;
  json?: boolean;
}): Promise<number> => {
  const body = await opts.http.get(`/v1/dashboard/flows/${opts.flowId}`);
  if (opts.json) {
    printJson(body);
    return 0;
  }
  const flow = (body as { flow?: FlowItem }).flow ?? (body as FlowItem);
  const rows: Array<[string, string | number | null | undefined]> = [
    ['id', flow.id],
    ['name', flow.name],
  ];
  if (flow.status) rows.push(['status', flow.status]);
  printKv(rows);
  return 0;
};

export const runFlowsDraft = async (opts: {
  http: HttpClient;
  flowId: string;
  out?: string;
  json?: boolean;
}): Promise<number> => {
  const body = await opts.http.get(`/v1/dashboard/flows/${opts.flowId}/draft`);
  if (opts.out) {
    await writeOutFile(opts.out, body);
    if (!opts.json) process.stdout.write(`Wrote ${opts.out}\n`);
    else printJson({ ok: true, out: opts.out });
    return 0;
  }
  printJson(body);
  return 0;
};

export const runFlowsVersions = async (opts: {
  http: HttpClient;
  flowId: string;
  json?: boolean;
}): Promise<number> => {
  const body = (await opts.http.get(`/v1/dashboard/flows/${opts.flowId}/versions`)) as {
    items?: Array<{ id: string; versionNumber?: number; label?: string | null; createdAt?: string }>;
  };
  const items = body.items ?? (Array.isArray(body) ? body : []);
  if (opts.json) {
    printJson(body);
    return 0;
  }
  printTable(
    (items as Array<{ id: string; versionNumber?: number; label?: string | null; createdAt?: string }>).map(
      (v) => ({
        id: v.id,
        version: v.versionNumber ?? '',
        label: v.label ?? '',
        createdAt: v.createdAt ?? '',
      }),
    ),
  );
  return 0;
};

export const runFlowsVersion = async (opts: {
  http: HttpClient;
  flowId: string;
  versionId: string;
  out?: string;
  json?: boolean;
}): Promise<number> => {
  const body = await opts.http.get(
    `/v1/dashboard/flows/${opts.flowId}/versions/${opts.versionId}`,
  );
  if (opts.out) {
    await writeOutFile(opts.out, body);
    if (!opts.json) process.stdout.write(`Wrote ${opts.out}\n`);
    else printJson({ ok: true, out: opts.out });
    return 0;
  }
  printJson(body);
  return 0;
};

export const runFlowsCreate = async (opts: {
  http: HttpClient;
  appId: string;
  body: unknown;
}): Promise<number> => {
  printJson(await opts.http.post(`/v1/dashboard/apps/${opts.appId}/flows`, opts.body));
  return 0;
};

export const runFlowsUpdate = async (opts: {
  http: HttpClient;
  flowId: string;
  body: unknown;
}): Promise<number> => {
  printJson(await opts.http.patch(`/v1/dashboard/flows/${opts.flowId}`, opts.body));
  return 0;
};

export const runFlowsSaveDraft = async (opts: {
  http: HttpClient;
  flowId: string;
  body: unknown;
}): Promise<number> => {
  printJson(await opts.http.put(`/v1/dashboard/flows/${opts.flowId}/draft`, opts.body));
  return 0;
};

export const runFlowsPublish = async (opts: {
  http: HttpClient;
  flowId: string;
  body?: unknown;
}): Promise<number> => {
  printJson(await opts.http.post(`/v1/dashboard/flows/${opts.flowId}/publish`, opts.body ?? {}));
  return 0;
};

export const runFlowsArchive = async (opts: {
  http: HttpClient;
  flowId: string;
}): Promise<number> => {
  printJson(await opts.http.post(`/v1/dashboard/flows/${opts.flowId}/archive`));
  return 0;
};

export const runFlowsUnarchive = async (opts: {
  http: HttpClient;
  flowId: string;
}): Promise<number> => {
  printJson(await opts.http.post(`/v1/dashboard/flows/${opts.flowId}/unarchive`));
  return 0;
};

export const runFlowsDuplicate = async (opts: {
  http: HttpClient;
  flowId: string;
  body?: unknown;
}): Promise<number> => {
  printJson(await opts.http.post(`/v1/dashboard/flows/${opts.flowId}/duplicate`, opts.body ?? {}));
  return 0;
};
