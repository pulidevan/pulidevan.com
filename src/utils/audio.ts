/**
 * AudioManager — singleton for all UI sound effects.
 * Bug fix: AudioContext is created ONCE on first interaction (lazy init).
 * Subsequent play calls reuse the same context to prevent memory leaks.
 */
class AudioManager {
  private ctx: AudioContext | null = null;
  private _enabled = false;
  private _initialized = false;

  /** Call once on first user interaction to unlock Web Audio API */
  public init() {
    if (this._initialized) {
      // Already initialized — just make sure context is running
      if (this.ctx?.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      this._enabled = true;
      return;
    }
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      try {
        this.ctx = new AudioContextClass();
        this._initialized = true;
        this._enabled = true;
        if (this.ctx.state === "suspended") {
          this.ctx.resume().catch(() => {});
        }
      } catch (_) {
        // AudioContext creation failed — silently disable audio
      }
    }
  }

  private get ready(): boolean {
    return this._enabled && !!this.ctx && this.ctx.state !== "closed";
  }

  public playTap() {
    try {
      this.init();
      if (!this.ready || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        300,
        this.ctx.currentTime + 0.05
      );
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch (_) {}
  }

  public playTypingTick() {
    try {
      if (!this.ready || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      const freq = 1100 + Math.random() * 500;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        150,
        this.ctx.currentTime + 0.02
      );
      const vol = 0.01 + Math.random() * 0.01;
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        this.ctx.currentTime + 0.025
      );
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.03);
    } catch (_) {}
  }

  public playSpacebar() {
    try {
      if (!this.ready || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      const freq = 350 + Math.random() * 100;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        80,
        this.ctx.currentTime + 0.04
      );
      const vol = 0.012 + Math.random() * 0.008;
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        this.ctx.currentTime + 0.045
      );
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch (_) {}
  }

  public playSend() {
    try {
      this.init();
      if (!this.ready || !this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      
      // Pitch sweeps upward rapidly (a clean upward bubble swoosh)
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.exponentialRampToValueAtTime(800, t + 0.15);
      
      // Volume envelope: starts low, peaks quickly, decays smoothly
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.04, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.18);
    } catch (_) {}
  }

  public playReceive() {
    try {
      this.init();
      if (!this.ready || !this.ctx) return;
      const t = this.ctx.currentTime;
      
      // Elegant high-pitched bell chime (double tone: E6 then A6)
      const notes = [1318.51, 1760.00]; // E6, A6
      const delays = [0, 0.08];
      
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = "sine";
        
        const startTime = t + delays[idx];
        osc.frequency.setValueAtTime(freq, startTime);
        
        gain.gain.setValueAtTime(0.03, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);
        
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.25);
      });
    } catch (_) {}
  }

  public playSuccess() {
    try {
      this.init();
      if (!this.ready || !this.ctx) return;
      const t = this.ctx.currentTime;
      // Two-tone success chime
      const freqs = [523, 784]; // C5 + G5
      freqs.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, t + idx * 0.12);
        gain.gain.setValueAtTime(0.06, t + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.12 + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(t + idx * 0.12);
        osc.stop(t + idx * 0.12 + 0.35);
      });
    } catch (_) {}
  }
}

export const audio = new AudioManager();
