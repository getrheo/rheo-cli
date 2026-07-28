import type { HttpClient } from '../http.js';
import { printJson, printTable } from '../format.js';

export const runRolloutsPolicy = async (opts: { http: HttpClient }): Promise<number> => {
  printJson(await opts.http.get('/v1/dashboard/rollout-policy'));
  return 0;
};

export const runRolloutsPolicySet = async (opts: {
  http: HttpClient;
  body: unknown;
}): Promise<number> => {
  printJson(await opts.http.patch('/v1/dashboard/rollout-policy', opts.body));
  return 0;
};

export const runRolloutsList = async (opts: {
  http: HttpClient;
  json?: boolean;
}): Promise<number> => {
  const body = (await opts.http.get('/v1/dashboard/rollout-requests')) as {
    items?: Array<{ id: string; status?: string; channelId?: string; createdAt?: string }>;
  };
  if (opts.json || !body.items) {
    printJson(body);
    return 0;
  }
  printTable(
    body.items.map((r) => ({
      id: r.id,
      status: r.status ?? '',
      channelId: r.channelId ?? '',
      createdAt: r.createdAt ?? '',
    })),
  );
  return 0;
};

export const runRolloutsChannelList = async (opts: {
  http: HttpClient;
  appId: string;
  channelId: string;
}): Promise<number> => {
  printJson(
    await opts.http.get(
      `/v1/dashboard/apps/${opts.appId}/channels/${opts.channelId}/rollout-requests`,
    ),
  );
  return 0;
};

export const runRolloutsGet = async (opts: {
  http: HttpClient;
  id: string;
}): Promise<number> => {
  printJson(await opts.http.get(`/v1/dashboard/rollout-requests/${opts.id}`));
  return 0;
};

export const runRolloutsSubmit = async (opts: {
  http: HttpClient;
  body: unknown;
}): Promise<number> => {
  printJson(await opts.http.post('/v1/dashboard/rollout-requests', opts.body));
  return 0;
};

export const runRolloutsApprove = async (opts: {
  http: HttpClient;
  id: string;
  body?: unknown;
}): Promise<number> => {
  printJson(
    await opts.http.post(`/v1/dashboard/rollout-requests/${opts.id}/approve`, opts.body ?? {}),
  );
  return 0;
};

export const runRolloutsReject = async (opts: {
  http: HttpClient;
  id: string;
  body?: unknown;
}): Promise<number> => {
  printJson(
    await opts.http.post(`/v1/dashboard/rollout-requests/${opts.id}/reject`, opts.body ?? {}),
  );
  return 0;
};
