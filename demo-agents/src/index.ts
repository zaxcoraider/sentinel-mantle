// Orchestrator: spawns all 3 demo agents in parallel as child processes,
// piping their stdout straight through. Ctrl-C cleans them up.

import { spawn, type ChildProcess } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';

const __dirname = dirname(fileURLToPath(import.meta.url));

const AGENTS = [
  { name: 'yieldchaser', file: 'yieldchaser.ts' },
  { name: 'protocolhopper', file: 'protocolhopper.ts' },
  { name: 'insomniac', file: 'insomniac.ts' },
] as const;

console.log(chalk.bold('SENTINEL · agent fleet starting'));
console.log(chalk.gray('Ctrl-C to stop all.\n'));

const procs: ChildProcess[] = [];

for (const agent of AGENTS) {
  const child = spawn('node', ['--import', 'tsx', resolve(__dirname, agent.file)], {
    stdio: 'inherit',
    env: process.env,
  });
  procs.push(child);
  child.on('exit', (code) => {
    console.log(chalk.gray(`[${agent.name}] exited with code ${code}`));
  });
}

const shutdown = (): void => {
  console.log(chalk.gray('\nshutting down agents…'));
  for (const p of procs) {
    if (!p.killed) p.kill('SIGTERM');
  }
  setTimeout(() => process.exit(0), 500);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
