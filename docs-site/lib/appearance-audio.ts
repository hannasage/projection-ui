export type AppearanceCue = 'modern' | 'flat';
export type AudioStatus = 'ready' | 'blocked' | 'unavailable';

export class AppearanceAudio {
  private context?: AudioContext;
  private active?: { gain: GainNode; sources: OscillatorNode[] };
  private generation = 0;
  private disposed = false;
  private createContext: () => AudioContext;
  private onStatus: (status: AudioStatus) => void;

  constructor(createContext: () => AudioContext, onStatus: (status: AudioStatus) => void) {
    this.createContext = createContext;
    this.onStatus = onStatus;
  }

  stop() {
    this.generation++;
    const active = this.active;
    this.active = undefined;
    if (!active || !this.context) return;
    const now = this.context.currentTime;
    active.gain.gain.cancelScheduledValues(now);
    active.gain.gain.setTargetAtTime(0, now, .004);
    for (const source of active.sources) source.stop(now + .02);
  }

  async play(cue: AppearanceCue, fromGesture = false): Promise<boolean> {
    this.stop();
    if (this.disposed) return false;
    const generation = this.generation;
    try {
      this.context ??= this.createContext();
      const context = this.context;
      if (context.state !== 'running') {
        if (!fromGesture) { this.onStatus('blocked'); return false; }
        await context.resume();
      }
      if (this.disposed || generation !== this.generation) return false;
      if (context.state !== 'running') { this.onStatus('blocked'); return false; }
      const gain = context.createGain();
      gain.gain.value = .15;
      gain.connect(context.destination);
      const active = { gain, sources: [] as OscillatorNode[] };
      this.active = active;
      const now = context.currentTime;
      const tone = (frequency: number, offset: number, duration: number, level: number, type: OscillatorType = 'sine') => {
        const source = context.createOscillator();
        const envelope = context.createGain();
        source.type = type;
        source.frequency.value = frequency;
        envelope.gain.setValueAtTime(.0001, now + offset);
        envelope.gain.linearRampToValueAtTime(level, now + offset + .015);
        envelope.gain.exponentialRampToValueAtTime(.0001, now + offset + duration);
        source.connect(envelope);
        envelope.connect(gain);
        active.sources.push(source);
        source.onended = () => {
          source.disconnect();
          envelope.disconnect();
          active.sources = active.sources.filter(item => item !== source);
          if (!active.sources.length) {
            gain.disconnect();
            if (this.active === active) this.active = undefined;
          }
        };
        source.start(now + offset);
        source.stop(now + offset + duration);
      };
      if (cue === 'modern') {
        tone(261.63, 0, 1.35, .1);
        tone(392, 0, 1.25, .06);
        [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((frequency, index) => tone(frequency, .08 + index * .085, .75, .12));
        tone(1567.98, .32, .65, .025, 'triangle');
      } else {
        tone(330, 0, .14, .12, 'triangle');
        tone(246.94, .08, .2, .09, 'triangle');
      }
      this.onStatus('ready');
      return true;
    } catch {
      if (this.disposed || generation !== this.generation) return false;
      this.stop();
      this.onStatus(this.context ? 'blocked' : 'unavailable');
      return false;
    }
  }

  dispose() {
    this.disposed = true;
    this.stop();
    void this.context?.close().catch(() => {});
  }
}
