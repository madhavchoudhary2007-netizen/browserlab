import { useCallback, useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

export interface Page { columns: string[]; rows: (string | null)[][]; total: number; offset: number }
export type Fetcher = (offset: number, limit: number) => Promise<Page>;

const PAGE = 200;
const ROW_H = 32;
const COL_W = 148;
const colW = (name: string): number => (name === "trial_id" ? 300 : COL_W);

type Cell = (string | null)[][] | "loading" | "error";

export function formatCell(v: string | null): string {
  if (v === null) return "—";
  if (v !== "" && !Number.isNaN(Number(v)) && /[.eE]/.test(v)) return String(Number(Number(v).toPrecision(6)));
  return v;
}

/** Windowed table: only visible rows are in the DOM; pages are fetched on demand. */
export function VirtualTable({ fetchPage, filterLabel, label }: { fetchPage: Fetcher; filterLabel?: string; label: string }) {
  const [head, setHead] = useState<{ columns: string[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef(new Map<number, Cell>());
  const [, bump] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);

  const load = useCallback((pageIdx: number) => {
    if (cache.current.has(pageIdx)) return;
    cache.current.set(pageIdx, "loading");
    fetchPage(pageIdx * PAGE, PAGE).then(
      (p) => {
        cache.current.set(pageIdx, p.rows);
        if (pageIdx === 0 || !head) setHead({ columns: p.columns, total: p.total });
        bump((n) => n + 1);
      },
      (e: unknown) => {
        cache.current.set(pageIdx, "error");
        if (pageIdx === 0) setError(String(e));
        bump((n) => n + 1);
      },
    );
  }, [fetchPage, head]);

  useEffect(() => {
    cache.current = new Map();
    setHead(null);
    setError(null);
    load(0);
  }, [fetchPage]);

  const total = head?.total ?? 0;
  const virt = useVirtualizer({ count: total, getScrollElement: () => scroller.current, estimateSize: () => ROW_H, overscan: 12 });
  const items = virt.getVirtualItems();
  const first = items[0]?.index ?? 0;
  const last = items[items.length - 1]?.index ?? 0;
  useEffect(() => {
    if (!head) return;
    for (let p = Math.floor(first / PAGE); p <= Math.floor(last / PAGE); p++) load(p);
  }, [first, last, head, load]);

  if (error) {
    return (
      <div role="alert">
        <p>Could not load {label}: {error}</p>
        <button className="min-h-11 px-4" onClick={() => { cache.current = new Map(); setError(null); load(0); }}>Retry</button>
      </div>
    );
  }
  if (!head) return <p aria-busy="true">Loading {label}…</p>;
  if (total === 0) return <p>{filterLabel ? `No rows match ${filterLabel}.` : `${label} contains no rows.`}</p>;

  const cols = head.columns;
  const width = cols.reduce((n, c) => n + colW(c), 0);
  return (
    <div>
      <p className="num" style={{ color: "var(--muted)" }}>
        {total.toLocaleString()} rows{filterLabel ? ` · filtered: ${filterLabel}` : ""}
      </p>
      <div ref={scroller} role="table" aria-label={label} aria-rowcount={total + 1} tabIndex={0}
        style={{ height: 420, overflow: "auto", border: "1px solid var(--line)" }}>
        <div role="row" style={{ position: "sticky", top: 0, zIndex: 1, display: "flex", width, background: "var(--raise)", height: ROW_H }}>
          {cols.map((c) => <div key={c} role="columnheader" className="num truncate px-2" style={{ width: colW(c), lineHeight: `${ROW_H}px` }} title={c}>{c}</div>)}
        </div>
        <div style={{ height: virt.getTotalSize(), width, position: "relative" }}>
          {items.map((it) => {
            const page = cache.current.get(Math.floor(it.index / PAGE));
            const row = Array.isArray(page) ? page[it.index % PAGE] : undefined;
            return (
              <div key={it.index} role="row" aria-rowindex={it.index + 2}
                style={{ position: "absolute", top: 0, left: 0, display: "flex", width, height: ROW_H, transform: `translateY(${it.start}px)` }}>
                {row
                  ? row.map((v, i) => <div key={i} role="cell" className="num truncate px-2" style={{ width: colW(cols[i] ?? ""), lineHeight: `${ROW_H}px` }} title={v ?? "missing"}>{formatCell(v)}</div>)
                  : <div role="cell" className="px-2" style={{ color: "var(--muted)", lineHeight: `${ROW_H}px` }}>{page === "error" ? "Failed to load rows" : "…"}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
