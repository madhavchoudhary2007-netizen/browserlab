export type Ink = { u: number; v: number; w: number };
export type InkSink = (a: { u: number; v: number }, b: Ink) => void;

/** Fixed-step pen physics: the nib rides a slightly under-damped spring toward the target, so ink and drawing speed are identical at any frame rate. Values (v, target) are in sheet pixels from the bottom edge. */
export class PenEngine {
  static readonly H = 1 / 120;
  u = 0; v = 0; vv = 0; tilt = 0; t = 0;
  readonly path: Ink[] = [];
  private acc = 0; private tick = 0; private lu = 0; private lv = 0;
  private readonly seconds: number; private readonly target: (u: number) => number; private readonly onInk: InkSink;
  private readonly K: number; private readonly Cd: number;

  constructor(o: { seconds: number; target: (u: number) => number; onInk: InkSink; stiffness?: number }) {
    this.seconds = o.seconds; this.target = o.target; this.onInk = o.onInk;
    this.K = o.stiffness ?? 1100; this.Cd = 2 * 0.6 * Math.sqrt(this.K);
    this.v = this.lv = o.target(0);
  }
  get done(): boolean { return this.u >= 1; }

  /** Call once per animation frame with the time since the previous frame, in seconds. */
  frame(dtSec: number): void {
    const H = PenEngine.H;
    this.acc += Math.min(Math.max(dtSec, 0), 0.1);
    for (let n = 0; this.acc >= H && n < 12 && !this.done; n++, this.acc -= H) this.phys();
    if (this.acc > H * 12) this.acc = 0;
  }
  private phys(): void {
    const H = PenEngine.H;
    this.t += H; this.u = Math.min(1, this.u + H / this.seconds);
    this.vv += (this.K * (this.target(this.u) - this.v) - this.Cd * this.vv) * H; this.v += this.vv * H;
    this.tilt += (this.vv * 0.004 - this.tilt) * Math.min(1, H * 8);
    if ((++this.tick & 1) === 0) {
      const ink: Ink = { u: this.u, v: this.v + 1.1 * Math.sin(this.t * 31) * Math.sin(this.t * 7.3), w: 2.3 - Math.min(0.7, Math.abs(this.vv) / 700) };
      this.onInk({ u: this.lu, v: this.lv }, ink); this.path.push(ink); this.lu = ink.u; this.lv = ink.v;
    }
  }
}
