import { useCallback, useEffect, useState } from "react";
import { call, type Remote } from "../engine";

/** Last good answer per method+params. Revisiting a screen shows it at once while the same engine call runs again in the background. */
const seen = new Map<string, unknown>();

/**
 * View-layer adapter around the same `call` wrapper that useRemote uses (the data layer itself is frozen).
 * Stale while revalidate: on a revisit render the previous answer immediately and refresh it when the call returns.
 * The engine call is still made on every mount, so method, params, count and order are unchanged; only the skeleton is skipped.
 */
export function useSwr<T>(method: string, params: Record<string, unknown>) {
  const key = JSON.stringify(params);
  const cacheKey = `${method}|${key}`;
  const [state, setState] = useState<Remote<T>>(() => (seen.has(cacheKey) ? { kind: "ready", value: seen.get(cacheKey) as T } : { kind: "loading" }));
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let live = true;
    const stale = seen.has(cacheKey);
    setState(stale ? { kind: "ready", value: seen.get(cacheKey) as T } : { kind: "loading" });
    call<T>(method, JSON.parse(key) as Record<string, unknown>).then(
      (value) => { seen.set(cacheKey, value); if (live) setState({ kind: "ready", value }); },
      (e: unknown) => { if (live && !stale) setState({ kind: "error", message: String(e) }); },
    );
    return () => { live = false; };
  }, [method, key, nonce, cacheKey]);
  return [state, useCallback(() => setNonce((n) => n + 1), [])] as const;
}
