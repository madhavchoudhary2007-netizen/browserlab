import { PenEngine, type Ink } from "./PenEngine";

export type Pt = { t: number; v: number };
export type RigOptions = { grid: HTMLCanvasElement; ink: HTMLCanvasElement; pen: HTMLElement; shadow: HTMLElement; host: HTMLElement; mini: boolean; unit: string; onReadout?: (text: string) => void; onState?: (s: PenState) => void };
export type PenState = "idle" | "drawing" | "done";

const DPR_CAP = 2, DELAY = 1, HOLD_MS = 1400, RETURN_MS = 700, SHEET_SECONDS = 60;
const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || "#888";
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Interpolates a value at time x over sorted points, clamped to the first and last point. */
export function sampleAt(p: Pt[], x: number): number {
  if (p.length === 0) return 0;
  if (x <= p[0]!.t) return p[0]!.v;
  const last = p[p.length - 1]!;
  if (x >= last.t) return last.v;
  let lo = 0, hi = p.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (p[m]!.t <= x) lo = m; else hi = m; }
  const a = p[lo]!, b = p[hi]!;
  return lerp(a.v, b.v, (x - a.t) / (b.t - a.t || 1));
}

function niceStep(span: number): number {
  const raw = span / 4, mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const f = raw / mag;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
}

type Phase = "idle" | "sweep" | "hold" | "return";

/** Imperative pen controller: grid canvas (painted on resize/theme), ink canvas (only new segments per frame), and the pen as a transformed element. The frame loop runs only while the pen is sweeping, the document is visible and the sheet is on screen. */
export class PenRig {
  private o: RigOptions; private gctx: CanvasRenderingContext2D; private ictx: CanvasRenderingContext2D;
  private W = 0; private H = 0; private dpr = 1;
  private engine: PenEngine | null = null; private raf = 0; private last = 0; private timer = 0;
  private phase: Phase = "idle"; private visible = true; private onScreen = true; private disposed = false;
  private seconds = SHEET_SECONDS; private lo = 0; private hi = 2000; private plotH = 1;
  private pts: Pt[] = []; private t0 = 0; private mode: "live" | "replay" | "static" = "live";
  private lastText = ""; private lastReadout = 0; private reduced = false;
  private ro: ResizeObserver; private io: IntersectionObserver; private vis = () => { this.visible = !document.hidden; this.wake(); };
  frames = 0;

  constructor(o: RigOptions) {
    this.o = o; o.host.dataset.state = "idle";
    this.gctx = o.grid.getContext("2d")!; this.ictx = o.ink.getContext("2d")!;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(o.host);
    this.io = new IntersectionObserver((e) => { this.onScreen = e[e.length - 1]?.isIntersecting ?? true; this.wake(); });
    this.io.observe(o.host);
    document.addEventListener("visibilitychange", this.vis);
    this.resize();
  }

  /** Pen size: 0.62 per the spec on a normal sheet, growing on tall sheets so it stays in proportion. */
  private get scale(): number { return this.o.mini ? 0.3 : 0.62 * Math.max(1, Math.min(1.7, this.plotH / 320)); }
  get margins() { return this.o.mini ? { l: 4, r: 18, t: 4, b: 4 } : { l: 56, r: 44, t: 40, b: 24 }; }
  private x(u: number) { const m = this.margins; return m.l + u * (this.W - m.l - m.r); }
  private y(px: number) { const m = this.margins; return this.H - m.b - px; }
  private px(val: number) { return Math.max(0, Math.min(1.04, (val - this.lo) / (this.hi - this.lo))) * this.plotH; }

  setReduced(r: boolean) { this.reduced = r; }

  /** Reported to the host as data-state and to onState: idle (nothing drawing), drawing (pen sweeping) or done (a sweep just finished). */
  private state: PenState = "idle";
  private setState(s: PenState) { if (s === this.state) return; this.state = s; this.o.host.dataset.state = s; this.o.onState?.(s); }

  resize() {
    const w = Math.round(this.o.host.clientWidth), h = Math.round(this.o.host.clientHeight);
    if (w === 0 || h === 0 || (w === this.W && h === this.H)) return;
    const oldPlot = this.plotH;
    this.W = w; this.H = h; this.dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    for (const c of [this.o.grid, this.o.ink]) { c.width = Math.round(w * this.dpr); c.height = Math.round(h * this.dpr); }
    this.gctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); this.ictx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const m = this.margins; this.plotH = Math.max(1, h - m.t - m.b);
    this.paintGrid();
    if (this.pending) { const f = this.pending; this.pending = null; f(); return; }
    if (this.engine && oldPlot > 1) this.redraw(this.plotH / oldPlot);
    else if (this.engine) this.redraw(1);
    if (this.phase === "idle" || this.phase === "hold") this.placePen();
  }

  repaint() { this.paintGrid(); this.redraw(1); this.placePen(); }

  private paintGrid() {
    const g = this.gctx, m = this.margins;
    g.clearRect(0, 0, this.W, this.H);
    const grid = css("--grid"), edge = css("--fg-muted");
    const x0 = m.l, x1 = this.W - m.r, yb = this.H - m.b, yt = m.t;
    g.lineWidth = 1;
    const cell = this.o.mini ? 12 : 30;
    g.strokeStyle = grid;
    for (let i = 0, x = x0; x <= x1 + 0.5; i++, x = x0 + i * cell) { g.globalAlpha = i % 5 === 0 ? 0.9 : 0.4; g.beginPath(); g.moveTo(Math.round(x) + 0.5, yt); g.lineTo(Math.round(x) + 0.5, yb); g.stroke(); }
    const rows = 4;
    for (let r = 0; r <= rows; r++) { const y = Math.round(yb - (r / rows) * (yb - yt)) + 0.5; g.globalAlpha = r % 4 === 0 ? 0.9 : 0.55; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
    g.globalAlpha = 1;
    if (this.o.mini) return;
    g.fillStyle = edge; g.font = `12px ${css("--font-num") || "monospace"}`; g.textBaseline = "middle"; g.textAlign = "right";
    for (let r = 0; r <= rows; r++) { const val = this.lo + ((this.hi - this.lo) * r) / rows; g.fillText(Math.round(val).toLocaleString(), x0 - 8, yb - (r / rows) * (yb - yt)); }
    g.textAlign = "center"; g.textBaseline = "top";
    for (let s = 0; s <= 4; s++) g.fillText(`${Math.round((s / 4) * this.seconds)} s`, x0 + (s / 4) * (x1 - x0), yb + 6);
    g.textAlign = "left"; g.textBaseline = "alphabetic"; g.fillText(this.o.unit, 4, 14);
  }

  private setScale(vals: number[]) {
    const mn = Math.min(...vals), mx = Math.max(...vals);
    const mid = (mn + mx) / 2, span = Math.max((mx - mn) * 1.6, mid * 0.5, 40);
    const step = niceStep(span);
    this.lo = Math.max(0, Math.floor((mid - span / 2) / step) * step); this.hi = this.lo + step * 4;
    if (mx > this.hi) { this.hi = Math.ceil(mx / step) * step; }
  }

  private segment(a: { u: number; v: number }, b: Ink) {
    const c = this.ictx; c.strokeStyle = css("--pen"); c.lineCap = "round"; c.lineJoin = "round"; c.lineWidth = b.w;
    c.beginPath(); c.moveTo(this.x(a.u), this.y(a.v)); c.lineTo(this.x(b.u), this.y(b.v)); c.stroke();
  }
  private redraw(scaleV: number) {
    this.ictx.clearRect(0, 0, this.W, this.H);
    const p = this.engine?.path ?? [];
    if (scaleV !== 1) for (const q of p) q.v *= scaleV;
    let prev = { u: 0, v: p[0]?.v ?? 0 };
    for (const q of p) { this.segment(prev, q); prev = q; }
  }

  private placePen(lifted = false) {
    const e = this.engine, s = this.scale;
    const u = e ? e.u : 0, v = e ? e.v : 0;
    const x = Math.min(this.x(u), this.W - this.margins.r), y = this.y(v), tilt = e ? Math.max(-10, Math.min(10, e.tilt * 3)) : 0;
    const rot = 35 + tilt, off = lifted ? 9 : 5, offy = lifted ? 12 : 7;
    this.o.pen.style.transform = `translate3d(${x}px,${y - (lifted ? 6 : 0)}px,0) rotate(${rot}deg) scale(${s})`;
    this.o.shadow.style.transform = `translate3d(${x + off * (this.o.mini ? 0.4 : 1)}px,${y + offy * (this.o.mini ? 0.4 : 1)}px,0) rotate(${rot}deg) scale(${s})`;
    this.o.pen.style.visibility = this.o.shadow.style.visibility = this.W ? "visible" : "hidden";
  }

  private readout(v: number) {
    if (!this.o.onReadout) return;
    const text = Math.round(v).toLocaleString(), now = performance.now();
    if (text === this.lastText || now - this.lastReadout < 100) return;
    this.lastText = text; this.lastReadout = now; this.o.onReadout(text);
  }

  private beginSweep(target: (u: number) => number, seconds: number) {
    this.clearInk();
    this.seconds = seconds; this.phase = "sweep"; this.setState("drawing");
    this.engine = new PenEngine({ seconds, target: (u) => this.px(target(u)), onInk: (a, b) => this.segment(a, b) });
    this.o.pen.style.transition = this.o.shadow.style.transition = "none";
    this.paintGrid(); this.placePen(); this.last = 0; this.wake();
  }
  private clearInk() { this.o.ink.style.transition = "none"; this.o.ink.style.opacity = "1"; this.ictx.clearRect(0, 0, this.W, this.H); }

  /** Live mode: feed one reading (arrival time is the clock; no dependency on sample timestamps). */
  push(value: number) {
    if (this.mode !== "live") { this.mode = "live"; this.engine = null; this.pts = []; this.phase = "idle"; }
    const now = performance.now() / 1000;
    this.pts.push({ t: now, v: value }); if (this.pts.length > 200) this.pts.shift();
    if (this.reduced) { this.drawStaticLive(); return; }
    if (!this.engine && this.phase === "idle") this.startLiveSheet();
  }
  private pending: (() => void) | null = null;
  private startLiveSheet() {
    const p = this.pts; if (p.length === 0) return;
    if (!this.W) { this.pending = () => this.startLiveSheet(); return; } // not laid out yet (screen hidden): start when it appears
    this.setScale(p.map((q) => q.v));
    this.t0 = p[0]!.t;
    const secs = (window as unknown as { __penSeconds?: number }).__penSeconds ?? SHEET_SECONDS; // test hook: shorter sheets for evidence capture
    this.beginSweep((u) => sampleAt(this.pts, this.t0 + u * this.seconds - DELAY), secs);
  }
  private drawStaticLive() {
    const p = this.pts; if (p.length === 0) return;
    this.setScale(p.map((q) => q.v)); this.paintGrid(); this.clearInk();
    const t0 = p[0]!.t; const c = this.ictx; c.strokeStyle = css("--pen"); c.lineWidth = 2; c.lineJoin = c.lineCap = "round"; c.beginPath();
    p.forEach((q, i) => { const x = this.x(Math.min(1, (q.t - t0) / this.seconds)), y = this.y(this.px(q.v)); if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); });
    c.stroke(); this.engine = null; this.placePenAt(p[p.length - 1]!.v, Math.min(1, (p[p.length - 1]!.t - t0) / this.seconds)); this.readout(p[p.length - 1]!.v);
  }
  private placePenAt(v: number, u: number) {
    const s = this.scale, x = this.x(u), y = this.y(this.px(v));
    this.o.pen.style.transform = `translate3d(${x}px,${y}px,0) rotate(35deg) scale(${s})`;
    this.o.shadow.style.transform = `translate3d(${x + 5}px,${y + 7}px,0) rotate(35deg) scale(${s})`;
    this.o.pen.style.visibility = this.o.shadow.style.visibility = "visible";
  }

  /** Stop the live sweep (run paused, stopped or finished): the trace stays on the sheet, the pen lifts. */
  stopLive() {
    if (this.mode !== "live") return;
    this.halt(); this.phase = "idle"; this.setState("idle"); this.o.ink.style.transition = "none"; this.o.ink.style.opacity = "1"; this.placePen(true);
  }
  /** Called when a new run starts: forget the previous sheet. */
  reset() { this.halt(); this.setState("idle"); this.engine = null; this.pts = []; this.phase = "idle"; this.clearInk(); this.mode = "live"; this.placePen(); this.o.pen.style.visibility = this.o.shadow.style.visibility = "hidden"; }

  /** Replay: ink a finished series once, start to end, then sleep. */
  replay(series: Pt[], seconds = 8) {
    if (series.length < 2) return;
    if (!this.W) { this.pending = () => this.replay(series, seconds); return; }
    this.halt(); this.mode = "replay"; this.pts = series;
    const t0 = series[0]!.t, t1 = series[series.length - 1]!.t;
    this.setScale(series.map((q) => q.v)); this.seconds = seconds;
    this.beginSweep((u) => sampleAt(series, t0 + u * (t1 - t0)), seconds);
    this.label(t1 - t0);
  }
  private label(spanSeconds: number) { this.seconds = spanSeconds; this.paintGrid(); }
  /** Show the finished trace at once (reduced motion, or first paint of a report). */
  showStatic(series: Pt[]) {
    if (series.length < 2) return;
    if (!this.W) { this.pending = () => this.showStatic(series); return; }
    this.halt(); this.mode = "static"; this.pts = series;
    const t0 = series[0]!.t, t1 = series[series.length - 1]!.t;
    this.setScale(series.map((q) => q.v)); this.seconds = t1 - t0; this.paintGrid();
    this.clearInk();
    const e = new PenEngine({ seconds: 8, target: (u) => this.px(sampleAt(series, t0 + u * (t1 - t0))), onInk: (a, b) => this.segment(a, b) });
    while (!e.done) e.frame(1 / 30);
    this.engine = e; this.phase = "idle"; this.setState("idle"); this.placePen(true);
  }

  private wake() {
    if (this.raf || this.disposed || this.phase !== "sweep" || !this.visible || !this.onScreen) return;
    this.last = 0; this.raf = requestAnimationFrame(this.tick);
  }
  private tick = (now: number) => {
    this.raf = 0;
    const e = this.engine;
    if (!e || this.phase !== "sweep" || !this.visible || !this.onScreen) return;
    const dt = this.last ? (now - this.last) / 1000 : 0; this.last = now; this.frames++;
    e.frame(dt); this.placePen(); this.readout(this.lastValue(e));
    if (e.done) { this.phase = "hold"; this.setState("done"); this.placePen(true); this.timer = window.setTimeout(() => this.afterHold(), this.mode === "live" ? HOLD_MS : 0); return; }
    this.raf = requestAnimationFrame(this.tick);
  };
  private lastValue(e: PenEngine): number { return this.lo + (e.v / this.plotH) * (this.hi - this.lo); }

  private afterHold() {
    this.timer = 0;
    if (this.disposed) return;
    if (this.mode !== "live") { this.phase = "idle"; return; }
    this.phase = "return";
    const t = `transform ${RETURN_MS}ms ease-in-out`;
    this.o.pen.style.transition = this.o.shadow.style.transition = t;
    this.o.ink.style.transition = `opacity ${RETURN_MS}ms linear`; this.o.ink.style.opacity = "0";
    const s = this.scale, x = this.x(0), y = this.y(this.px(sampleAt(this.pts, performance.now() / 1000 - DELAY)));
    this.o.pen.style.transform = `translate3d(${x}px,${y - 6}px,0) rotate(35deg) scale(${s})`;
    this.o.shadow.style.transform = `translate3d(${x + 9}px,${y + 10}px,0) rotate(35deg) scale(${s})`;
    this.timer = window.setTimeout(() => { this.timer = 0; this.phase = "idle"; this.engine = null; this.startLiveSheet(); }, RETURN_MS + 30);
  }

  private halt() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; if (this.timer) clearTimeout(this.timer); this.timer = 0; }
  get running(): boolean { return this.raf !== 0; }
  get phaseName(): string { return this.phase; }
  get inkCount(): number { return this.engine?.path.length ?? 0; }

  dispose() { this.disposed = true; this.halt(); this.ro.disconnect(); this.io.disconnect(); document.removeEventListener("visibilitychange", this.vis); }
}
