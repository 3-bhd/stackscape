import { createContext, useContext } from 'react';

export interface Settings {
  sound: boolean;
  reducedMotion: boolean;
  present: boolean;
}
export const SettingsCtx = createContext<Settings>({ sound: false, reducedMotion: false, present: false });
export const useSettings = () => useContext(SettingsCtx);

export function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem('stackscape.' + key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
export function save(key: string, v: unknown) {
  try {
    localStorage.setItem('stackscape.' + key, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}
