import { useCallback, useEffect, useState } from "react";
import { call, type Remote } from "./engine";

export function useRemote<T>(method: string, params: Record<string, unknown>) {
  const [state, setState] = useState<Remote<T>>({ kind: "loading" });
  const key = JSON.stringify(params);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let live = true;
    setState({ kind: "loading" });
    call<T>(method, JSON.parse(key) as Record<string, unknown>).then(
      (value) => live && setState({ kind: "ready", value }),
      (e: unknown) => live && setState({ kind: "error", message: String(e) }),
    );
    return () => { live = false; };
  }, [method, key, nonce]);
  return [state, useCallback(() => setNonce((n) => n + 1), [])] as const;
}
