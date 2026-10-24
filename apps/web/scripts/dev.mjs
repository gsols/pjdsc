import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { acquireDevLock } from './dev-lock.mjs';

const directory = fileURLToPath(new URL('../', import.meta.url));
let release;
try { release = acquireDevLock(directory); }
catch (error) { process.stderr.write(`${error.message}\n`); process.exit(1); }
process.once('exit', release);
const require = createRequire(import.meta.url);
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', ...process.argv.slice(2)], {
  cwd: directory, stdio: 'inherit', env: process.env,
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.once('error', error => { process.stderr.write(`${error.message}\n`); process.exit(1); });
child.once('exit', code => process.exit(code ?? 0));
