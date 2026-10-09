export type AppearanceCue = 'modern' | 'flat';
export type AudioStatus = 'ready' | 'blocked' | 'unavailable';

const assets = {
  modern: ['/sounds/modern-blip.mp3', '/sounds/modern-treasure.mp3'],
  flat: ['/sounds/flat-chip.mp3', '/sounds/flat-pop.mp3'],
} as const;
const pairs = [[0, 0], [0, 1], [1, 0], [1, 1]] as const;
type AudioOptions = { fetch?: typeof fetch; random?: () => number };

export class AppearanceAudio {
  private context?: AudioContext;
  private active?: { gain: GainNode; source: AudioBufferSourceNode; ended: boolean; started: boolean };
  private generation = 0;
  private disposed = false;
  private buffers = new Map<string, Promise<AudioBuffer>>();
  private bag: number[] = [];
  private currentPair?: number;
  private lastPair?: number;
  private lastAsset?: string;
  private createContext: () => AudioContext;
  private onStatus: (status: AudioStatus) => void;
  private fetchAudio: typeof fetch;
  private random: () => number;

  constructor(createContext: () => AudioContext, onStatus: (status: AudioStatus) => void, options: AudioOptions = {}) {
    this.createContext = createContext;
    this.onStatus = onStatus;
    this.fetchAudio = options.fetch ?? ((...args) => fetch(...args));
    this.random = options.random ?? Math.random;
  }

  private asset(cue: AppearanceCue, pair: number): string {
    return assets[cue][pairs[pair][cue === 'modern' ? 0 : 1]];
  }

  private selectPair(cue: AppearanceCue): number {
    if (cue === 'flat' && this.currentPair !== undefined) return this.currentPair;
    if (!this.bag.length) this.bag = [0, 1, 2, 3];
    const allowed = (pair: number) => pair !== this.lastPair && this.asset(cue, pair) !== this.lastAsset;
    let candidates = this.bag.filter(allowed);
    // Same-style retries can exhaust one half of a bag; audible repeat avoidance wins.
    if (!candidates.length) candidates = [0, 1, 2, 3].filter(allowed);
    const draw = this.random();
    const index = Number.isFinite(draw) ? Math.max(0, Math.min(candidates.length - 1, Math.floor(draw * candidates.length))) : 0;
    return candidates[index];
  }

  private load(asset: string, context: AudioContext): Promise<AudioBuffer> {
    const cached = this.buffers.get(asset);
    if (cached) return cached;
    const pending = (async () => {
      const response = await this.fetchAudio(asset);
      if (!response.ok) throw new Error('Style sound request failed');
      return context.decodeAudioData(await response.arrayBuffer());
    })().catch(error => {
      this.buffers.delete(asset);
      throw error;
    });
    this.buffers.set(asset, pending);
    return pending;
  }

  stop() {
    this.generation++;
    const active = this.active;
    this.active = undefined;
    if (!active || !this.context || active.ended) return;
    try {
      if (!active.started) throw new Error('Style sound did not start');
      const now = this.context.currentTime;
      active.gain.gain.cancelScheduledValues(now);
      active.gain.gain.setTargetAtTime(0, now, .004);
      active.source.stop(now + .02);
    } catch {
      // A closed context or an unstarted/already-ended source must still go silent.
      active.ended = true;
      active.source.disconnect();
      active.gain.disconnect();
    }
  }

  async play(cue: AppearanceCue, fromGesture = false): Promise<boolean> {
    this.stop();
    if (this.disposed) return false;
    const generation = this.generation;
    const stale = () => this.disposed || generation !== this.generation;
    let failure: AudioStatus = 'unavailable';
    let allocatedGain: GainNode | undefined;
    try {
      this.context ??= this.createContext();
      const context = this.context;
      if (context.state !== 'running') {
        if (!fromGesture) { this.onStatus('blocked'); return false; }
        failure = 'blocked';
        await context.resume();
      }
      if (stale()) return false;
      if (context.state !== 'running') { this.onStatus('blocked'); return false; }
      failure = 'unavailable';
      const pair = this.selectPair(cue);
      let asset = this.asset(cue, pair);
      if (asset === this.lastAsset) asset = assets[cue].find(value => value !== asset)!;
      const buffer = await this.load(asset, context);
      if (stale()) return false;
      // The tab may suspend audio while its sample loads. Never resume without a new gesture.
      if (context.state !== 'running') { this.onStatus('blocked'); return false; }
      const gain = context.createGain();
      allocatedGain = gain;
      const source = context.createBufferSource();
      const active = { gain, source, ended: false, started: false };
      this.active = active;
      gain.gain.value = .4;
      source.onended = () => {
        active.ended = true;
        source.disconnect();
        gain.disconnect();
        if (this.active === active) this.active = undefined;
      };
      source.buffer = buffer;
      source.connect(gain);
      gain.connect(context.destination);
      source.start(context.currentTime);
      active.started = true;
      this.currentPair = pair;
      if (cue === 'modern') {
        this.lastPair = pair;
        this.bag = this.bag.filter(value => value !== pair);
      }
      this.lastAsset = asset;
      this.onStatus('ready');
      return true;
    } catch {
      if (stale()) return false;
      this.stop();
      allocatedGain?.disconnect();
      this.onStatus(failure);
      return false;
    }
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.buffers.clear();
    void this.context?.close().catch(() => {});
  }
}
