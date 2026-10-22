import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "quiet";

/** `pending` shows a busy state and blocks repeat activation while an IPC call is in flight. */
export function Button({ variant = "secondary", pending = false, children, className = "", disabled, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; pending?: boolean }): ReactNode {
  return (
    <button {...rest} type={rest.type ?? "button"} disabled={disabled} aria-disabled={pending || undefined} aria-busy={pending || undefined}
      onClick={pending ? (e) => e.preventDefault() : rest.onClick} className={`ds-btn ds-btn-${variant} ${pending ? "is-pending" : ""} ${className}`}>
      {children}
    </button>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: (p: { id: string; "aria-describedby"?: string; "aria-invalid"?: true }) => ReactNode }): ReactNode {
  const id = useId();
  const note = error ?? hint;
  return (
    <div className="ds-field">
      <label htmlFor={id}>{label}</label>
      {children({ id, "aria-describedby": note ? `${id}-note` : undefined, "aria-invalid": error ? true : undefined })}
      {note && <p id={`${id}-note`} className={error ? "ds-error" : "ds-hint"} role={error ? "alert" : undefined}>{note}</p>}
    </div>
  );
}

/** Native <dialog>: focus trap, Escape and inert background come from the platform. */
export function Dialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }): ReactNode {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="ds-dialog" aria-labelledby={titleId} onClose={onClose}>
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  );
}

export function Tabs({ label, tabs, value, onChange }: { label: string; tabs: { id: string; title: string; panel: ReactNode }[]; value: string; onChange: (id: string) => void }): ReactNode {
  const base = useId();
  const move = (e: React.KeyboardEvent, i: number): void => {
    const n = tabs.length;
    const j = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i + n - 1) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (j < 0) return;
    e.preventDefault();
    const t = tabs[j];
    if (t) { onChange(t.id); document.getElementById(`${base}-t-${t.id}`)?.focus(); }
  };
  return (
    <div className="ds-tabs">
      <div role="tablist" aria-label={label}>
        {tabs.map((t, i) => (
          <button key={t.id} id={`${base}-t-${t.id}`} role="tab" aria-selected={t.id === value} aria-controls={`${base}-p-${t.id}`} tabIndex={t.id === value ? 0 : -1}
            onClick={() => onChange(t.id)} onKeyDown={(e) => move(e, i)}>{t.title}</button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} id={`${base}-p-${t.id}`} role="tabpanel" aria-labelledby={`${base}-t-${t.id}`} hidden={t.id !== value}>{t.panel}</div>
      ))}
    </div>
  );
}

export function Tooltip({ text, children }: { text: string; children: ReactNode }): ReactNode {
  const id = useId();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!show) return;
    const on = (e: KeyboardEvent): void => { if (e.key === "Escape") setShow(false); };
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, [show]);
  return (
    <span className="ds-tip" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} onFocus={() => setShow(true)} onBlur={() => setShow(false)} aria-describedby={id}>
      {children}
      <span id={id} role="tooltip" className="ds-tip-bubble" data-show={show}>{text}</span>
    </span>
  );
}

/** Button + menu with arrow-key roving focus, Home/End, Escape and outside-click close. */
export function Menu({ label, items }: { label: string; items: { id: string; title: string; onSelect: () => void }[] }): ReactNode {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const out = (e: MouseEvent): void => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", out);
    return () => document.removeEventListener("mousedown", out);
  }, [open]);
  const key = (e: React.KeyboardEvent): void => {
    const els = [...(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") { setOpen(false); root.current?.querySelector<HTMLElement>("button[aria-haspopup]")?.focus(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); els[(i + 1) % els.length]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); els[(i + els.length - 1) % els.length]?.focus(); }
    else if (e.key === "Home") { e.preventDefault(); els[0]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); els[els.length - 1]?.focus(); }
  };
  return (
    <div className="ds-menu" ref={root} onKeyDown={key}>
      <Button aria-haspopup="menu" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>{label}</Button>
      {open && (
        <ul id={id} role="menu" aria-label={label}>
          {items.map((it) => <li key={it.id} role="none"><button role="menuitem" onClick={() => { setOpen(false); it.onSelect(); }}>{it.title}</button></li>)}
        </ul>
      )}
    </div>
  );
}
