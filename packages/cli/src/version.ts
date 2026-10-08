import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { printJson } from './format.js';

export const getCliVersion = (): string => {
  const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '../package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
  return pkg.version ?? '0.0.0';
};

export const runVersion = (opts?: { json?: boolean }): number => {
  const version = getCliVersion();
  if (opts?.json) {
    printJson({ name: '@getrheo/cli', version });
  } else {
    process.stdout.write(`${version}\n`);
  }
  return 0;
};
