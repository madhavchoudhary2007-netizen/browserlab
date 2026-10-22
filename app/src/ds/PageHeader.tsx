import type { ReactNode } from "react";

/** The one header every screen starts with: a single h1, a one-line purpose, and (when the screen has one) its primary action at the right. */
export function PageHeader({ title, purpose, action }: { title: string; purpose: string; action?: ReactNode }): ReactNode {
  return (
    <header className="page-head">
      <div className="page-head-text">
        <h1>{title}</h1>
        <svg className="page-ink" width="72" height="8" viewBox="0 0 72 8" aria-hidden="true" focusable="false"><path d="M1 5 C 8 1.5, 13 7, 21 4 S 36 1.5, 44 4.6 S 60 6.4, 71 2.8" pathLength="1" /></svg>
        <p className="page-purpose">{purpose}</p>
      </div>
      {action ? <div className="page-action">{action}</div> : null}
    </header>
  );
}
