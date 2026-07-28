import { runCli } from './cli.js';

const main = async () => {
  const code = await runCli(process.argv.slice(2));
  process.exitCode = code;
};

void main();
