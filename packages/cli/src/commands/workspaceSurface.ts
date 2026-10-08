import { resolveJsonPayload } from '../body.js';
import { printJson, printTable } from '../format.js';
import type { HttpClient } from '../http.js';
import { flagBool, type CliFlags } from '../query.js';

const need = (value: string | undefined, label: string): string => {
  if (!value) throw new Error(`Missing ${label}`);
  return value;
};

export const runNotificationsCommand = async (opts: {
  http: HttpClient;
  args: string[];
  flags: CliFlags;
  json: boolean;
}): Promise<number> => {
  const [action, notificationId] = opts.args;
  if (!action || action === 'list') {
    const body = (await opts.http.get('/v1/dashboard/notifications', {
      unread: flagBool(opts.flags, 'unread') ? 'true' : undefined,
    })) as { items?: Array<Record<string, unknown>> };
    if (opts.json) {
      printJson(body);
      return 0;
    }
    printTable(
      (body.items ?? []).map((row) => ({
        id: String(row.id ?? ''),
        kind: String(row.kind ?? ''),
        createdAt: String(row.createdAt ?? ''),
        read: row.readAt ? 'yes' : 'no',
      })),
    );
    return 0;
  }
  if (action === 'read') {
    const id = need(notificationId, '<notificationId>');
    printJson(await opts.http.post(`/v1/dashboard/notifications/${id}/read`));
    return 0;
  }
  if (action === 'read-all') {
    printJson(await opts.http.post('/v1/dashboard/notifications/read-all'));
    return 0;
  }
  process.stderr.write(`Unknown notifications command: ${action}\n`);
  return 1;
};

export const runMeCommand = async (opts: {
  http: HttpClient;
  args: string[];
  flags: CliFlags;
}): Promise<number> => {
  const [resource, action] = opts.args;
  if (resource === 'email-preferences') {
    if (!action || action === 'get') {
      printJson(await opts.http.get('/v1/dashboard/me/email-preferences'));
      return 0;
    }
    if (action === 'update') {
      printJson(
        await opts.http.patch(
          '/v1/dashboard/me/email-preferences',
          resolveJsonPayload(opts.flags),
        ),
      );
      return 0;
    }
  }
  if (resource === 'signup-attribution') {
    printJson(
      await opts.http.post('/v1/dashboard/me/signup-attribution', resolveJsonPayload(opts.flags)),
    );
    return 0;
  }
  process.stderr.write(`Unknown me command: ${opts.args.join(' ') || '(none)'}\n`);
  return 1;
};

export const runOnboardingCommand = async (opts: {
  http: HttpClient;
  args: string[];
  flags: CliFlags;
}): Promise<number> => {
  const [action, taskId] = opts.args;
  if (!action || action === 'get' || action === 'status') {
    printJson(await opts.http.get('/v1/dashboard/onboarding-checklist'));
    return 0;
  }
  if (action === 'verify') {
    const id = need(taskId, '<taskId>');
    printJson(await opts.http.post(`/v1/dashboard/onboarding-checklist/tasks/${id}/verify`));
    return 0;
  }
  if (action === 'complete') {
    const id = need(taskId, '<taskId>');
    printJson(await opts.http.post(`/v1/dashboard/onboarding-checklist/tasks/${id}/complete`));
    return 0;
  }
  if (action === 'dismiss') {
    printJson(await opts.http.patch('/v1/dashboard/onboarding-checklist/dismiss'));
    return 0;
  }
  process.stderr.write(`Unknown onboarding command: ${action}\n`);
  return 1;
};

export const runSelfServeCommand = async (opts: {
  http: HttpClient;
  args: string[];
  flags: CliFlags;
}): Promise<number> => {
  const [action] = opts.args;
  if (!action || action === 'status') {
    printJson(await opts.http.get('/v1/dashboard/self-serve-status'));
    return 0;
  }
  if (action === 'accept-terms') {
    printJson(
      await opts.http.post(
        '/v1/dashboard/self-serve/accept-terms',
        resolveJsonPayload(opts.flags, { optional: true, emptyObjectWhenMissing: true }),
      ),
    );
    return 0;
  }
  if (action === 'complete-profile-name') {
    printJson(
      await opts.http.post(
        '/v1/dashboard/self-serve/complete-profile-name',
        resolveJsonPayload(opts.flags),
      ),
    );
    return 0;
  }
  if (action === 'complete-workspace-name') {
    printJson(
      await opts.http.post(
        '/v1/dashboard/self-serve/complete-workspace-name',
        resolveJsonPayload(opts.flags),
      ),
    );
    return 0;
  }
  if (action === 'tour-dismiss') {
    printJson(
      await opts.http.patch(
        '/v1/dashboard/self-serve/tour-dismiss',
        resolveJsonPayload(opts.flags, { optional: true, emptyObjectWhenMissing: true }),
      ),
    );
    return 0;
  }
  process.stderr.write(`Unknown self-serve command: ${action}\n`);
  return 1;
};

export const runStoreListingLookup = async (opts: {
  http: HttpClient;
  flags: CliFlags;
}): Promise<number> => {
  printJson(
    await opts.http.post('/v1/dashboard/store-listing-lookup', resolveJsonPayload(opts.flags)),
  );
  return 0;
};

export const runAiBrandColors = async (opts: {
  http: HttpClient;
  appId: string;
  flags: CliFlags;
}): Promise<number> => {
  printJson(
    await opts.http.post(
      `/v1/dashboard/apps/${opts.appId}/ai/branding-colors`,
      resolveJsonPayload(opts.flags),
    ),
  );
  return 0;
};

export const runAiTranslateChunk = async (opts: {
  http: HttpClient;
  flags: CliFlags;
}): Promise<number> => {
  printJson(await opts.http.post('/v1/dashboard/ai/translate-chunk', resolveJsonPayload(opts.flags)));
  return 0;
};

export const runMediaUsage = async (opts: {
  http: HttpClient;
  assetId: string;
}): Promise<number> => {
  printJson(await opts.http.get(`/v1/dashboard/media/${opts.assetId}/usage`));
  return 0;
};

export const runAppsAttributionSignal = async (opts: {
  http: HttpClient;
  appId: string;
}): Promise<number> => {
  printJson(
    await opts.http.get(`/v1/dashboard/apps/${opts.appId}/integrations/attribution-provider-signal`),
  );
  return 0;
};
