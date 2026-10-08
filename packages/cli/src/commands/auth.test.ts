import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runAuthLogin } from './auth.js';

describe('runAuthLogin', () => {
  let dir = '';

  afterEach(() => {
    vi.restoreAllMocks();
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = '';
  });

  it('rejects keys without the workspace prefix', async () => {
    const code = await runAuthLogin({
      apiKey: 'ob_pk_wrong',
      profile: 'default',
      json: true,
    });
    expect(code).toBe(1);
  });

  it('validates GET /v1/dashboard/workspace before save', async () => {
    dir = mkdtempSync(join(tmpdir(), 'rheo-cli-auth-'));
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ name: 'Acme' }), { status: 200 }),
    );
    const code = await runAuthLogin({
      apiKey: 'rheo_wk_testkey1234567890',
      profile: 'default',
      apiUrl: 'https://api.example.test',
      json: true,
      configPath: join(dir, 'config.json'),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(code).toBe(0);
    expect(fetchImpl).toHaveBeenCalled();
    const firstCall = fetchImpl.mock.calls[0] as unknown as [unknown] | undefined;
    expect(String(firstCall?.[0])).toContain('/v1/dashboard/workspace');
    const saved = JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8')) as {
      profiles: Record<string, { apiKey: string }>;
    };
    expect(saved.profiles.default?.apiKey).toBe('rheo_wk_testkey1234567890');
  });

  it('does not save on 401', async () => {
    dir = mkdtempSync(join(tmpdir(), 'rheo-cli-auth-'));
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 }),
    );
    const code = await runAuthLogin({
      apiKey: 'rheo_wk_testkey1234567890',
      profile: 'default',
      apiUrl: 'https://api.example.test',
      json: true,
      configPath: join(dir, 'config.json'),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(code).toBe(2);
    expect(() => readFileSync(join(dir, 'config.json'), 'utf8')).toThrow();
  });
});
