import {
  DEFAULT_API_URL,
  readConfig,
  removeProfile,
  resolveAuth,
  resolveConfigPath,
  setProfile,
} from '../config.js';
import { printBanner } from '../banner.js';
import { printError, printJson, printKv, printSuccess } from '../format.js';
import { CliHttpError, createHttpClient } from '../http.js';

/** Matches `@getrheo/contracts` `WORKSPACE_API_KEY_PREFIX` (kept local so CLI builds against published npm contracts). */
const WORKSPACE_API_KEY_PREFIX = 'rheo_wk_';

export const runAuthLogin = async (opts: {
  apiKey: string;
  profile: string;
  apiUrl?: string;
  json?: boolean;
  configPath?: string;
  fetchImpl?: typeof fetch;
}): Promise<number> => {
  const key = opts.apiKey.trim();
  if (!key.startsWith(WORKSPACE_API_KEY_PREFIX)) {
    printError(`Expected a workspace API key starting with ${WORKSPACE_API_KEY_PREFIX}`);
    return 1;
  }
  const apiUrl = (opts.apiUrl ?? DEFAULT_API_URL).replace(/\/$/, '');
  const http = createHttpClient({
    apiUrl,
    apiKey: key,
    fetchImpl: opts.fetchImpl,
  });
  try {
    await http.get('/v1/dashboard/workspace');
  } catch (err) {
    if (err instanceof CliHttpError && (err.status === 401 || err.status === 403)) {
      printError(err.message);
      return 2;
    }
    printError(err instanceof Error ? err.message : String(err));
    return 1;
  }

  const configPath = opts.configPath ?? resolveConfigPath();
  setProfile(
    configPath,
    opts.profile,
    {
      apiKey: key,
      apiUrl,
    },
    true,
  );
  if (opts.json) {
    printJson({ ok: true, profile: opts.profile, configPath });
  } else {
    printBanner();
    printSuccess(`Logged in as profile "${opts.profile}"`);
    process.stdout.write(`Saved to ${configPath}\n`);
  }
  return 0;
};

export const runAuthLogout = (opts: {
  profile?: string;
  json?: boolean;
  configPath?: string;
}): number => {
  const configPath = opts.configPath ?? resolveConfigPath();
  const config = readConfig(configPath);
  const profile = opts.profile?.trim() || config.defaultProfile;
  if (!config.profiles[profile]) {
    printError(`Profile "${profile}" not found`);
    return 1;
  }
  removeProfile(configPath, profile);
  if (opts.json) {
    printJson({ ok: true, removed: profile });
  } else {
    printSuccess(`Removed profile "${profile}"`);
  }
  return 0;
};

export const runAuthStatus = (opts: {
  profile?: string;
  apiUrl?: string;
  json?: boolean;
  configPath?: string;
}): number => {
  try {
    const auth = resolveAuth({
      profile: opts.profile,
      apiUrl: opts.apiUrl,
      configPath: opts.configPath,
    });
    const masked = `${auth.apiKey.slice(0, 12)}…${auth.apiKey.slice(-4)}`;
    const payload = {
      source: auth.source,
      profile: auth.profile,
      apiUrl: auth.apiUrl,
      apiKey: masked,
    };
    if (opts.json) printJson(payload);
    else {
      printKv([
        ['source', payload.source],
        ['profile', payload.profile ?? '(env)'],
        ['apiUrl', payload.apiUrl],
        ['apiKey', payload.apiKey],
      ]);
    }
    return 0;
  } catch (err) {
    printError(err instanceof Error ? err.message : String(err));
    return 1;
  }
};
