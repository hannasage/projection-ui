'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppearanceAudio, type AudioStatus } from '../lib/appearance-audio';

export function useAppearanceAudio() {
  const audio = useRef<AppearanceAudio | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [status, setStatus] = useState<AudioStatus>('ready');
  useEffect(() => {
    const engine = new AppearanceAudio(() => new AudioContext(), setStatus);
    audio.current = engine;
    if (!document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches) void engine.play('modern');
    const stop = () => engine.stop();
    const visibility = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', stop);
    return () => {
      audio.current = null;
      engine.dispose();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', stop);
    };
  }, []);

  const play = useCallback((appearance: string) => {
    if (enabled && !document.hidden) void audio.current?.play(appearance === 'flat' ? 'flat' : 'modern', true);
    else audio.current?.stop();
  }, [enabled]);

  const toggle = (appearance: string) => {
    if (enabled && status === 'ready') { setEnabled(false); audio.current?.stop(); }
    else { setEnabled(true); if (!document.hidden) void audio.current?.play(appearance === 'flat' ? 'flat' : 'modern', true); }
  };
  return { play, toggle, status, active: enabled && status === 'ready' };
}
