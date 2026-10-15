// Keyboard handling: translates browser key events into the original Rogue key characters,
// owns the type-ahead queue, and lets the mouse UI inject keys (including scripted "auto" keys
// such as click-to-travel steps).
import { CTRL } from '../rogue/state.js';

export const input = {
  queue: [],
  waiters: [],
  modal: null,        // function(key, event) -> true if consumed
  autoLetter: null,   // answer for the next "which object" prompt
  autoDir: null,      // answer for the next direction prompt
  onAbortAuto: null,
  keyListeners: new Set(),
  lastWasAuto: false,

  push(k, auto = false) {
    if (!auto) this.flushAuto();
    const item = { k, auto };
    if (this.waiters.length) {
      const w = this.waiters.shift();
      this.lastWasAuto = auto;
      w(k);
    } else {
      this.queue.push(item);
      if (this.queue.length > 24) this.queue.shift();
    }
  },
  pushMany(keys, auto = false) { for (const k of keys) this.push(k, auto); },
  flushAuto() { this.queue = this.queue.filter((q) => !q.auto); },
  flushAll() { this.queue = []; },
  hasAuto() { return this.queue.some((q) => q.auto); },
  next() {
    if (this.queue.length) {
      const item = this.queue.shift();
      this.lastWasAuto = item.auto;
      return Promise.resolve(item.k);
    }
    return new Promise((res) => this.waiters.push(res));
  },
  cancelWaiters(k) { while (this.waiters.length) this.waiters.shift()(k); },
};

const DIR = { ArrowLeft: 'h', ArrowDown: 'j', ArrowUp: 'k', ArrowRight: 'l', Home: 'y', PageUp: 'u', End: 'b', PageDown: 'n' };
const NUMPAD = { Numpad1: 'b', Numpad2: 'j', Numpad3: 'n', Numpad4: 'h', Numpad5: '.', Numpad6: 'l', Numpad7: 'y', Numpad8: 'k', Numpad9: 'u', Numpad0: ',', NumpadDecimal: '.', NumpadAdd: '+', NumpadEnter: '\n' };

export function translateKey(e) {
  if (e.key === 'Escape') return '\x1b';
  let base = DIR[e.key] || NUMPAD[e.code];
  if (base && /[hjklyubn]/.test(base)) {
    if (e.ctrlKey || e.altKey) return CTRL(base);
    if (e.shiftKey) return base.toUpperCase();
    return base;
  }
  if (base) return base;
  if (e.key === 'Enter') return '\n';
  if (e.key === 'Backspace') return '\b';
  if (e.key === 'Tab') return null;
  if (e.ctrlKey && !e.metaKey && e.key.length === 1) {
    const c = e.key.toLowerCase();
    if (c >= 'a' && c <= 'z') return CTRL(c);
  }
  if (e.altKey && !e.ctrlKey && /^[hjklyubn]$/i.test(e.code.replace('Key', '')) ) {
    return CTRL(e.code.replace('Key', '').toLowerCase());
  }
  if (e.metaKey || e.ctrlKey) return null;
  if (e.key.length === 1) return e.key;
  return null;
}

export function installKeyboard(onSpecial) {
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
    if (onSpecial && onSpecial(e)) { e.preventDefault(); return; }
    const k = translateKey(e);
    if (k === null) return;
    // browsers reserve a few chords; we can still stop most of them
    e.preventDefault();
    if (input.modal && input.modal(k, e)) return;
    for (const l of input.keyListeners) l(k, e);
    input.push(k);
  }, { capture: true });
}
