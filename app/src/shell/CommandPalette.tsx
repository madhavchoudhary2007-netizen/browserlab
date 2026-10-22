import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

export interface Command { id: string; title: string; hint?: string; run: () => void }

/** ⌘K / Ctrl+K palette on a native <dialog>; combobox + listbox pattern with arrow keys, Enter to run, Escape to close. */
export function CommandPalette({ open, onClose, commands }: { open: boolean; onClose: () => void; commands: Command[] }): ReactNode {
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const uid = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { setQ(""); setIdx(0); d.showModal(); }
    if (!open && d.open) d.close();
  }, [open]);
  const list = useMemo(() => commands.filter((c) => c.title.toLowerCase().includes(q.trim().toLowerCase())), [commands, q]);
  const run = (c: Command | undefined): void => { if (!c) return; onClose(); c.run(); };
  const key = (e: React.KeyboardEvent): void => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, list.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); run(list[idx]); }
  };
  return (
    <dialog ref={ref} className="ds-dialog palette" aria-label="Command palette" onClose={onClose}>
      <input role="combobox" aria-expanded="true" aria-controls={`${uid}-list`} aria-activedescendant={list[idx] ? `${uid}-${list[idx].id}` : undefined} aria-label="Search commands"
        autoComplete="off" value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} onKeyDown={key} placeholder="Type a command" />
      <ul id={`${uid}-list`} role="listbox" aria-label="Commands">
        {list.map((c, i) => (
          <li key={c.id} id={`${uid}-${c.id}`} role="option" aria-selected={i === idx} onMouseMove={() => setIdx(i)} onClick={() => run(c)}>
            <span>{c.title}</span>{c.hint && <kbd>{c.hint}</kbd>}
          </li>
        ))}
        {list.length === 0 && <li role="presentation" className="palette-empty">No command matches “{q}”.</li>}
      </ul>
    </dialog>
  );
}
