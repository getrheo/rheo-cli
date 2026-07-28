import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

export const DEFAULT_API_URL = 'https://api.getrheo.io';

export type RheoProfile = {
  apiKey: string;
  apiUrl: string;
  workspaceLabel?: string;
};

export type RheoConfigFile = {
  defaultProfile: string;
  profiles: Record<string, RheoProfile>;
};

export type ResolvedAuth = {
  apiKey: string;
  apiUrl: string;
  profile: string | null;
  source: 'env' | 'profile';
};

const emptyConfig = (): RheoConfigFile => ({
  defaultProfile: 'default',
  profiles: {},
});

export const resolveConfigPath = (env: NodeJS.ProcessEnv = process.env): string => {
  if (env.RHEO_CONFIG_PATH?.trim()) return env.RHEO_CONFIG_PATH.trim();
  const xdg = env.XDG_CONFIG_HOME?.trim();
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), '.config');
  return join(base, 'rheo', 'config.json');
};

export const readConfig = (configPath: string): RheoConfigFile => {
  if (!existsSync(configPath)) return emptyConfig();
  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf8')) as RheoConfigFile;
    if (!raw || typeof raw !== 'object' || !raw.profiles) return emptyConfig();
    return {
      defaultProfile: typeof raw.defaultProfile === 'string' ? raw.defaultProfile : 'default',
      profiles: raw.profiles ?? {},
    };
  } catch {
    return emptyConfig();
  }
};

export const writeConfig = (configPath: string, config: RheoConfigFile): void => {
  mkdirSync(dirname(configPath), { recursive: true, mode: 0o700 });
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
};

export const setProfile = (
  configPath: string,
  profileName: string,
  profile: RheoProfile,
  makeDefault = true,
): RheoConfigFile => {
  const config = readConfig(configPath);
  config.profiles[profileName] = profile;
  if (makeDefault) config.defaultProfile = profileName;
  writeConfig(configPath, config);
  return config;
};

export const removeProfile = (configPath: string, profileName: string): RheoConfigFile => {
  const config = readConfig(configPath);
  delete config.profiles[profileName];
  if (config.defaultProfile === profileName) {
    const next = Object.keys(config.profiles)[0];
    config.defaultProfile = next ?? 'default';
  }
  if (Object.keys(config.profiles).length === 0 && existsSync(configPath)) {
    unlinkSync(configPath);
    return emptyConfig();
  }
  writeConfig(configPath, config);
  return config;
};

export const resolveAuth = (opts: {
  profile?: string;
  apiUrl?: string;
  env?: NodeJS.ProcessEnv;
  configPath?: string;
}): ResolvedAuth => {
  const env = opts.env ?? process.env;
  const configPath = opts.configPath ?? resolveConfigPath(env);
  const envKey = env.RHEO_API_KEY?.trim();
  const envUrl = env.RHEO_API_URL?.trim();

  if (envKey) {
    return {
      apiKey: envKey,
      apiUrl: (opts.apiUrl ?? envUrl ?? DEFAULT_API_URL).replace(/\/$/, ''),
      profile: null,
      source: 'env',
    };
  }

  const config = readConfig(configPath);
  const profileName = opts.profile?.trim() || config.defaultProfile;
  const profile = config.profiles[profileName];
  if (!profile?.apiKey) {
    throw new Error(
      `No API key found. Run \`rheo auth login --api-key <key>\` or set RHEO_API_KEY.`,
    );
  }
  return {
    apiKey: profile.apiKey,
    apiUrl: (opts.apiUrl ?? envUrl ?? profile.apiUrl ?? DEFAULT_API_URL).replace(/\/$/, ''),
    profile: profileName,
    source: 'profile',
  };
};
