import fs from 'node:fs';
import path from 'node:path';

/** One launcher owns the development cache, regardless of chosen port/host. */
export function acquireDevLock(directory) {
  const filename = path.join(directory, '.next-dev.lock');
  const busy = () => new Error('A development server already owns this project cache. Reuse that server or stop it before starting another npm run dev.');
  try {
    const previous = fs.readFileSync(filename, 'utf8');
    let owner;
    try { owner = JSON.parse(previous); } catch { throw busy(); }
    if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0) throw busy();
    try { process.kill(owner.pid, 0); throw busy(); }
    catch (error) { if (error.code !== 'ESRCH') throw busy(); }
    // Reclaim only a completed record whose owner is confirmed dead and unchanged.
    if (fs.readFileSync(filename, 'utf8') !== previous) throw busy();
    fs.unlinkSync(filename);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  let descriptor;
  try { descriptor = fs.openSync(filename, 'wx'); }
  catch (error) { if (error.code === 'EEXIST') throw busy(); throw error; }
  try { fs.writeFileSync(descriptor, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })); }
  finally { fs.closeSync(descriptor); }
  return () => {
    try {
      if (JSON.parse(fs.readFileSync(filename, 'utf8')).pid === process.pid) fs.unlinkSync(filename);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  };
}
