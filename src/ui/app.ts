import { CUE_META, CUE_ORDER } from '../core/cueMeta';
import { DEMO_SCRIPT } from '../core/demo';
import { buildAiRequest, exportClean, exportReelPrompt, safeFilename } from '../core/exportio';
import { DEFAULT_AI_PROMPT } from '../core/prompt';
import { cueToMarker, estimateDuration, formatTime, parseScript, serializeItems } from '../core/parser';
import {
  DEFAULT_SETTINGS, ScriptStore, loadCurrentId, loadPrompt, loadSettings, saveCurrentId, savePrompt, saveSettings,
} from '../core/storage';
import type { CuePosition, Settings, StoredScript } from '../core/storage';
import { applySuggestions, suggestCues } from '../core/suggest';
import type { Suggestion } from '../core/suggest';
import type { ScriptItem } from '../core/types';
import { cueChoices, renderCueBoard } from './cueboard';
import { clear, h, toast } from './dom';
import { copyText, downloadText, pickTextFile } from './files';
import { openPrompter } from './prompterView';
import { renderHero } from './hero';
import { paceControl } from './pace';
import { ic, icon } from './icons';

type View = 'scripts' | 'format' | 'prompt' | 'settings';

export function startApp(root: HTMLElement): void {
  const kv = window.localStorage;
  const store = new ScriptStore(kv);
  let settings = loadSettings(kv);
  let aiPrompt = loadPrompt(kv, DEFAULT_AI_PROMPT);
  let view: View = 'scripts';
  let currentId: string | null = null;
  let saveTimer = 0;
  const HERO_KEY = 'reelprompt.hero.hidden';
  const heroHidden = () => { try { return kv.getItem(HERO_KEY) === '1'; } catch { return false; } };
  const setHero = (hidden: boolean) => { try { kv.setItem(HERO_KEY, hidden ? '1' : '0'); } catch { /* ignore */ } render(); };

  if (!store.list().length) currentId = store.create('Voice modulation demo', DEMO_SCRIPT).id;
  else {
    const saved = loadCurrentId(kv);
    currentId = saved && store.get(saved) ? saved : store.list()[0].id;
  }

  const current = (): StoredScript | undefined => (currentId ? store.get(currentId) : undefined);
  const applyTheme = () => { document.documentElement.dataset.theme = settings.theme; };
  const updateSettings = (patch: Partial<Settings>) => { settings = { ...settings, ...patch }; saveSettings(kv, settings); applyTheme(); };
  applyTheme();

  const main = h('main', { id: 'main', tabindex: '-1' });
  const nav = h('nav', { class: 'tabs', 'aria-label': 'Sections' });

  const play = () => {
    const sc = current();
    if (!sc) return toast('Create or select a script first');
    const parsed = parseScript(sc.content, settings);
    if (!parsed.items.some((i) => i.type === 'line')) return toast('This script has no spoken text yet');
    openPrompter({
      title: sc.name, items: parsed.items, settings,
      onSettings: (s) => { settings = s; saveSettings(kv, s); applyTheme(); },
      onExit: () => { if (view === 'settings') render(); },
    });
  };

  const header = h('header', { class: 'top' },
    h('a', { class: 'brand', href: '#', 'aria-label': 'ReelPrompt home', on: { click: (e) => { e.preventDefault(); go('scripts'); } } },
      h('span', { class: 'tally', 'aria-hidden': 'true' }), 'ReelPrompt'),
    nav,
    h('button', { class: 'btn primary', type: 'button', on: { click: play } }, ...ic('play', 'Open prompter')),
  );
  root.append(h('a', { class: 'skip', href: '#main' }, 'Skip to content'), header, main);

  function go(v: View) { view = v; render(); }

  function renderNav() {
    clear(nav);
    const tabs: [View, string][] = [['scripts', 'Scripts'], ['format', 'Add cues'], ['prompt', 'AI prompt'], ['settings', 'Settings']];
    for (const [v, label] of tabs) {
      nav.append(h('button', { class: 'tab', type: 'button', 'aria-current': v === view ? 'page' : 'false', on: { click: () => go(v) } }, label));
    }
  }

  function render() {
    renderNav();
    clear(main);
    if (view === 'scripts') main.append(scriptsView());
    else if (view === 'format') main.append(formatView());
    else if (view === 'prompt') main.append(promptView());
    else main.append(settingsView());
    main.classList.remove('view-enter');
    void main.offsetWidth; // restart the entrance animation
    main.classList.add('view-enter');
  }

  /* ---------------- Scripts ---------------- */
  function scriptsView(): HTMLElement {
    const sc = current();
    const list = h('ul', { class: 'script-list', 'aria-label': 'Saved scripts' });
    let li = 0;
    for (const s of store.list()) {
      list.append(h('li', { style: `--i:${li++}` },
        h('button', { class: 'script-item', type: 'button', 'aria-current': String(s.id === currentId), on: { click: () => { currentId = s.id; saveCurrentId(kv, s.id); render(); } } },
          h('strong', {}, s.name), h('small', {}, `${parseScript(s.content, settings).wordCount} words`))));
    }
    const side = h('aside', { class: 'side' },
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', type: 'button', on: { click: () => { const n = store.create('New script', ''); currentId = n.id; saveCurrentId(kv, n.id); render(); } } }, ...ic('plus', 'New')),
        h('button', { class: 'btn', type: 'button', on: { click: async () => {
          const f = await pickTextFile();
          if (!f) return;
          const n = store.create(f.name, f.text); currentId = n.id; saveCurrentId(kv, n.id); render(); toast('Imported ' + f.name);
        } } }, ...ic('upload', 'Import .txt'))),
      list,
      h('button', { class: 'btn quiet', type: 'button', on: { click: () => { const n = store.create('Voice modulation demo', DEMO_SCRIPT); currentId = n.id; saveCurrentId(kv, n.id); render(); } } }, 'Add demo script'));

    const hero = heroHidden() ? null : renderHero({ onStart: play, onLearn: () => go('prompt'), onHide: () => setHero(true) });
    if (heroHidden()) side.append(h('button', { class: 'btn quiet sm', type: 'button', on: { click: () => setHero(false) } }, 'Show intro'));
    if (!sc) return h('div', {}, hero, h('div', { class: 'layout' }, side, h('section', { class: 'panel' }, h('p', {}, 'No script selected. Create one with “New”.'))));

    const name = h('input', { class: 'name', value: sc.name, 'aria-label': 'Script name', on: { change: (e) => { store.rename(sc.id, (e.target as HTMLInputElement).value); render(); } } });
    const stats = h('p', { class: 'muted', 'aria-live': 'polite' });
    const ta = h('textarea', { class: 'editor', spellcheck: false, 'aria-label': 'Script text', placeholder: 'Paste your script here. Performance markers such as [PAUSE:1.5] or [LOUDER] are supported.' });
    ta.value = sc.content;
    const board = h('div', { class: 'board' });

    const refresh = (fromBoard = false) => {
      const p = parseScript(ta.value, settings);
      stats.textContent = `${p.wordCount} words · ${p.cueCount} cues · ≈ ${formatTime(estimateDuration(p))} at 150 wpm` + (p.unknown.length ? ` · unrecognised: ${p.unknown.join(' ')}` : '');
      clear(board);
      board.append(renderCueBoard({
        items: p.items, defaults: settings,
        onChange: (items) => { ta.value = serializeItems(items); persist(); refresh(true); },
      }));
      void fromBoard;
    };
    const persist = () => {
      clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => store.update(sc.id, { content: ta.value }), 250);
    };
    let refreshTimer = 0;
    ta.addEventListener('input', () => {
      persist();
      clearTimeout(refreshTimer); // rebuilding the cue board per keystroke is costly — wait for a pause in typing
      refreshTimer = window.setTimeout(() => refresh(), 180);
    });
    ta.addEventListener('blur', () => { clearTimeout(saveTimer); store.update(sc.id, { content: ta.value }); });

    const insertCue = (marker: string) => {
      const v = ta.value;
      const pos = ta.selectionStart ?? v.length;
      const lineStart = v.lastIndexOf('\n', pos - 1) + 1;
      let lineEnd = v.indexOf('\n', pos);
      if (lineEnd === -1) lineEnd = v.length;
      const isBlank = v.slice(lineStart, lineEnd).trim() === '';
      const ins = isBlank ? marker : '\n' + marker;
      const at = isBlank ? lineStart : lineEnd;
      const end = isBlank ? lineEnd : lineEnd;
      ta.value = v.slice(0, at) + ins + v.slice(end);
      const caret = at + ins.length;
      ta.focus();
      ta.setSelectionRange(caret, caret);
      persist(); refresh();
    };
    const toolbar = h('div', { class: 'toolbar', role: 'toolbar', 'aria-label': 'Add performance cue' }, h('strong', {}, 'Add cue:'),
      ...cueChoices(settings).map((c) => h('button', { class: `btn sm cue-btn cue-${c.cue.kind}`, type: 'button', title: `Insert ${cueToMarker(c.cue)} after the current line`,
        on: { click: () => insertCue(cueToMarker(c.cue)) } }, h('i', { class: 'dot', 'aria-hidden': 'true' }), c.label)));

    const actions = h('div', { class: 'row wrap' },
      h('button', { class: 'btn', type: 'button', on: { click: () => { const d = store.duplicate(sc.id); if (d) { currentId = d.id; saveCurrentId(kv, d.id); render(); toast('Duplicated'); } } } }, ...ic('copy', 'Duplicate')),
      h('button', { class: 'btn danger', type: 'button', on: { click: () => {
        if (!confirm(`Delete “${sc.name}”? This cannot be undone.`)) return;
        store.remove(sc.id); currentId = store.list()[0]?.id ?? null; render();
      } } }, ...ic('trash', 'Delete')),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn', type: 'button', on: { click: () => downloadText(`${safeFilename(sc.name)}-clean.txt`, exportClean(ta.value, settings)) } }, ...ic('download', 'Clean .txt')),
      h('button', { class: 'btn', type: 'button', on: { click: () => downloadText(`${safeFilename(sc.name)}.reelprompt.txt`, exportReelPrompt(ta.value, settings)) } }, ...ic('download', 'ReelPrompt .txt')),
      h('button', { class: 'btn', type: 'button', on: { click: () => copyText(exportClean(ta.value, settings), 'Clean script copied') } }, ...ic('copy', 'Copy clean')),
      h('button', { class: 'btn', type: 'button', title: 'Copies the AI prompt plus your script, asking an AI to add performance markers', on: { click: () => copyText(buildAiRequest(ta.value, aiPrompt, settings), 'AI request copied — paste it into ChatGPT, Claude, Gemini or Grok') } }, ...ic('bot', 'Copy for AI')),
    );

    refresh();
    return h('div', {}, hero, h('div', { class: 'layout' }, side,
      h('section', { class: 'panel' }, name, actions, toolbar, stats,
        h('div', { class: 'split' },
          h('div', {}, h('h2', {}, 'Script'), ta),
          h('div', {}, h('h2', {}, 'Cue preview'), h('p', { class: 'muted small' }, 'Spoken lines with their cues. Edit pauses, remove cues or add new ones — no marker syntax needed.'), board)))));
  }

  /* ---------------- Format for Performance ---------------- */
  let fmtText = '';
  let fmtItems: ScriptItem[] | null = null;
  let dismissed = new Set<string>();
  function formatView(): HTMLElement {
    const ta = h('textarea', { class: 'editor short', 'aria-label': 'Plain script', placeholder: 'Paste an ordinary script with no markers…' });
    ta.value = fmtText;
    const out = h('div', { class: 'board' });

    const keyOf = (items: ScriptItem[], s: Suggestion) => {
      const anchor = items[s.index]?.type === 'line' ? (items[s.index] as { text: string }).text : (items[s.index - 1] as { text?: string } | undefined)?.text;
      return `${anchor}|${s.cue.kind}`;
    };
    const live = (): Suggestion[] => (fmtItems ? suggestCues(fmtItems).filter((s) => !dismissed.has(keyOf(fmtItems!, s))) : []);
    const draw = () => {
      clear(out);
      if (!fmtItems) { out.append(h('p', { class: 'muted' }, 'Analyze a script to see suggested cues.')); return; }
      const sug = live();
      out.append(
        h('div', { class: 'row wrap' },
          h('strong', {}, `${sug.length} suggestion${sug.length === 1 ? '' : 's'}`),
          h('button', { class: 'btn sm', type: 'button', disabled: !sug.length, on: { click: () => { fmtItems = applySuggestions(fmtItems!, sug); draw(); } } }, 'Accept all'),
          h('span', { class: 'spacer' }),
          h('button', { class: 'btn primary', type: 'button', on: { click: () => { const n = store.create('Formatted script', serializeItems(fmtItems!)); currentId = n.id; saveCurrentId(kv, n.id); go('scripts'); toast('Saved as a new script'); } } }, 'Save as new script'),
          h('button', { class: 'btn', type: 'button', disabled: !current(), on: { click: () => { const c = current(); if (c) { store.update(c.id, { content: serializeItems(fmtItems!) }); go('scripts'); toast('Current script updated'); } } } }, 'Replace current script')),
        renderCueBoard({
          items: fmtItems, defaults: settings, suggestions: sug,
          onChange: (items) => { fmtItems = items; draw(); },
          onAccept: (s) => { fmtItems = applySuggestions(fmtItems!, [s]); draw(); },
          onDismiss: (s) => { dismissed.add(keyOf(fmtItems!, s)); draw(); },
        }));
    };
    const analyze = () => {
      fmtText = ta.value;
      fmtItems = parseScript(fmtText, settings).items;
      dismissed = new Set();
      draw();
    };
    draw();
    return h('section', { class: 'panel wide' },
      h('h1', {}, 'Format for performance'),
      h('p', { class: 'muted' }, 'Paste a plain script and get suggestions for where to pause, slow down or push the energy. It all happens in your browser — no AI service, no key — and nothing is added until you say so.'),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn primary', type: 'button', on: { click: analyze } }, ...ic('sparkles', 'Analyze script')),
        h('button', { class: 'btn', type: 'button', disabled: !current(), on: { click: () => { ta.value = current()?.content ?? ''; analyze(); } } }, 'Use current script')),
      h('div', { class: 'split' }, h('div', {}, h('h2', {}, 'Plain script'), ta), h('div', {}, h('h2', {}, 'Structured editor'), out)));
  }

  /* ---------------- AI Script Prompt ---------------- */
  function promptView(): HTMLElement {
    const ta = h('textarea', { class: 'editor tall', 'aria-label': 'AI script prompt', spellcheck: false });
    ta.value = aiPrompt;
    ta.addEventListener('input', () => { aiPrompt = ta.value; savePrompt(kv, aiPrompt); });
    return h('section', { class: 'panel wide' },
      h('h1', {}, 'AI Script Prompt'),
      h('ol', { class: 'steps' },
        h('li', {}, 'Copy the prompt below and paste it into ChatGPT, Claude, Gemini, Grok or any assistant.'),
        h('li', {}, 'Fill in the “MY REQUEST” section (topic, tone, duration, audience).'),
        h('li', {}, 'Paste the AI’s answer into a new ReelPrompt script — the markers are parsed automatically.')),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn primary', type: 'button', on: { click: () => copyText(ta.value, 'Prompt copied') } }, ...ic('copy', 'COPY PROMPT')),
        h('button', { class: 'btn', type: 'button', on: { click: () => { ta.value = DEFAULT_AI_PROMPT; aiPrompt = ta.value; savePrompt(kv, aiPrompt); toast('Prompt reset to default'); } } }, 'Reset to default'),
        h('span', { class: 'muted small' }, 'The prompt is editable and saved on this device.')),
      ta);
  }

  /* ---------------- Settings ---------------- */
  function settingsView(): HTMLElement {
    const num = (label: string, key: keyof Settings, min: number, max: number, step: number, unit = '') => {
      const out = h('output', {}, `${settings[key]}${unit}`);
      const input = h('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(settings[key]),
        on: { input: () => { updateSettings({ [key]: parseFloat(input.value) } as Partial<Settings>); out.textContent = `${settings[key]}${unit}`; } } });
      return h('label', { class: 'field' }, h('span', {}, label), input, out);
    };
    const check = (label: string, key: 'mirror' | 'cuesAdjustSpeed' | 'cueIcons' | 'cueText') => {
      const input = h('input', { type: 'checkbox', checked: settings[key], on: { change: () => updateSettings({ [key]: input.checked } as Partial<Settings>) } });
      return h('label', { class: 'field check' }, input, h('span', {}, label));
    };
    const pos = h('select', { 'aria-label': 'Cue position', on: { change: () => updateSettings({ cuePosition: pos.value as CuePosition }) } },
      ...(['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'] as CuePosition[]).map((p) => h('option', { value: p, selected: p === settings.cuePosition }, p.replace('-', ' '))));
    const theme = h('select', { 'aria-label': 'App look', on: { change: () => updateSettings({ theme: theme.value as 'dark' | 'light' }) } },
      h('option', { value: 'light', selected: settings.theme === 'light' }, 'Paper desk'), h('option', { value: 'dark', selected: settings.theme === 'dark' }, 'Night desk'));
    const ptheme = h('select', { 'aria-label': 'Prompter screen', on: { change: () => updateSettings({ prompterTheme: ptheme.value as 'dark' | 'light' }) } },
      h('option', { value: 'dark', selected: settings.prompterTheme === 'dark' }, 'Dark'), h('option', { value: 'light', selected: settings.prompterTheme === 'light' }, 'Light'));
    const rmodeSel = h('select', { 'aria-label': 'Reading mode', on: { change: () => updateSettings({ cuesEnabled: rmodeSel.value === 'cues' }) } },
      h('option', { value: 'cues', selected: settings.cuesEnabled }, 'With cues and pauses'), h('option', { value: 'plain', selected: !settings.cuesEnabled }, 'Plain text only'));
    const rmode = h('select', { 'aria-label': 'Recording mode', on: { change: () => updateSettings({ recordMode: rmode.value as Settings['recordMode'] }) } },
      h('option', { value: 'off', selected: settings.recordMode === 'off' }, 'Off'), h('option', { value: 'video', selected: settings.recordMode === 'video' }, 'Selfie video + audio'), h('option', { value: 'audio', selected: settings.recordMode === 'audio' }, 'Audio only'));
    const facing = h('select', { 'aria-label': 'Camera', on: { change: () => updateSettings({ facing: facing.value as Settings['facing'] }) } },
      h('option', { value: 'user', selected: settings.facing === 'user' }, 'Front (selfie)'), h('option', { value: 'environment', selected: settings.facing === 'environment' }, 'Back'));
    const preview = h('div', { class: 'cue-preview' }, ...CUE_ORDER.map((k) => h('span', { class: `chip cue-${k}` }, h('i', { class: 'dot', 'aria-hidden': 'true' }), CUE_META[k].label)));

    return h('section', { class: 'panel wide settings' },
      h('h1', {}, 'Settings'),
      h('div', { class: 'grid' },
        h('fieldset', {}, h('legend', {}, 'Teleprompter'),
          num('Font size', 'fontSize', 24, 160, 2, 'px'), num('Line spacing', 'lineHeight', 1, 2.4, 0.05), num('Text width', 'textWidth', 40, 100, 2, '%'),
          h('div', { class: 'field pace-field' }, h('span', {}, 'Scroll speed'), paceControl(settings.speed, (v) => updateSettings({ speed: v })).el), num('Countdown', 'countdown', 0, 10, 1, 's'),
          h('label', { class: 'field' }, h('span', {}, 'Reading mode'), rmodeSel), check('Mirror mode', 'mirror'), check('Cues like FASTER / SLOWER adjust scroll speed', 'cuesAdjustSpeed'),
          h('label', { class: 'field' }, h('span', {}, 'App look'), theme), h('label', { class: 'field' }, h('span', {}, 'Prompter screen'), ptheme)),
        h('fieldset', {}, h('legend', {}, 'Pauses'),
          num('Default [PAUSE]', 'pause', 0, 10, 0.5, 's'), num('Default [LONG_PAUSE]', 'longPause', 0, 15, 0.5, 's')),
        h('fieldset', {}, h('legend', {}, 'Recording'),
          h('label', { class: 'field' }, h('span', {}, 'Record'), rmode), h('label', { class: 'field' }, h('span', {}, 'Camera'), facing),
          num('Camera dim behind text', 'camOpacity', 0.1, 0.9, 0.05),
          h('p', { class: 'muted small' }, 'Records the camera and microphone only — never the script. Needs HTTPS or localhost.')),
        h('fieldset', {}, h('legend', {}, 'Performance cues'),
          h('label', { class: 'field' }, h('span', {}, 'Position'), pos),
          num('Size', 'cueSize', 12, 44, 1, 'px'), num('Opacity', 'cueOpacity', 0.3, 1, 0.05), num('Duration', 'cueDuration', 0.5, 10, 0.5, 's'),
          check('Show icons', 'cueIcons'), check('Show text', 'cueText'),
          h('p', { class: 'muted small' }, 'Cues sit on the top or bottom edge, away from the line you are reading.')),
      ),
      h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', on: { click: () => { updateSettings({ ...DEFAULT_SETTINGS }); render(); toast('Settings reset'); } } }, 'Reset to defaults')),
      h('h2', {}, 'Cue styles'), preview);
  }

  render();
}
