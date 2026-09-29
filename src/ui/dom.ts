type Child = Node | string | null | undefined | false;
type Props = Record<string, unknown> & { class?: string; on?: Record<string, (e: Event) => void> };

/** Tiny hyperscript helper — keeps the UI dependency-free. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'on') for (const [ev, fn] of Object.entries(v as Record<string, (e: Event) => void>)) el.addEventListener(ev, fn);
    else if (k in el && k !== 'list') (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c) el.append(c);
  return el;
}

export function clear(el: Element): void {
  el.textContent = '';
}

let toastEl: HTMLElement | null = null;
let toastTimer = 0;
export function toast(msg: string): void {
  if (!toastEl) {
    toastEl = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl?.classList.remove('show'), 2200);
}
