import { useCallback, useEffect, useState } from "react";
import { call, type Remote } from "./engine";

/** Last good answer per method+params. Revisiting a screen shows it at once while the same engine call runs again in the background. */
const seen = new Map<string, unknown>();

/**
 * `swr` (stale while revalidate): on a revisit, render the previous answer immediately and refresh it when the call returns.
 * The engine call is still made on every mount, so call order and count are unchanged; only the skeleton is skipped.
 */
export function useRemote<T>(method: string, params: Record<string, unknown>, opts: { swr?: boolean } = {}) {
  const key = JSON.stringify(params);
  const cacheKey = `${method}|${key}`;
  const swr = opts.swr === true;
  const [state, setState] = useState<Remote<T>>(() => (swr && seen.has(cacheKey) ? { kind: "ready", value: seen.get(cacheKey) as T } : { kind: "loading" }));
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let live = true;
    const stale = swr && seen.has(cacheKey);
    setState(stale ? { kind: "ready", value: seen.get(cacheKey) as T } : { kind: "loading" });
    call<T>(method, JSON.parse(key) as Record<string, unknown>).then(
      (value) => { if (swr) seen.set(cacheKey, value); if (live) setState({ kind: "ready", value }); },
      (e: unknown) => { if (live && !stale) setState({ kind: "error", message: String(e) }); },
    );
    return () => { live = false; };
  }, [method, key, nonce, swr, cacheKey]);
  return [state, useCallback(() => setNonce((n) => n + 1), [])] as const;
}
