import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  // Bundle @getrheo/contracts so the published binary does not need TS sources.
  noExternal: ['@getrheo/contracts'],
  banner: {
    js: '#!/usr/bin/env node',
  },
});
