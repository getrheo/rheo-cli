import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { resolveJsonPayload } from '../body.js';
import { resolveDateRange } from '../dateRange.js';
import { printJson, printTable } from '../format.js';
import type { HttpClient } from '../http.js';
import { flagBool, flagString, parseEnvironment } from '../query.js';
import type { CliFlags, QueryParams } from '../query.js';

type Flags = CliFlags;

export type EngageList =
  | 'contacts'
  | 'templates'
  | 'segments'
  | 'broadcasts'
  | 'automations'
  | 'topics'
  | 'keys'
  | 'events'
  | 'content-blocks';

export type EngageRequest = {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  query?: QueryParams;
  /** CSV export. */
  rawText?: boolean;
  list?: EngageList;
  /** Stream NDJSON / SSE (Rheo Agent). */
  stream?: boolean;
};

export const ENGAGE_USAGE = `rheo engage: Rheo Engage (dashboard API; writes follow your role)

Reads need engage:read. Drafting and structure need engage:manage.
Provider connect/disconnect, test-send, broadcast send, deliverability resume,
and attested consent need engage:send (owners and admins).

  rheo engage overview <appId> [--env test|live] [--start] [--end]
  rheo engage health <appId>
  rheo engage settings get <appId>
  rheo engage settings update <appId> --body|--file
  rheo engage provider get <appId>
  rheo engage provider set <appId> --body|--file
  rheo engage provider refresh <appId>
  rheo engage provider rotate-webhook <appId>
  rheo engage provider disconnect <appId>
  rheo engage push-provider get <appId>
  rheo engage push-provider set <appId> --body|--file
  rheo engage deliverability resume <appId> (--note <text> | --body|--file)
  rheo engage test-send <appId> --body|--file
  rheo engage test-webhook customers <appId> [--q <search>]
  rheo engage test-webhook preview <appId> --body|--file
  rheo engage test-webhook send <appId> --body|--file
  rheo engage test-push <appId> --body|--file
  rheo engage preview-merge-tags <appId> --body|--file
  rheo engage audience-estimate <appId> --body|--file
  rheo engage contacts list <appId> [--limit N] [--offset N] [--q <search>]
  rheo engage contacts upsert|import <appId> --body|--file
  rheo engage contacts delete <appId> <contactId>
  rheo engage templates list <appId>
  rheo engage templates get <appId> <templateId>
  rheo engage templates create <appId> --body|--file
  rheo engage templates update <appId> <templateId> --body|--file
  rheo engage templates delete|duplicate <appId> <templateId>
  rheo engage templates ai-compose|ai-edit <appId> --body|--file
  rheo engage content-blocks list <appId>
  rheo engage content-blocks get|create|update|archive|duplicate|delete <appId> …
  rheo engage email-composer rheo-agent <appId> --body|--file
  rheo engage push-composer rheo-agent <appId> --body|--file
  rheo engage segments list <appId> [--env]
  rheo engage segments readiness <appId>
  rheo engage segments get <appId> <segmentId> [--days N]
  rheo engage segments estimate <appId> --body|--file
  rheo engage segments create <appId> --body|--file
  rheo engage segments update <appId> <segmentId> --body|--file
  rheo engage segments delete <appId> <segmentId>
  rheo engage segments nl|import <appId> --body|--file
  rheo engage segments members <appId> <segmentId> --body|--file
  rheo engage attribute-keys <appId>
  rheo engage event-names <appId> [--env]
  rheo engage broadcasts list <appId> [--env] [--cursor] [--limit] [--include-archived]
  rheo engage broadcasts create <appId> --body|--file
  rheo engage broadcasts update <appId> <broadcastId> --body|--file
  rheo engage broadcasts send <appId> <broadcastId>
  rheo engage broadcasts schedule <appId> <broadcastId> --body|--file
  rheo engage broadcasts cancel|pause|resume|duplicate|archive <appId> <broadcastId>
  rheo engage broadcasts analytics <appId> <broadcastId>
  rheo engage broadcasts sends <appId> <broadcastId> [--cursor] [--limit] [--status]
  rheo engage broadcasts export <appId> <broadcastId> [--status] [--out <file>]
  rheo engage automations list <appId> [--env] [--include-archived]
  rheo engage automations get <appId> <automationId>
  rheo engage automations create <appId> --body|--file
  rheo engage automations nl <appId> --body|--file
  rheo engage automations rheo-agent <appId> <automationId> --body|--file
  rheo engage automations update <appId> <automationId> --body|--file
  rheo engage automations update-node <appId> <automationId> <nodeId> --body|--file
  rheo engage automations publish|duplicate|archive|activate|pause|resume <appId> <automationId>
  rheo engage automations enroll <appId> <automationId> --body|--file
  rheo engage automations enroll-audience <appId> <automationId>
  rheo engage automations check-entry <appId> <automationId> --body|--file
  rheo engage automations versions <appId> <automationId>
  rheo engage automations restore <appId> <automationId> <version>
  rheo engage automations analytics <appId> <automationId>
  rheo engage topics list <appId>
  rheo engage topics upsert <appId> --body|--file
  rheo engage topics update <appId> <topicId> --body|--file
  rheo engage preference-preview <appId>
  rheo engage consent grant <appId> <customerId> --body|--file

Lists print a table unless --json. Other responses print JSON.
broadcasts export writes CSV (--out saves a file).
The deprecated /engage/campaigns API is the same resource as broadcasts.
`;

const need = (value: string | undefined, label: string): string => {
  if (!value) throw new Error(`Missing ${label}`);
  return value;
};

const engagePath = (appId: string, suffix = ''): string =>
  `/v1/dashboard/apps/${appId}/engage${suffix}`;

const environmentOf = (flags: Flags): string => parseEnvironment(flagString(flags, 'env'));

const jsonBody = (flags: Flags): unknown => resolveJsonPayload(flags);

const resumeBody = (flags: Flags): unknown => {
  const note = flagString(flags, 'note');
  const hasPayload = Boolean(flagString(flags, 'body') || flagString(flags, 'file'));
  if (note && hasPayload) throw new Error('Provide only one of --note or --body/--file');
  if (note) return { note };
  return jsonBody(flags);
};

const pageQuery = (flags: Flags, withEnv: boolean): QueryParams => ({
  environment: withEnv ? environmentOf(flags) : undefined,
  cursor: flagString(flags, 'cursor'),
  limit: flagString(flags, 'limit'),
  offset: flagString(flags, 'offset'),
  q: flagString(flags, 'q'),
  status: flagString(flags, 'status'),
  days: flagString(flags, 'days'),
  includeArchived: flagBool(flags, 'include-archived') ? 'true' : undefined,
});

/**
 * Map `rheo engage` argv (after the `engage` token) to a dashboard request.
 * Returns null when the resource or action is unknown.
 */
export const planEngageRequest = (args: string[], flags: Flags): EngageRequest | null => {
  const [resource, action, a, b, c] = args;
  if (!resource) return null;

  const appAt = (value: string | undefined): string => need(value, '<appId>');

  if (resource === 'overview') {
    const range = resolveDateRange({
      start: flagString(flags, 'start'),
      end: flagString(flags, 'end'),
    });
    return {
      method: 'GET',
      path: engagePath(appAt(action), '/overview'),
      query: {
        environment: environmentOf(flags),
        startDate: range.startDate,
        endDate: range.endDate,
      },
    };
  }
  if (resource === 'health') {
    return { method: 'GET', path: engagePath(appAt(action), '/health') };
  }
  if (resource === 'attribute-keys') {
    return { method: 'GET', path: engagePath(appAt(action), '/attribute-keys'), list: 'keys' };
  }
  if (resource === 'event-names') {
    return {
      method: 'GET',
      path: engagePath(appAt(action), '/event-names'),
      query: { environment: environmentOf(flags) },
      list: 'events',
    };
  }
  if (resource === 'test-send') {
    return {
      method: 'POST',
      path: engagePath(appAt(action), '/test-send'),
      body: jsonBody(flags),
    };
  }
  if (resource === 'test-webhook') {
    const appId = appAt(a);
    if (action === 'customers') {
      return {
        method: 'GET',
        path: engagePath(appId, '/test-webhook/customers'),
        query: { q: flagString(flags, 'q') },
      };
    }
    if (action === 'preview') {
      return {
        method: 'POST',
        path: engagePath(appId, '/test-webhook/preview'),
        body: jsonBody(flags),
      };
    }
    if (action === 'send') {
      return {
        method: 'POST',
        path: engagePath(appId, '/test-webhook'),
        body: jsonBody(flags),
      };
    }
    return null;
  }
  if (resource === 'test-push') {
    return {
      method: 'POST',
      path: engagePath(appAt(action), '/test-push'),
      body: jsonBody(flags),
    };
  }
  if (resource === 'preview-merge-tags') {
    return {
      method: 'POST',
      path: engagePath(appAt(action), '/preview-merge-tags'),
      body: jsonBody(flags),
    };
  }
  if (resource === 'email-body-lint') {
    return {
      method: 'POST',
      path: engagePath(appAt(action), '/email-body-lint'),
      body: jsonBody(flags),
    };
  }
  if (resource === 'audience-estimate') {
    return {
      method: 'POST',
      path: engagePath(appAt(action), '/audience-estimate'),
      body: jsonBody(flags),
    };
  }
  if (resource === 'preference-preview') {
    return { method: 'POST', path: engagePath(appAt(action), '/preference-center/preview') };
  }

  if (resource === 'settings') {
    const appId = appAt(a);
    if (action === 'get') return { method: 'GET', path: engagePath(appId, '/settings') };
    if (action === 'update') {
      return { method: 'PATCH', path: engagePath(appId, '/settings'), body: jsonBody(flags) };
    }
    return null;
  }

  if (resource === 'provider') {
    const appId = appAt(a);
    if (action === 'get') return { method: 'GET', path: engagePath(appId, '/provider') };
    if (action === 'set') {
      return { method: 'PUT', path: engagePath(appId, '/provider'), body: jsonBody(flags) };
    }
    if (action === 'refresh') return { method: 'POST', path: engagePath(appId, '/provider/refresh') };
    if (action === 'rotate-webhook') {
      return { method: 'POST', path: engagePath(appId, '/provider/rotate-webhook-token') };
    }
    if (action === 'disconnect') return { method: 'DELETE', path: engagePath(appId, '/provider') };
    return null;
  }

  if (resource === 'push-provider') {
    const appId = appAt(a);
    if (action === 'get') return { method: 'GET', path: engagePath(appId, '/push-provider') };
    if (action === 'set') {
      return { method: 'PUT', path: engagePath(appId, '/push-provider'), body: jsonBody(flags) };
    }
    return null;
  }

  if (resource === 'deliverability') {
    if (action !== 'resume') return null;
    return {
      method: 'POST',
      path: engagePath(appAt(a), '/deliverability/resume'),
      body: resumeBody(flags),
    };
  }

  if (resource === 'contacts') {
    const appId = appAt(a);
    if (action === 'list') {
      return {
        method: 'GET',
        path: engagePath(appId, '/contacts'),
        query: pageQuery(flags, false),
        list: 'contacts',
      };
    }
    if (action === 'upsert') {
      return { method: 'POST', path: engagePath(appId, '/contacts'), body: jsonBody(flags) };
    }
    if (action === 'import') {
      return { method: 'POST', path: engagePath(appId, '/contacts/import'), body: jsonBody(flags) };
    }
    if (action === 'delete') {
      return {
        method: 'DELETE',
        path: engagePath(appId, `/contacts/${need(b, '<contactId>')}`),
      };
    }
    return null;
  }

  if (resource === 'content-blocks') {
    const appId = appAt(a);
    if (action === 'list') {
      return { method: 'GET', path: engagePath(appId, '/content-blocks'), list: 'content-blocks' };
    }
    if (action === 'get') {
      return {
        method: 'GET',
        path: engagePath(appId, `/content-blocks/${need(b, '<contentBlockId>')}`),
      };
    }
    if (action === 'create') {
      return { method: 'POST', path: engagePath(appId, '/content-blocks'), body: jsonBody(flags) };
    }
    if (action === 'update') {
      return {
        method: 'PATCH',
        path: engagePath(appId, `/content-blocks/${need(b, '<contentBlockId>')}`),
        body: jsonBody(flags),
      };
    }
    if (action === 'archive') {
      return {
        method: 'POST',
        path: engagePath(appId, `/content-blocks/${need(b, '<contentBlockId>')}/archive`),
      };
    }
    if (action === 'duplicate') {
      return {
        method: 'POST',
        path: engagePath(appId, `/content-blocks/${need(b, '<contentBlockId>')}/duplicate`),
      };
    }
    if (action === 'delete') {
      return {
        method: 'DELETE',
        path: engagePath(appId, `/content-blocks/${need(b, '<contentBlockId>')}`),
      };
    }
    return null;
  }

  if (resource === 'email-composer') {
    if (action !== 'rheo-agent') return null;
    return {
      method: 'POST',
      path: engagePath(appAt(a), '/email-composer/rheo-agent'),
      body: jsonBody(flags),
      stream: true,
    };
  }

  if (resource === 'push-composer') {
    if (action !== 'rheo-agent') return null;
    return {
      method: 'POST',
      path: engagePath(appAt(a), '/push-composer/rheo-agent'),
      body: jsonBody(flags),
      stream: true,
    };
  }

  if (resource === 'templates') {
    const appId = appAt(a);
    if (action === 'list') {
      return { method: 'GET', path: engagePath(appId, '/templates'), list: 'templates' };
    }
    if (action === 'get') {
      return {
        method: 'GET',
        path: engagePath(appId, `/templates/${need(b, '<templateId>')}`),
      };
    }
    if (action === 'create') {
      return { method: 'POST', path: engagePath(appId, '/templates'), body: jsonBody(flags) };
    }
    if (action === 'update') {
      return {
        method: 'PATCH',
        path: engagePath(appId, `/templates/${need(b, '<templateId>')}`),
        body: jsonBody(flags),
      };
    }
    if (action === 'delete') {
      return {
        method: 'DELETE',
        path: engagePath(appId, `/templates/${need(b, '<templateId>')}`),
      };
    }
    if (action === 'duplicate') {
      return {
        method: 'POST',
        path: engagePath(appId, `/templates/${need(b, '<templateId>')}/duplicate`),
      };
    }
    if (action === 'ai-compose') {
      return {
        method: 'POST',
        path: engagePath(appId, '/templates/ai-compose'),
        body: jsonBody(flags),
      };
    }
    if (action === 'ai-edit') {
      return {
        method: 'POST',
        path: engagePath(appId, '/templates/ai-edit'),
        body: jsonBody(flags),
      };
    }
    return null;
  }

  if (resource === 'segments') {
    const appId = appAt(a);
    if (action === 'list') {
      return {
        method: 'GET',
        path: engagePath(appId, '/segments'),
        query: { environment: environmentOf(flags) },
        list: 'segments',
      };
    }
    if (action === 'readiness') {
      return { method: 'GET', path: engagePath(appId, '/segments/readiness') };
    }
    if (action === 'get') {
      return {
        method: 'GET',
        path: engagePath(appId, `/segments/${need(b, '<segmentId>')}`),
        query: { days: flagString(flags, 'days') },
      };
    }
    if (action === 'estimate') {
      return {
        method: 'POST',
        path: engagePath(appId, '/segments/estimate'),
        body: jsonBody(flags),
      };
    }
    if (action === 'create') {
      return { method: 'POST', path: engagePath(appId, '/segments'), body: jsonBody(flags) };
    }
    if (action === 'update') {
      return {
        method: 'PATCH',
        path: engagePath(appId, `/segments/${need(b, '<segmentId>')}`),
        body: jsonBody(flags),
      };
    }
    if (action === 'delete') {
      return {
        method: 'DELETE',
        path: engagePath(appId, `/segments/${need(b, '<segmentId>')}`),
      };
    }
    if (action === 'nl') {
      return { method: 'POST', path: engagePath(appId, '/segments/nl'), body: jsonBody(flags) };
    }
    if (action === 'import') {
      return {
        method: 'POST',
        path: engagePath(appId, '/segments/import'),
        body: jsonBody(flags),
      };
    }
    if (action === 'members') {
      return {
        method: 'POST',
        path: engagePath(appId, `/segments/${need(b, '<segmentId>')}/members`),
        body: jsonBody(flags),
      };
    }
    return null;
  }

  if (resource === 'broadcasts') {
    const appId = appAt(a);
    if (action === 'list') {
      return {
        method: 'GET',
        path: engagePath(appId, '/broadcasts'),
        query: {
          environment: environmentOf(flags),
          cursor: flagString(flags, 'cursor'),
          limit: flagString(flags, 'limit'),
          includeArchived: flagBool(flags, 'include-archived') ? 'true' : undefined,
        },
        list: 'broadcasts',
      };
    }
    if (action === 'create') {
      return { method: 'POST', path: engagePath(appId, '/broadcasts'), body: jsonBody(flags) };
    }
    if (
      action !== 'update' &&
      action !== 'send' &&
      action !== 'schedule' &&
      action !== 'cancel' &&
      action !== 'pause' &&
      action !== 'resume' &&
      action !== 'duplicate' &&
      action !== 'archive' &&
      action !== 'analytics' &&
      action !== 'sends' &&
      action !== 'export'
    ) {
      return null;
    }
    const broadcastId = need(b, '<broadcastId>');
    const broadcastPath = engagePath(appId, `/broadcasts/${broadcastId}`);
    if (action === 'update') {
      return { method: 'PATCH', path: broadcastPath, body: jsonBody(flags) };
    }
    if (action === 'send') return { method: 'POST', path: `${broadcastPath}/send` };
    if (action === 'schedule') {
      return { method: 'POST', path: `${broadcastPath}/schedule`, body: jsonBody(flags) };
    }
    if (action === 'cancel') return { method: 'POST', path: `${broadcastPath}/cancel` };
    if (action === 'pause') return { method: 'POST', path: `${broadcastPath}/pause` };
    if (action === 'resume') return { method: 'POST', path: `${broadcastPath}/resume` };
    if (action === 'duplicate') return { method: 'POST', path: `${broadcastPath}/duplicate` };
    if (action === 'archive') return { method: 'POST', path: `${broadcastPath}/archive` };
    if (action === 'analytics') return { method: 'GET', path: `${broadcastPath}/analytics` };
    if (action === 'sends') {
      return {
        method: 'GET',
        path: `${broadcastPath}/sends`,
        query: {
          cursor: flagString(flags, 'cursor'),
          limit: flagString(flags, 'limit'),
          status: flagString(flags, 'status'),
        },
      };
    }
    if (action === 'export') {
      return {
        method: 'GET',
        path: `${broadcastPath}/sends/export`,
        query: { status: flagString(flags, 'status') },
        rawText: true,
      };
    }
    return null;
  }

  if (resource === 'automations') {
    const appId = appAt(a);
    if (action === 'list') {
      return {
        method: 'GET',
        path: engagePath(appId, '/automations'),
        query: {
          environment: environmentOf(flags),
          includeArchived: flagBool(flags, 'include-archived') ? 'true' : undefined,
        },
        list: 'automations',
      };
    }
    if (action === 'create') {
      return { method: 'POST', path: engagePath(appId, '/automations'), body: jsonBody(flags) };
    }
    if (action === 'nl') {
      return { method: 'POST', path: engagePath(appId, '/automations/nl'), body: jsonBody(flags) };
    }
    if (action === 'rheo-agent') {
      const automationId = need(b, '<automationId>');
      return {
        method: 'POST',
        path: engagePath(appId, `/automations/${automationId}/rheo-agent`),
        body: jsonBody(flags),
        stream: true,
      };
    }
    if (
      action !== 'get' &&
      action !== 'update' &&
      action !== 'update-node' &&
      action !== 'publish' &&
      action !== 'duplicate' &&
      action !== 'archive' &&
      action !== 'activate' &&
      action !== 'pause' &&
      action !== 'resume' &&
      action !== 'enroll' &&
      action !== 'enroll-audience' &&
      action !== 'check-entry' &&
      action !== 'versions' &&
      action !== 'restore' &&
      action !== 'analytics' &&
      action !== 'nl' &&
      action !== 'rheo-agent'
    ) {
      return null;
    }
    const automationId = need(b, '<automationId>');
    const automationPath = engagePath(appId, `/automations/${automationId}`);
    if (action === 'get') return { method: 'GET', path: automationPath };
    if (action === 'update') {
      return { method: 'PATCH', path: automationPath, body: jsonBody(flags) };
    }
    if (action === 'update-node') {
      return {
        method: 'PATCH',
        path: `${automationPath}/nodes/${need(c, '<nodeId>')}`,
        body: jsonBody(flags),
      };
    }
    if (action === 'publish') return { method: 'POST', path: `${automationPath}/publish` };
    if (action === 'duplicate') return { method: 'POST', path: `${automationPath}/duplicate` };
    if (action === 'archive') return { method: 'POST', path: `${automationPath}/archive` };
    if (action === 'activate') return { method: 'POST', path: `${automationPath}/activate` };
    if (action === 'pause') return { method: 'POST', path: `${automationPath}/pause` };
    if (action === 'resume') return { method: 'POST', path: `${automationPath}/resume` };
    if (action === 'enroll') {
      return {
        method: 'POST',
        path: `${automationPath}/enrollments`,
        body: jsonBody(flags),
      };
    }
    if (action === 'enroll-audience') {
      return { method: 'POST', path: `${automationPath}/audience-enrollments` };
    }
    if (action === 'check-entry') {
      return {
        method: 'POST',
        path: `${automationPath}/entry-check`,
        body: jsonBody(flags),
      };
    }
    if (action === 'versions') return { method: 'GET', path: `${automationPath}/versions` };
    if (action === 'restore') {
      return {
        method: 'POST',
        path: `${automationPath}/versions/${need(c, '<version>')}/restore`,
      };
    }
    if (action === 'analytics') return { method: 'GET', path: `${automationPath}/analytics` };
    return null;
  }

  if (resource === 'topics') {
    const appId = appAt(a);
    if (action === 'list') {
      return { method: 'GET', path: engagePath(appId, '/marketing-topics'), list: 'topics' };
    }
    if (action === 'upsert') {
      return {
        method: 'PUT',
        path: engagePath(appId, '/marketing-topics'),
        body: jsonBody(flags),
      };
    }
    if (action === 'update') {
      return {
        method: 'PATCH',
        path: engagePath(appId, `/marketing-topics/${need(b, '<topicId>')}`),
        body: jsonBody(flags),
      };
    }
    return null;
  }

  if (resource === 'consent') {
    if (action !== 'grant') return null;
    return {
      method: 'POST',
      path: engagePath(appAt(a), `/customers/${need(b, '<customerId>')}/consent/attested-grant`),
      body: jsonBody(flags),
    };
  }

  return null;
};

const cell = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return String(value);
};

const rowsOf = (body: unknown): Array<Record<string, unknown>> => {
  if (!body || typeof body !== 'object') return [];
  const items = (body as { items?: unknown }).items;
  return Array.isArray(items) ? (items as Array<Record<string, unknown>>) : [];
};

const printStringList = (values: unknown, column: string): void => {
  const list = Array.isArray(values) ? values : [];
  printTable(list.map((value) => ({ [column]: cell(value) })));
};

const printEngageList = (kind: EngageList, body: unknown): void => {
  if (kind === 'keys') {
    const keys = body && typeof body === 'object' ? (body as { keys?: unknown }).keys : [];
    printStringList(keys, 'key');
    return;
  }
  if (kind === 'events') {
    const names =
      body && typeof body === 'object' ? (body as { eventNames?: unknown }).eventNames : [];
    printStringList(names, 'event');
    return;
  }

  const items = rowsOf(body);
  if (kind === 'contacts') {
    printTable(
      items.map((row) => ({
        id: cell(row.id),
        email: cell(row.email),
        appUserId: cell(row.appUserId),
        consent: cell(row.marketingConsent),
      })),
    );
  } else if (kind === 'templates') {
    printTable(
      items.map((row) => ({
        id: cell(row.id),
        name: cell(row.name),
        subject: cell(row.subject),
        updatedAt: cell(row.updatedAt),
      })),
    );
  } else if (kind === 'content-blocks') {
    printTable(
      items.map((row) => ({
        id: cell(row.id),
        name: cell(row.name),
        kind: cell(row.kind),
        updatedAt: cell(row.updatedAt),
      })),
    );
  } else if (kind === 'segments') {
    printTable(
      items.map((row) => ({
        id: cell(row.id),
        name: cell(row.name),
        kind: cell(row.kind),
        env: cell(row.environment),
        members: cell(row.memberCount),
        status: cell(row.membershipStatus),
      })),
    );
  } else if (kind === 'broadcasts') {
    printTable(
      items.map((row) => ({
        id: cell(row.id),
        name: cell(row.name),
        status: cell(row.status),
        env: cell(row.environment),
        scheduledAt: cell(row.scheduledAt),
      })),
    );
  } else if (kind === 'automations') {
    printTable(
      items.map((row) => ({
        id: cell(row.id),
        name: cell(row.name),
        status: cell(row.status),
        env: cell(row.environment),
        published: cell(row.publishedVersion),
        enrolled: cell(row.enrollmentCount),
      })),
    );
  } else {
    printTable(
      items.map((row) => ({
        id: cell(row.id),
        key: cell(row.topicKey),
        label: cell(row.label),
        enabled: cell(row.enabled),
      })),
    );
  }

  if (body && typeof body === 'object') {
    const extra = body as { total?: unknown; nextCursor?: unknown };
    if (typeof extra.total === 'number') process.stdout.write(`total ${extra.total}\n`);
    if (typeof extra.nextCursor === 'string' && extra.nextCursor) {
      process.stdout.write(`nextCursor ${extra.nextCursor}\n`);
    }
  }
};

const writeTextOut = (path: string, text: string): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text.endsWith('\n') ? text : `${text}\n`);
};

const sendJson = async (http: HttpClient, plan: EngageRequest): Promise<unknown> => {
  if (plan.method === 'GET') return http.get(plan.path, plan.query);
  if (plan.method === 'POST') return http.post(plan.path, plan.body, plan.query);
  if (plan.method === 'PATCH') return http.patch(plan.path, plan.body, plan.query);
  if (plan.method === 'PUT') return http.put(plan.path, plan.body, plan.query);
  return http.delete(plan.path, plan.body, plan.query);
};

export const runEngageCommand = async (opts: {
  http: HttpClient;
  args: string[];
  flags: Flags;
  json: boolean;
}): Promise<number> => {
  const plan = planEngageRequest(opts.args, opts.flags);
  if (!plan) {
    process.stderr.write(`Unknown engage command: ${opts.args.join(' ') || '(none)'}\n`);
    process.stderr.write(ENGAGE_USAGE);
    return 1;
  }

  if (plan.rawText) {
    const text = await opts.http.getText(plan.path, plan.query);
    const out = flagString(opts.flags, 'out');
    if (out) {
      writeTextOut(out, text);
      if (opts.json) printJson({ ok: true, out });
      else process.stdout.write(`Wrote ${out}\n`);
      return 0;
    }
    process.stdout.write(text.endsWith('\n') ? text : `${text}\n`);
    return 0;
  }

  if (plan.stream) {
    await opts.http.stream(plan.method, plan.path, plan.body, plan.query);
    return 0;
  }

  const body = await sendJson(opts.http, plan);
  if (opts.json || !plan.list) {
    printJson(body);
    return 0;
  }
  printEngageList(plan.list, body);
  return 0;
};
