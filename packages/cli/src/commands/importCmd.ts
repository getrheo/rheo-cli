export const IMPORT_USAGE = `rheo import: local flow-import tools (Rheo agent skill; no API)

  rheo import help
  rheo import validate <manifest.json> [--offline-profile] [--profile-url <url>]
  rheo import normalize <manifest.json> [--out <path>] [--write] [--target-flow-id <uuid>]
  rheo import summary <manifest.json>
  rheo import scaffold <flow-spec.json> [--out <path>]
  rheo import audit --entry <file|dir> [--entry …] [--root <appRoot>] [--out <path>]
  rheo import audit-publish <manifest.json> [--out <path>]
  rheo import profile [--offline-profile] [--profile-url <url>]

These commands run on disk via @getrheo/rheo-skill and do not call the Rheo API.
`;

export const runImportCommand = async (argv: string[]): Promise<number> => {
  const [command, ...rest] = argv;
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    process.stdout.write(IMPORT_USAGE);
    return command === 'help' || command === '--help' || command === '-h' ? 0 : 1;
  }
  const mod = await import('@getrheo/rheo-skill/flow-import-cli');
  return mod.runCli(command, rest);
};
