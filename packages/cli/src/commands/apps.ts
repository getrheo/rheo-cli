import type { HttpClient } from '../http.js';
import { printJson, printKv, printTable } from '../format.js';

type AppItem = { id: string; name: string; archivedAt?: string | null };

export const runAppsList = async (opts: {
  http: HttpClient;
  json?: boolean;
}): Promise<number> => {
  const body = (await opts.http.get('/v1/dashboard/apps')) as { items: AppItem[] };
  if (opts.json) {
    printJson(body);
    return 0;
  }
  printTable(
    body.items.map((a) => ({
      id: a.id,
      name: a.name,
      archived: a.archivedAt ? 'yes' : 'no',
    })),
  );
  return 0;
};

export const runAppsGet = async (opts: {
  http: HttpClient;
  appId: string;
  json?: boolean;
}): Promise<number> => {
  const body = (await opts.http.get(`/v1/dashboard/apps/${opts.appId}`)) as {
    app: AppItem & Record<string, unknown>;
  };
  if (opts.json) {
    printJson(body);
    return 0;
  }
  const app = body.app;
  printKv([
    ['id', app.id],
    ['name', app.name],
    ['archived', app.archivedAt ? 'yes' : 'no'],
  ]);
  return 0;
};

export const runAppsCreate = async (opts: {
  http: HttpClient;
  body: unknown;
}): Promise<number> => {
  const res = await opts.http.post('/v1/dashboard/apps', opts.body);
  printJson(res);
  return 0;
};

export const runAppsUpdate = async (opts: {
  http: HttpClient;
  appId: string;
  body: unknown;
}): Promise<number> => {
  const res = await opts.http.patch(`/v1/dashboard/apps/${opts.appId}`, opts.body);
  printJson(res);
  return 0;
};

export const runAppsBranding = async (opts: {
  http: HttpClient;
  appId: string;
  body: unknown;
}): Promise<number> => {
  const res = await opts.http.patch(`/v1/dashboard/apps/${opts.appId}/branding`, opts.body);
  printJson(res);
  return 0;
};

export const runAppsDelete = async (opts: {
  http: HttpClient;
  appId: string;
  confirmName: string;
}): Promise<number> => {
  const res = await opts.http.delete(`/v1/dashboard/apps/${opts.appId}`, {
    confirmName: opts.confirmName,
  });
  printJson(res);
  return 0;
};
