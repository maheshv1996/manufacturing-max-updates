/**
 * Lightweight Web Audio API sound feedback synthesis for industrial shopfloor cues.
 * Zero external audio assets required — pure oscillator synthesis.
 * Handles browser autoplay policies, user gesture unlocking, master mute preferences,
 * and audio context cleanup.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private gestureListenerAttached: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("mfg_sound_enabled");
        if (stored !== null) {
          this.muted = stored === "false";
        }
      } catch {
        // Ignore localStorage restrictions
      }
      this.attachUserGestureUnlock();
    }
  }

  /**
   * Attaches one-time gesture listeners to cleanly resume AudioContext
   * in compliance with modern browser autoplay policies.
   */
  private attachUserGestureUnlock() {
    if (typeof window === "undefined" || this.gestureListenerAttached) return;
    this.gestureListenerAttached = true;

    const unlock = () => {
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      window.removeEventListener("click", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      window.removeEventListener("touchstart", unlock, true);
      window.removeEventListener("pointerdown", unlock, true);
    };

    window.addEventListener("click", unlock, { once: true, capture: true, passive: true });
    window.addEventListener("keydown", unlock, { once: true, capture: true, passive: true });
    window.addEventListener("touchstart", unlock, { once: true, capture: true, passive: true });
    window.addEventListener("pointerdown", unlock, { once: true, capture: true, passive: true });
  }

  private getContext(): AudioContext | null {
    if (typeof window === "undefined" || this.muted) return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /** Mute all audio feedback cues */
  mute() {
    this.muted = true;
    try {
      localStorage.setItem("mfg_sound_enabled", "false");
    } catch {}
    this.pause();
  }

  /** Unmute audio feedback cues */
  unmute() {
    this.muted = false;
    try {
      localStorage.setItem("mfg_sound_enabled", "true");
    } catch {}
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  /** Toggle mute state */
  toggleMute(): boolean {
    if (this.muted) {
      this.unmute();
    } else {
      this.mute();
    }
    return !this.muted;
  }

  /** Check if sound is muted */
  isMuted(): boolean {
    return this.muted;
  }

  /** Pause active audio context */
  pause() {
    if (this.ctx && this.ctx.state === "running") {
      this.ctx.suspend().catch(() => {});
    }
  }

  /** Resume suspended audio context */
  resume() {
    if (this.ctx && this.ctx.state === "suspended" && !this.muted) {
      this.ctx.resume().catch(() => {});
    }
  }

  /** Close audio context on component unmount or terminal shutdown */
  close() {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }

  /** Subtle soft mechanical click */
  playClick() {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.03);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.03);
    } catch {
      // Audio autoplay policy quiet catch
    }
  }

  /** Pleasant two-tone completion chime */
  playSuccess() {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // Quiet catch
    }
  }

  /** Subtle low warning tone */
  playWarning() {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.setValueAtTime(280, now + 0.08);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch {
      // Quiet catch
    }
  }

  /** Distinct piece punch click */
  playPunch() {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.05);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } catch {}
  }

  /** Industrial error buzz */
  playError() {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.setValueAtTime(140, now + 0.1);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch {}
  }
}

export function triggerHaptic(pattern: number | number[] = 15) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(pattern);
    } catch {}
  }
}

export const soundFx = new SoundEngine();
