export const ENGINE_STARTING_MESSAGE = 'Engine starting or temporarily unavailable. Connecting automatically; this can take up to two minutes.';
export type EngineConnectionStatus = 'connecting' | 'starting' | 'loading';

type WakeOptions = {
  signal?: AbortSignal;
  onStarting?: () => void;
  maxWaitMs?: number;
  retryDelayMs?: number;
};

function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}

export async function waitForEngine({ signal, onStarting, maxWaitMs = 120000, retryDelayMs = 3000 }: WakeOptions = {}) {
  const deadline = AbortSignal.timeout(maxWaitMs);
  const bounded = AbortSignal.any([deadline, ...(signal ? [signal] : [])]);
  try {
    while (true) {
      bounded.throwIfAborted();
      let response: Response | undefined;
      let data: { status?: string; code?: string; error?: string } | undefined;
      try {
        response = await fetch('/api/engine/health', {
          cache: 'no-store', signal: AbortSignal.any([bounded, AbortSignal.timeout(10000)]),
        });
        data = await response.json();
      } catch {
        // Transport failures and hosting loading pages are bounded by the same deadline.
        bounded.throwIfAborted();
      }
      bounded.throwIfAborted();
      if (response?.ok && data?.status === 'ok') return;
      if (data && !(response?.status === 503 && data.code === 'ENGINE_STARTING')) {
        throw Error(data.error || 'Engine connection failed. Check the frontend configuration and engine service logs.');
      }
      onStarting?.();
      await pause(retryDelayMs, bounded);
    }
  } catch (error) {
    signal?.throwIfAborted();
    if (deadline.aborted) throw Error('Engine did not respond within two minutes. Retry, or check its Render service logs and configuration.');
    throw error;
  }
}

// Only liveness GETs are retried. A simulation POST is sent once, after waking.
export async function fetchResearch(url: string, init: RequestInit = {}, onStatus?: (status: EngineConnectionStatus) => void) {
  init.signal?.throwIfAborted();
  onStatus?.('connecting');
  await waitForEngine({ signal: init.signal ?? undefined, onStarting: () => onStatus?.('starting') });
  init.signal?.throwIfAborted();
  onStatus?.('loading');
  return fetch(url, { ...init, cache: 'no-store' });
}
