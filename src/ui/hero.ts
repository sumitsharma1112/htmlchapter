import { h } from './dom';
import { ic, icon } from './icons';

const LOOP_MS = 14000;
const LINES = [
  'Kya aap sach mein', 'sun rahe hain?', 'Ya… bas meri awaaz?', 'Difference bahut bada hai.',
  'Jab hum bolte hain—', 'toh sirf words nahi,', 'emotion important hota hai.', 'Because… great speaking', 'creates emotion.',
];

export interface HeroOptions {
  onStart(): void;
  onLearn(): void;
  onHide(): void;
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** Intro strip with a looping "studio monitor" that shows what the app does. Decorative — hidden from AT. */
export function renderHero(o: HeroOptions): HTMLElement {
  const layer = (cls: string) => h('div', { class: `mon-lines ${cls}` }, ...LINES.map((t) => h('p', {}, t)));
  const tc = h('span', { class: 'mon-tc' }, '00:00:00:00');
  const vu = h('div', { class: 'mon-vu' }, ...Array.from({ length: 16 }, (_, i) => {
    const b = h('i');
    b.style.setProperty('--i', String(i));
    b.style.setProperty('--d', `${0.55 + ((i * 37) % 9) / 10}s`);
    return b;
  }));
  const ring = `<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-opacity=".3" stroke-width="2.5"/><circle class="ring" cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" transform="rotate(-90 10 10)"/></svg>`;
  const chip = (cls: string, label: string, pre = '') => {
    const c = h('span', { class: `mon-chip ${cls}` });
    c.innerHTML = `${pre}<b></b>`;
    (c.querySelector('b') as HTMLElement).textContent = label;
    return c;
  };

  const monitor = h('figure', { class: 'monitor', role: 'img', 'aria-label': 'Animated preview: a script scrolls past a reading line while small cues such as LOUDER, PAUSE and FASTER appear at the top edge.' },
    h('div', { class: 'mon-bar', 'aria-hidden': 'true' },
      h('span', { class: 'mon-rec' }, h('i'), 'REC'), h('span', { class: 'mon-take' }, 'TAKE 07'), tc),
    h('div', { class: 'mon-screen', 'aria-hidden': 'true' },
      h('div', { class: 'mon-stage' },
        layer('dim'),
        h('div', { class: 'mon-band' }, layer('bright')),
        h('span', { class: 'mon-mark' }),
        h('div', { class: 'mon-cues' },
          chip('c-louder', 'LOUDER'), chip('c-pause', 'PAUSE 1.5s', ring), chip('c-faster', 'FASTER'), chip('c-energy', 'MORE ENERGY')))),
    h('div', { class: 'mon-foot', 'aria-hidden': 'true' }, vu, h('span', {}, 'MIC')),
    h('figcaption', {}, 'a take, sped up'));

  const draw = h('span', { class: 'draw' }, 'read');
  draw.insertAdjacentHTML('beforeend', '<svg class="scribble" viewBox="0 0 120 14" preserveAspectRatio="none" aria-hidden="true"><path d="M2 9 C 20 3, 38 12, 58 7 S 96 4, 118 6" pathLength="1"/></svg>');
  const pin = (n: number) => h('span', { class: `pin pin-${n}`, 'aria-hidden': 'true' }, String(n));
  const note = (head: string, rest: string) => h('li', {}, h('span', {}, h('b', {}, head), ' ' + rest));

  const el = h('section', { class: 'hero', 'aria-labelledby': 'hero-title' },
    h('div', { class: 'monitor-wrap' }, monitor, pin(1), pin(2), pin(3)),
    h('div', { class: 'hero-copy' },
      h('h1', { id: 'hero-title' }, 'What you\u2019ll see while you ', draw, '.'),
      h('ol', { class: 'notes' },
        note('The bright line is where you are.', 'It stays put and the text moves, so your eyes don\u2019t go hunting.'),
        note('Directions sit at the top edge.', 'Never over your words. A pause holds the scroll and counts down.'),
        note('Record while you read.', 'Audio or selfie video, saved on this device only.')),
      h('div', { class: 'hero-links' },
        h('button', { class: 'btn primary', type: 'button', on: { click: o.onStart } }, ...ic('play', 'Open prompter')),
        h('button', { class: 'btn', type: 'button', on: { click: o.onLearn } }, 'Get a script from an AI')),
      h('p', { class: 'fine' }, 'no account, nothing uploaded')),
    h('button', { class: 'btn quiet sm hero-x', type: 'button', 'aria-label': 'Hide this guide', on: { click: o.onHide } }, icon('x', 14)));

  // Timecode follows the CSS loop; only ticks while the hero is on screen.
  const start = performance.now();
  let timer = 0;
  const tick = () => {
    if (!el.isConnected) return void clearInterval(timer);
    const t = (performance.now() - start) % LOOP_MS;
    tc.textContent = `00:00:${pad(Math.floor(t / 1000))}:${pad(Math.floor(((t % 1000) / 1000) * 25))}`;
  };
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    const sync = () => {
      if (!el.isConnected) return;
      const r = el.getBoundingClientRect();
      const visible = r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && document.visibilityState === 'visible';
      el.classList.toggle('paused', !visible);
      clearInterval(timer);
      if (visible) timer = window.setInterval(tick, 80);
    };
    new IntersectionObserver(sync).observe(el); // wakes us on scroll; visibility is judged from real geometry
    document.addEventListener('visibilitychange', sync);
    requestAnimationFrame(sync);
  }
  return el;
}
