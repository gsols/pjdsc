import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { acquireDevLock } from '../scripts/dev-lock.mjs';

test('a second development launcher cannot take the same project cache', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pjdsc-dev-lock-'));
  const release = acquireDevLock(directory);
  try { assert.throws(() => acquireDevLock(directory), /already owns/); }
  finally { release(); fs.rmdirSync(directory); }
});
test('a stopped owner can be reclaimed without requiring a manual cache delete', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pjdsc-dev-lock-'));
  const child = spawn(process.execPath, ['-e', ''], { stdio: 'ignore' });
  const pid = child.pid;
  await once(child, 'exit');
  fs.writeFileSync(path.join(directory, '.next-dev.lock'), JSON.stringify({ pid }));
  const release = acquireDevLock(directory);
  try { assert.equal(JSON.parse(fs.readFileSync(path.join(directory, '.next-dev.lock'))).pid, process.pid); }
  finally { release(); fs.rmdirSync(directory); }
});
