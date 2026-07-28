import type { HttpClient } from '../http.js';
import { printJson, printTable } from '../format.js';

type ChannelItem = {
  id: string;
  name?: string;
  publicId?: string;
  archivedAt?: string | null;
  assignmentKind?: string | null;
  pinned?: unknown;
  experimentId?: string | null;
};

export const runChannelsList = async (opts: {
  http: HttpClient;
  appId: string;
  includeArchived?: boolean;
  json?: boolean;
}): Promise<number> => {
  const body = (await opts.http.get(`/v1/dashboard/apps/${opts.appId}/channels`, {
    includeArchived: opts.includeArchived ? 'true' : undefined,
  })) as { items: ChannelItem[] };

  if (opts.json) {
    printJson(body);
    return 0;
  }

  printTable(
    body.items.map((c) => ({
      id: c.id,
      publicId: c.publicId ?? '',
      name: c.name ?? '',
      assignment: c.assignmentKind ?? '',
      experimentId: c.experimentId ?? '',
      archived: c.archivedAt ? 'yes' : 'no',
    })),
  );
  return 0;
};

export const runChannelsHistory = async (opts: {
  http: HttpClient;
  appId: string;
  channelId: string;
  limit?: string;
  offset?: string;
  json?: boolean;
}): Promise<number> => {
  const body = await opts.http.get(
    `/v1/dashboard/apps/${opts.appId}/channels/${opts.channelId}/history`,
    {
      limit: opts.limit,
      offset: opts.offset,
    },
  );
  printJson(body);
  return 0;
};

export const runChannelsCreate = async (opts: {
  http: HttpClient;
  appId: string;
  body: unknown;
}): Promise<number> => {
  printJson(await opts.http.post(`/v1/dashboard/apps/${opts.appId}/channels`, opts.body));
  return 0;
};

export const runChannelsUpdate = async (opts: {
  http: HttpClient;
  appId: string;
  channelId: string;
  body: unknown;
}): Promise<number> => {
  printJson(
    await opts.http.patch(
      `/v1/dashboard/apps/${opts.appId}/channels/${opts.channelId}`,
      opts.body,
    ),
  );
  return 0;
};

export const runChannelsArchive = async (opts: {
  http: HttpClient;
  appId: string;
  channelId: string;
  confirmName: string;
}): Promise<number> => {
  printJson(
    await opts.http.post(
      `/v1/dashboard/apps/${opts.appId}/channels/${opts.channelId}/archive`,
      { confirmName: opts.confirmName },
    ),
  );
  return 0;
};

export const runChannelsUnarchive = async (opts: {
  http: HttpClient;
  appId: string;
  channelId: string;
}): Promise<number> => {
  printJson(
    await opts.http.post(
      `/v1/dashboard/apps/${opts.appId}/channels/${opts.channelId}/unarchive`,
    ),
  );
  return 0;
};

export const runChannelsAssign = async (opts: {
  http: HttpClient;
  appId: string;
  channelId: string;
  body: unknown;
}): Promise<number> => {
  printJson(
    await opts.http.put(
      `/v1/dashboard/apps/${opts.appId}/channels/${opts.channelId}/assignment`,
      opts.body,
    ),
  );
  return 0;
};

export const runChannelsUnassign = async (opts: {
  http: HttpClient;
  appId: string;
  channelId: string;
}): Promise<number> => {
  printJson(
    await opts.http.delete(
      `/v1/dashboard/apps/${opts.appId}/channels/${opts.channelId}/assignment`,
    ),
  );
  return 0;
};
