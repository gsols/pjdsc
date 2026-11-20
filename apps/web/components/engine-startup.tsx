'use client';

import { useEffect, useState } from 'react';
import { ENGINE_STARTING_MESSAGE, waitForEngine } from '@/lib/engine-connection';

// The landing dashboard reads static inventory, so no forecast request wakes the
// separate engine. Start a bounded liveness check as soon as the site mounts.
export default function EngineStartup() {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'connecting' | 'starting' | 'ready' | 'error'>('connecting');
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setStatus('connecting');
    setError('');
    void waitForEngine({
      signal: controller.signal,
      onStarting: () => { if (!controller.signal.aborted) setStatus('starting'); },
    }).then(() => {
      if (!controller.signal.aborted) setStatus('ready');
    }).catch(reason => {
      if (controller.signal.aborted) return;
      setError(reason instanceof Error ? reason.message : 'Forecast engine unavailable. Please retry.');
      setStatus('error');
    });
    return () => controller.abort();
  }, [attempt]);

  if (status === 'ready') return null;
  return <aside className="engine-startup" aria-label="Forecast engine connection">
    <span role={status === 'error' ? 'alert' : 'status'}>
      {status === 'error' ? error : status === 'starting' ? ENGINE_STARTING_MESSAGE : 'Connecting to the forecast engine...'}
    </span>
    {status === 'error' && <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry engine connection</button>}
  </aside>;
}
