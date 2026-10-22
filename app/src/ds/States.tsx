import type { ReactNode } from "react";
import { Button } from "./primitives";

/** One look for a failed load: what failed, the engine's message, and Retry. Same markup on every screen. */
export function ErrorState({ what, message, onRetry }: { what: string; message: string; onRetry: () => void }): ReactNode {
  return (
    <div role="alert" className="state state-error">
      <p><strong>{what}</strong> {message}</p>
      <div><Button onClick={onRetry}>Retry</Button></div>
    </div>
  );
}

/** One look for "nothing here yet": a plain sentence, with the next step when there is one. */
export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }): ReactNode {
  return <div className="state state-empty"><p>{children}</p>{action ? <div>{action}</div> : null}</div>;
}
