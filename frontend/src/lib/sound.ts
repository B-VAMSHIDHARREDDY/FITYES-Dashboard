/**
 * UI sound engine — every sound is synthesized with the Web Audio API (no audio files).
 * One consistent click sound is used across the whole app.
 * Browsers only allow audio after a user gesture, so the AudioContext is created lazily.
 */

type Listener = () => void;

const PREFS_KEY = "fityes-sound";

function loadEffects(): boolean {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return JSON.parse(raw).effects !== false;
  } catch {
    /* storage unavailable */
  }
  return true;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private lastTick = 0;
  private listeners = new Set<Listener>();
  private effects = loadEffects();

  get effectsOn() {
    return this.effects;
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  setEffects(on: boolean) {
    this.effects = on;
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ effects: on }));
    } catch {
      /* ignore */
    }
    if (on) this.toggle(true);
    this.listeners.forEach((l) => l());
  }

  private audio(): AudioContext | null {
    if (typeof window === "undefined" || !("AudioContext" in window)) return null;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /* ---------- primitives ---------- */

  private tone(
    freq: number,
    opts: { dur?: number; type?: OscillatorType; gain?: number; delay?: number; slideTo?: number; attack?: number } = {},
  ) {
    const ctx = this.audio();
    if (!ctx || !this.master) return;
    const { dur = 0.08, type = "sine", gain = 0.12, delay = 0, slideTo, attack = 0.004 } = opts;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** Short filtered noise burst — gives clicks a physical "attack". */
  private burst(opts: { dur: number; gain: number; freq: number; q?: number; type?: BiquadFilterType }) {
    const ctx = this.audio();
    if (!ctx || !this.master) return;
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.type ?? "bandpass";
    filter.frequency.value = opts.freq;
    filter.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + opts.dur + 0.01);
  }

  /** Single, soft UI click used for every button, link and tab. */
  click() {
    if (!this.effects) return;
    this.tone(1800, { dur: 0.035, type: "triangle", gain: 0.07, slideTo: 900 });
  }

  /** Very short tick for sliders; throttled so dragging feels like a detent wheel. */
  tick() {
    if (!this.effects) return;
    const now = performance.now();
    if (now - this.lastTick < 45) return;
    this.lastTick = now;
    this.tone(2600, { dur: 0.018, type: "square", gain: 0.025 });
  }

  toggle(on: boolean) {
    if (!this.effects) return;
    this.tone(on ? 660 : 520, { dur: 0.06, type: "sine", gain: 0.1 });
    this.tone(on ? 990 : 390, { dur: 0.08, type: "sine", gain: 0.08, delay: 0.05 });
  }

  success() {
    if (!this.effects) return;
    [523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, { dur: 0.22, type: "sine", gain: 0.09, delay: i * 0.07 }));
  }

  error() {
    if (!this.effects) return;
    this.tone(220, { dur: 0.16, type: "sawtooth", gain: 0.05, slideTo: 150 });
    this.tone(180, { dur: 0.2, type: "sawtooth", gain: 0.04, delay: 0.1, slideTo: 120 });
  }

  whoosh() {
    if (!this.effects) return;
    this.burst({ dur: 0.22, gain: 0.05, freq: 900, q: 0.7 });
    this.tone(320, { dur: 0.14, type: "sine", gain: 0.04, slideTo: 640 });
  }
}

export const sound = new SoundEngine();
