declare module '@getrheo/rheo-skill/flow-import-cli' {
  export const runCli: (command: string, args: string[]) => Promise<number>;
}
