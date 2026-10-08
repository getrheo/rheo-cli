import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseArgv } from '../cli.js';
import type { HttpClient } from '../http.js';
import { planEngageRequest, runEngageCommand } from './engage.js';

const routesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../apps/api/src/routes/dashboard');
const routeSource = [
  'engage.ts',
  'engage-automation-routes.ts',
  'engage-automation-ai-routes.ts',
  'engage-content-block-routes.ts',
  'engage-email-composer-ai-routes.ts',
  'engage-push-composer-ai-routes.ts',
]
  .map((name) => readFileSync(join(routesDir, name), 'utf8'))
  .join('\n');

const scrapeEngageRoutes = (source: string): Array<{ method: string; path: string }> => {
  const routes: Array<{ method: string; path: string }> = [];
  const methodRe = /app\.(get|post|put|patch|delete)/g;
  let match: RegExpExecArray | null;
  while ((match = methodRe.exec(source))) {
    const method = match[1]!.toUpperCase();
    let i = match.index + match[0].length;
    if (source[i] === '<') {
      let depth = 0;
      for (; i < source.length; i += 1) {
        if (source[i] === '<') depth += 1;
        else if (source[i] === '>') {
          depth -= 1;
          if (depth === 0) {
            i += 1;
            break;
          }
        }
      }
    }
    while (i < source.length && /\s/.test(source[i]!)) i += 1;
    if (source[i] !== '(') continue;
    i += 1;
    while (i < source.length && /\s/.test(source[i]!)) i += 1;
    const quote = source[i];
    if (quote !== "'" && quote !== '"') continue;
    i += 1;
    let path = '';
    while (i < source.length && source[i] !== quote) {
      path += source[i];
      i += 1;
    }
    routes.push({ method, path });
  }
  return routes;
};

const dashboardRoutes = scrapeEngageRoutes(routeSource);

const flags = { body: '{}' };

/** argv after `engage`, keyed by METHOD + route template. */
const fixtures: Record<string, string[]> = {
  'GET /apps/:appId/engage/provider': ['provider', 'get', 'app_1'],
  'PUT /apps/:appId/engage/provider': ['provider', 'set', 'app_1'],
  'POST /apps/:appId/engage/provider/refresh': ['provider', 'refresh', 'app_1'],
  'POST /apps/:appId/engage/provider/rotate-webhook-token': ['provider', 'rotate-webhook', 'app_1'],
  'DELETE /apps/:appId/engage/provider': ['provider', 'disconnect', 'app_1'],
  'GET /apps/:appId/engage/push-provider': ['push-provider', 'get', 'app_1'],
  'PUT /apps/:appId/engage/push-provider': ['push-provider', 'set', 'app_1'],
  'POST /apps/:appId/engage/test-send': ['test-send', 'app_1'],
  'GET /apps/:appId/engage/test-webhook/customers': ['test-webhook', 'customers', 'app_1'],
  'POST /apps/:appId/engage/test-webhook/preview': ['test-webhook', 'preview', 'app_1'],
  'POST /apps/:appId/engage/test-webhook': ['test-webhook', 'send', 'app_1'],
  'POST /apps/:appId/engage/test-push': ['test-push', 'app_1'],
  'POST /apps/:appId/engage/preview-merge-tags': ['preview-merge-tags', 'app_1'],
  'POST /apps/:appId/engage/email-body-lint': ['email-body-lint', 'app_1'],
  'GET /apps/:appId/engage/contacts': ['contacts', 'list', 'app_1'],
  'POST /apps/:appId/engage/contacts': ['contacts', 'upsert', 'app_1'],
  'POST /apps/:appId/engage/contacts/import': ['contacts', 'import', 'app_1'],
  'DELETE /apps/:appId/engage/contacts/:contactId': ['contacts', 'delete', 'app_1', 'contact_1'],
  'POST /apps/:appId/engage/audience-estimate': ['audience-estimate', 'app_1'],
  'GET /apps/:appId/engage/settings': ['settings', 'get', 'app_1'],
  'PATCH /apps/:appId/engage/settings': ['settings', 'update', 'app_1'],
  'GET /apps/:appId/engage/templates': ['templates', 'list', 'app_1'],
  'GET /apps/:appId/engage/templates/:templateId': ['templates', 'get', 'app_1', 'template_1'],
  'POST /apps/:appId/engage/templates': ['templates', 'create', 'app_1'],
  'PATCH /apps/:appId/engage/templates/:templateId': ['templates', 'update', 'app_1', 'template_1'],
  'DELETE /apps/:appId/engage/templates/:templateId': ['templates', 'delete', 'app_1', 'template_1'],
  'POST /apps/:appId/engage/templates/:templateId/duplicate': [
    'templates',
    'duplicate',
    'app_1',
    'template_1',
  ],
  'POST /apps/:appId/engage/templates/ai-compose': ['templates', 'ai-compose', 'app_1'],
  'POST /apps/:appId/engage/templates/ai-edit': ['templates', 'ai-edit', 'app_1'],
  'GET /apps/:appId/engage/segments': ['segments', 'list', 'app_1'],
  'GET /apps/:appId/engage/segments/readiness': ['segments', 'readiness', 'app_1'],
  'GET /apps/:appId/engage/segments/:segmentId': ['segments', 'get', 'app_1', 'segment_1'],
  'POST /apps/:appId/engage/segments/estimate': ['segments', 'estimate', 'app_1'],
  'POST /apps/:appId/engage/segments': ['segments', 'create', 'app_1'],
  'PATCH /apps/:appId/engage/segments/:segmentId': ['segments', 'update', 'app_1', 'segment_1'],
  'DELETE /apps/:appId/engage/segments/:segmentId': ['segments', 'delete', 'app_1', 'segment_1'],
  'POST /apps/:appId/engage/segments/nl': ['segments', 'nl', 'app_1'],
  'POST /apps/:appId/engage/segments/import': ['segments', 'import', 'app_1'],
  'POST /apps/:appId/engage/segments/:segmentId/members': ['segments', 'members', 'app_1', 'segment_1'],
  'GET /apps/:appId/engage/attribute-keys': ['attribute-keys', 'app_1'],
  'GET /apps/:appId/engage/event-names': ['event-names', 'app_1'],
  'GET /apps/:appId/engage/overview': ['overview', 'app_1'],
  'GET /apps/:appId/engage/broadcasts': ['broadcasts', 'list', 'app_1'],
  'POST /apps/:appId/engage/broadcasts': ['broadcasts', 'create', 'app_1'],
  'PATCH /apps/:appId/engage/broadcasts/:broadcastId': ['broadcasts', 'update', 'app_1', 'broadcast_1'],
  'POST /apps/:appId/engage/broadcasts/:broadcastId/send': ['broadcasts', 'send', 'app_1', 'broadcast_1'],
  'POST /apps/:appId/engage/broadcasts/:broadcastId/schedule': [
    'broadcasts',
    'schedule',
    'app_1',
    'broadcast_1',
  ],
  'POST /apps/:appId/engage/broadcasts/:broadcastId/cancel': ['broadcasts', 'cancel', 'app_1', 'broadcast_1'],
  'POST /apps/:appId/engage/broadcasts/:broadcastId/pause': ['broadcasts', 'pause', 'app_1', 'broadcast_1'],
  'POST /apps/:appId/engage/broadcasts/:broadcastId/resume': ['broadcasts', 'resume', 'app_1', 'broadcast_1'],
  'POST /apps/:appId/engage/broadcasts/:broadcastId/duplicate': [
    'broadcasts',
    'duplicate',
    'app_1',
    'broadcast_1',
  ],
  'POST /apps/:appId/engage/broadcasts/:broadcastId/archive': [
    'broadcasts',
    'archive',
    'app_1',
    'broadcast_1',
  ],
  'GET /apps/:appId/engage/broadcasts/:broadcastId/analytics': [
    'broadcasts',
    'analytics',
    'app_1',
    'broadcast_1',
  ],
  'GET /apps/:appId/engage/broadcasts/:broadcastId/sends': ['broadcasts', 'sends', 'app_1', 'broadcast_1'],
  'GET /apps/:appId/engage/broadcasts/:broadcastId/sends/export': [
    'broadcasts',
    'export',
    'app_1',
    'broadcast_1',
  ],
  'GET /apps/:appId/engage/automations': ['automations', 'list', 'app_1'],
  'GET /apps/:appId/engage/automations/:automationId': ['automations', 'get', 'app_1', 'automation_1'],
  'POST /apps/:appId/engage/automations': ['automations', 'create', 'app_1'],
  'POST /apps/:appId/engage/automations/nl': ['automations', 'nl', 'app_1'],
  'POST /apps/:appId/engage/automations/:automationId/rheo-agent': [
    'automations',
    'rheo-agent',
    'app_1',
    'automation_1',
  ],
  'GET /apps/:appId/engage/content-blocks': ['content-blocks', 'list', 'app_1'],
  'GET /apps/:appId/engage/content-blocks/:contentBlockId': [
    'content-blocks',
    'get',
    'app_1',
    'block_1',
  ],
  'POST /apps/:appId/engage/content-blocks': ['content-blocks', 'create', 'app_1'],
  'PATCH /apps/:appId/engage/content-blocks/:contentBlockId': [
    'content-blocks',
    'update',
    'app_1',
    'block_1',
  ],
  'POST /apps/:appId/engage/content-blocks/:contentBlockId/archive': [
    'content-blocks',
    'archive',
    'app_1',
    'block_1',
  ],
  'POST /apps/:appId/engage/content-blocks/:contentBlockId/duplicate': [
    'content-blocks',
    'duplicate',
    'app_1',
    'block_1',
  ],
  'DELETE /apps/:appId/engage/content-blocks/:contentBlockId': [
    'content-blocks',
    'delete',
    'app_1',
    'block_1',
  ],
  'POST /apps/:appId/engage/email-composer/rheo-agent': ['email-composer', 'rheo-agent', 'app_1'],
  'POST /apps/:appId/engage/push-composer/rheo-agent': ['push-composer', 'rheo-agent', 'app_1'],
  'PATCH /apps/:appId/engage/automations/:automationId': ['automations', 'update', 'app_1', 'automation_1'],
  'PATCH /apps/:appId/engage/automations/:automationId/nodes/:nodeId': [
    'automations',
    'update-node',
    'app_1',
    'automation_1',
    'node_1',
  ],
  'POST /apps/:appId/engage/automations/:automationId/publish': [
    'automations',
    'publish',
    'app_1',
    'automation_1',
  ],
  'POST /apps/:appId/engage/automations/:automationId/duplicate': [
    'automations',
    'duplicate',
    'app_1',
    'automation_1',
  ],
  'POST /apps/:appId/engage/automations/:automationId/archive': [
    'automations',
    'archive',
    'app_1',
    'automation_1',
  ],
  'POST /apps/:appId/engage/automations/:automationId/activate': [
    'automations',
    'activate',
    'app_1',
    'automation_1',
  ],
  'POST /apps/:appId/engage/automations/:automationId/audience-enrollments': [
    'automations',
    'enroll-audience',
    'app_1',
    'automation_1',
  ],
  'POST /apps/:appId/engage/automations/:automationId/entry-check': [
    'automations',
    'check-entry',
    'app_1',
    'automation_1',
  ],
  'POST /apps/:appId/engage/automations/:automationId/enrollments': [
    'automations',
    'enroll',
    'app_1',
    'automation_1',
  ],
  'POST /apps/:appId/engage/automations/:automationId/pause': ['automations', 'pause', 'app_1', 'automation_1'],
  'POST /apps/:appId/engage/automations/:automationId/resume': [
    'automations',
    'resume',
    'app_1',
    'automation_1',
  ],
  'GET /apps/:appId/engage/automations/:automationId/versions': [
    'automations',
    'versions',
    'app_1',
    'automation_1',
  ],
  'POST /apps/:appId/engage/automations/:automationId/versions/:version/restore': [
    'automations',
    'restore',
    'app_1',
    'automation_1',
    '3',
  ],
  'GET /apps/:appId/engage/automations/:automationId/analytics': [
    'automations',
    'analytics',
    'app_1',
    'automation_1',
  ],
  'GET /apps/:appId/engage/health': ['health', 'app_1'],
  'POST /apps/:appId/engage/deliverability/resume': ['deliverability', 'resume', 'app_1'],
  'GET /apps/:appId/engage/marketing-topics': ['topics', 'list', 'app_1'],
  'PUT /apps/:appId/engage/marketing-topics': ['topics', 'upsert', 'app_1'],
  'PATCH /apps/:appId/engage/marketing-topics/:topicId': ['topics', 'update', 'app_1', 'topic_1'],
  'POST /apps/:appId/engage/preference-center/preview': ['preference-preview', 'app_1'],
  'POST /apps/:appId/engage/customers/:customerId/consent/attested-grant': [
    'consent',
    'grant',
    'app_1',
    'customer_1',
  ],
};

const fill = (path: string): string =>
  `/v1/dashboard${path}`
    .replaceAll(':appId', 'app_1')
    .replaceAll(':contactId', 'contact_1')
    .replaceAll(':templateId', 'template_1')
    .replaceAll(':segmentId', 'segment_1')
    .replaceAll(':broadcastId', 'broadcast_1')
    .replaceAll(':campaignId', 'broadcast_1')
    .replaceAll(':automationId', 'automation_1')
    .replaceAll(':nodeId', 'node_1')
    .replaceAll(':version', '3')
    .replaceAll(':topicId', 'topic_1')
    .replaceAll(':customerId', 'customer_1')
    .replaceAll(':contentBlockId', 'block_1');

const canonicalKey = (method: string, path: string): string => {
  if (!path.includes('/engage/campaigns')) return `${method} ${path}`;
  const aliased = path
    .replace('/engage/campaigns', '/engage/broadcasts')
    .replace(':campaignId', ':broadcastId');
  return `${method} ${aliased}`;
};

describe('planEngageRequest', () => {
  it('covers every dashboard engage route', () => {
    expect(dashboardRoutes.length).toBeGreaterThan(60);
    const seen = new Set<string>();
    for (const route of dashboardRoutes) {
      const key = canonicalKey(route.method, route.path);
      const argv = fixtures[key];
      expect(argv, key).toBeDefined();
      const plan = planEngageRequest(argv!, flags);
      expect(plan, key).not.toBeNull();
      expect(plan!.method).toBe(route.method);
      expect(plan!.path).toBe(fill(route.path.replace('/engage/campaigns', '/engage/broadcasts').replace(':campaignId', ':broadcastId')));
      if (route.path.endsWith('/sends/export')) expect(plan!.rawText).toBe(true);
      if (route.path.includes('/rheo-agent')) expect(plan!.stream).toBe(true);
      seen.add(key);
    }
    expect([...seen].sort()).toEqual(Object.keys(fixtures).sort());
  });

  it('returns null for an unknown action', () => {
    expect(planEngageRequest(['broadcasts', 'nope', 'app_1'], flags)).toBeNull();
  });

  it('sends overview bounds and environment', () => {
    const plan = planEngageRequest(['overview', 'app_1'], { env: 'test', body: '{}' });
    expect(plan?.query).toMatchObject({ environment: 'test' });
    expect(plan?.query?.startDate).toEqual(expect.any(String));
    expect(plan?.query?.endDate).toEqual(expect.any(String));
  });

  it('accepts --note for deliverability resume', () => {
    const plan = planEngageRequest(['deliverability', 'resume', 'app_1'], { note: 'reviewed' });
    expect(plan?.body).toEqual({ note: 'reviewed' });
  });
});

describe('engage argv flags', () => {
  it('parses engage list filters', () => {
    const parsed = parseArgv([
      'engage',
      'contacts',
      'list',
      'app_1',
      '--q',
      'ada@example.com',
      '--limit',
      '10',
      '--cursor',
      'abc',
      '--status',
      'delivered',
      '--days',
      '14',
      '--note',
      'ok',
      '--include-archived',
    ]);
    expect(parsed.command).toEqual(['engage', 'contacts', 'list', 'app_1']);
    expect(parsed.flags).toMatchObject({
      q: 'ada@example.com',
      limit: '10',
      cursor: 'abc',
      status: 'delivered',
      days: '14',
      note: 'ok',
      'include-archived': true,
    });
  });
});

const fakeHttp = (): HttpClient & { calls: string[] } => {
  const calls: string[] = [];
  const record =
    (method: string) =>
    async (path: string): Promise<unknown> => {
      calls.push(`${method} ${path}`);
      return {
        items: [{ id: 'c_1', email: 'a@b.co', appUserId: 'u', marketingConsent: 'granted' }],
        total: 1,
      };
    };
  return {
    calls,
    get: record('GET'),
    getText: async (path) => {
      calls.push(`TEXT ${path}`);
      return 'email,status\nada@b.co,sent\n';
    },
    post: record('POST'),
    patch: record('PATCH'),
    put: record('PUT'),
    delete: record('DELETE'),
    stream: async (method, path) => {
      calls.push(`STREAM ${method} ${path}`);
    },
  };
};

describe('runEngageCommand', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints a contact table', async () => {
    const lines: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });
    const http = fakeHttp();
    const code = await runEngageCommand({
      http,
      args: ['contacts', 'list', 'app_1'],
      flags: {},
      json: false,
    });
    expect(code).toBe(0);
    expect(http.calls).toEqual(['GET /v1/dashboard/apps/app_1/engage/contacts']);
    expect(lines.join('')).toContain('a@b.co');
    expect(lines.join('')).toContain('total 1');
  });

  it('writes broadcast CSV when --out is set', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rheo-engage-'));
    const out = join(dir, 'sends.csv');
    const lines: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });
    try {
      const http = fakeHttp();
      const code = await runEngageCommand({
        http,
        args: ['broadcasts', 'export', 'app_1', 'broadcast_1'],
        flags: { out, status: 'sent' },
        json: false,
      });
      expect(code).toBe(0);
      expect(http.calls[0]).toContain('/broadcasts/broadcast_1/sends/export');
      expect(readFileSync(out, 'utf8')).toContain('ada@b.co,sent');
      expect(lines.join('')).toContain(`Wrote ${out}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects an unknown engage command', async () => {
    const err: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      err.push(String(chunk));
      return true;
    });
    const code = await runEngageCommand({
      http: fakeHttp(),
      args: ['nope'],
      flags: {},
      json: false,
    });
    expect(code).toBe(1);
    expect(err.join('')).toContain('Unknown engage command');
  });
});
