/** How long a change must sit still before a screen reader hears it. */
export const ANNOUNCE_DELAY_MS = 600;

export type Announcer = {
  /** Announce this text after the delay. A newer call replaces a waiting one. */
  schedule: (text: string) => void;
  /** Announce this text now and drop any waiting change. */
  flush: (text: string) => void;
  cancel: () => void;
};

/** Collects fast changes, such as a slider drag, into one calm announcement. */
export function createAnnouncer(announce: (text: string) => void, initial: string, delay = ANNOUNCE_DELAY_MS): Announcer {
  let last = initial;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  return {
    schedule(text) {
      cancel();
      if (text === last) return;
      timer = setTimeout(() => {
        timer = undefined;
        last = text;
        announce(text);
      }, delay);
    },
    flush(text) {
      cancel();
      if (text === last) return;
      last = text;
      announce(text);
    },
    cancel,
  };
}
