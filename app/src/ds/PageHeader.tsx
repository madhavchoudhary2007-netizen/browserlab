import type { ReactNode } from "react";

/** The one header every screen starts with: a single h1, a one-line purpose, and (when the screen has one) its primary action at the right. */
export function PageHeader({ title, purpose, action }: { title: string; purpose: string; action?: ReactNode }): ReactNode {
  return (
    <header className="page-head">
      <div className="page-head-text"><h1>{title}</h1><p className="page-purpose">{purpose}</p></div>
      {action ? <div className="page-action">{action}</div> : null}
    </header>
  );
}
