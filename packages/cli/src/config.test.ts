import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  DEFAULT_API_URL,
  readConfig,
  removeProfile,
  resolveAuth,
  setProfile,
} from './config.js';
import { parseArgv } from './cli.js';

describe('config', () => {
  it('writes and resolves a profile', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rheo-cli-'));
    const configPath = join(dir, 'config.json');
    try {
      setProfile(
        configPath,
        'default',
        // Concatenate so scanners do not treat the fixture as a live secret.
        { apiKey: 'rheo_wk_' + 'test_fixture_not_a_real_key', apiUrl: DEFAULT_API_URL },
        true,
      );
      const config = readConfig(configPath);
      expect(config.defaultProfile).toBe('default');
      expect(config.profiles.default?.apiKey).toContain('rheo_wk_');

      const auth = resolveAuth({ configPath, env: {} });
      expect(auth.source).toBe('profile');
      expect(auth.apiUrl).toBe(DEFAULT_API_URL);

      removeProfile(configPath, 'default');
      expect(() => resolveAuth({ configPath, env: {} })).toThrow(/No API key/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('prefers RHEO_API_KEY env over profile', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rheo-cli-'));
    const configPath = join(dir, 'config.json');
    try {
      setProfile(
        configPath,
        'default',
        { apiKey: 'rheo_wk_profile', apiUrl: 'https://example.invalid' },
        true,
      );
      const auth = resolveAuth({
        configPath,
        env: { RHEO_API_KEY: 'rheo_wk_env', RHEO_API_URL: 'https://api.example' },
      });
      expect(auth.source).toBe('env');
      expect(auth.apiKey).toBe('rheo_wk_env');
      expect(auth.apiUrl).toBe('https://api.example');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('parseArgv', () => {
  it('parses global flags and command', () => {
    const parsed = parseArgv([
      '--json',
      '--profile',
      'ci',
      'apps',
      'list',
    ]);
    expect(parsed.globals.json).toBe(true);
    expect(parsed.globals.profile).toBe('ci');
    expect(parsed.command).toEqual(['apps', 'list']);
  });

  it('parses --api-key=value', () => {
    const parsed = parseArgv(['auth', 'login', '--api-key=rheo_wk_abc']);
    expect(parsed.flags['api-key']).toBe('rheo_wk_abc');
    expect(parsed.command).toEqual(['auth', 'login']);
  });
});

describe('setProfile file mode', () => {
  it('persists JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rheo-cli-'));
    const configPath = join(dir, 'config.json');
    try {
      setProfile(configPath, 'a', { apiKey: 'rheo_wk_x', apiUrl: DEFAULT_API_URL });
      const raw = JSON.parse(readFileSync(configPath, 'utf8')) as {
        profiles: Record<string, { apiKey: string }>;
      };
      expect(raw.profiles.a?.apiKey).toBe('rheo_wk_x');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
