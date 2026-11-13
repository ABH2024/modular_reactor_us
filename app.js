/* Study page logic. Loads the configuration (all texts and the design), the stimulus index and the manifest, and builds the
   participant's plan from the participant code: counterbalanced assignment of the comparisons, seeded order of the screens and
   sides of the videos. Shows the front page, the part introductions, the sound check and the comparison screens; controls the
   playback of each video and unlocks the answers once every video was played to the end; records the answers and the playback
   events, keeps the progress in the browser, sends the answers to the configured address and offers them as a file. */
'use strict';

const SCRIPT_TAG = (typeof document !== 'undefined' && document.currentScript) || null;
const CONFIG_URL = (SCRIPT_TAG && SCRIPT_TAG.getAttribute && SCRIPT_TAG.getAttribute('data-config')) || 'config.json';
let STORE_KEY = 'reaction_study_state_v1';
let CFG = null, INDEX = null, MANIFEST = null, S = null;
const app = document.getElementById('app');

function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function shuffle(arr, rng) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
function randomId(prefix, n) {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const b = new Uint8Array(n);
  (window.crypto || window.msCrypto).getRandomValues(b);
  const s = Array.from(b, x => A[x % A.length]).join('');
  return prefix + s.slice(0, 4) + '-' + s.slice(4);
}

let PREVIEW = false;
function save() { if (PREVIEW) return; try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { } }
function load() { try { const t = localStorage.getItem(STORE_KEY); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
function archive() {
  try { const k = STORE_KEY + '_done'; const L = JSON.parse(localStorage.getItem(k) || '[]'); L.push(S); localStorage.setItem(k, JSON.stringify(L)); } catch (e) { }
}

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined && v !== false) e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== '') e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return e;
}
const T = k => (CFG.texts[k] !== undefined ? CFG.texts[k] : k);
const rich = s => String(s).split(/\*\*(.+?)\*\*/).map((x, i) => (i % 2 ? el('strong', {}, x) : x));
const plain = s => String(s).replace(/\*\*(.+?)\*\*/g, '$1');
const ICON = {
  play: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>',
  replay: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z" fill="currentColor"/></svg>',
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9zM16 8.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="1.8"/></svg>'
};
ICON.rewind = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6h2v12H6zM9.5 12l8.5 6V6z" fill="currentColor"/></svg>';
function icon(e, name) { e.innerHTML = ICON[name]; }
function screen(...kids) { if (app.classList) app.classList.remove('wide'); app.replaceChildren(...kids); window.scrollTo(0, 0); }
function narrowOn() {
  const D = (CFG && CFG.design) || {};
  const bp = +D.narrow_breakpoint || 900, w = +((typeof window !== 'undefined' && window.innerWidth) || 0);
  return !!D.narrow_layout && w > 0 && w < bp;
}
let PHONE_CSS = false;
function phoneCss() {
  if (PHONE_CSS || !CFG || !CFG.design || !CFG.design.narrow_layout || typeof document === 'undefined' || !document.head) return;
  PHONE_CSS = true;
  const bp = (+CFG.design.narrow_breakpoint || 900) - 1;
  document.head.append(el('style', { id: 'phone-css' }, `@media (max-width: ${bp}px) {
  main { padding: 12px 10px 28px; }
  .card { padding: 14px 14px; }
  .panel { padding: 8px 8px 4px; }
  .pv-row { grid-template-columns: 1fr !important; }
  .screen-title { font-size: 1.12rem; margin: 0 0 8px; }
  fieldset.question { padding: 12px 12px 14px; }
  button.choice { padding: 12px 4px; min-height: 44px; }
  button.next { padding: 14px; }
  button.ctl { width: 44px; height: 44px; }
  .phone-hint { font-size: 0.85rem; color: #6f6c68; text-align: center; margin: 0 0 10px; }
}`));
}
const screenBase = screen;
screen = function (...kids) {
  phoneCss();
  if (S && S.device && !S.device.viewport && !S.preview) {
    let coarse = null;
    try { coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches); } catch (e) { coarse = null; }
    S.device.viewport = { inner: `${window.innerWidth || 0}x${window.innerHeight || 0}`, outer: `${window.outerWidth || 0}x${window.outerHeight || 0}`,
                          dpr: window.devicePixelRatio || null, touch_points: (typeof navigator !== 'undefined' && navigator.maxTouchPoints) || 0,
                          coarse_pointer: coarse, narrow_layout: narrowOn() };
  }
  const isStage = kids[0] && kids[0].classList && kids[0].classList.contains('stage');
  if (narrowOn() && !isStage) {
    const t = (CFG.texts && CFG.texts.phone_hint) || 'Please hold your phone upright and use headphones or speakers.';
    kids = [el('p', { class: 'phone-hint muted' }, t), ...kids];
  }
  screenBase(...kids);
};
function setProgress() {
  const bar = document.getElementById('topbar');
  if (!S || !S.plan) { bar.hidden = true; return; }
  const n = S.plan.length, i = Math.min(S.pos + 1, n);
  bar.hidden = false;
  document.getElementById('progress-text').textContent = T('progress') ? T('progress').replace('{i}', i).replace('{n}', n) : '';
  document.getElementById('progress-fill').style.width = (100 * S.pos / n).toFixed(1) + '%';
}
function browserName() {
  const u = navigator.userAgent;
  if (/Edg\//.test(u)) return 'Edge'; if (/OPR\//.test(u)) return 'Opera'; if (/Firefox\//.test(u)) return 'Firefox';
  if (/Chrome\//.test(u) || /Chromium\//.test(u)) return 'Chrome'; if (/Safari\//.test(u)) return 'Safari'; return 'Other';
}
const ANSWER_LABEL = a => T(a);
function creditLine(c) {
  if (!c || !c.text) return '';
  return el('p', { class: 'credit' }, c.text + ' ', c.url ? el('a', { href: c.url, target: '_blank', rel: 'noopener noreferrer' }, c.link_text || c.url) : '',
            c.after || '');
}
const mmss = s => { s = Math.max(0, Math.floor(+s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

function prefixes() {
  const cp = (CFG && CFG.design && CFG.design.code_prefix) || null;
  if (cp && /^[A-Z]{1,4}$/.test(cp.server || '') && /^[A-Z]{1,4}$/.test(cp.random || '') && cp.server !== cp.random)
    return { server: cp.server, random: cp.random, re: new RegExp('^(?:' + cp.server + '|' + cp.random + ')([0-9]{1,7})-') };
  return { server: 'P', random: 'R', re: /^[PR]([0-9]{1,7})-/ };
}
function nRotations() { const per = INDEX.slots_per_set || {}; return Object.keys(per).sort().reduce((a, s) => a * per[s], 1); }
function assignmentOf(code) {
  if (slotGroups()) return assignmentOfGroups(code);
  const per = INDEX.slots_per_set || {}, sets = Object.keys(per).sort(), n = nRotations();
  const m = prefixes().re.exec(code);
  const slot = m ? parseInt(m[1], 10) : cyrb53(code) % (2 * n);
  const rotation = slot % n, offsets = {};
  let radix = 1;
  for (const s of sets) { offsets[s] = Math.floor(rotation / radix) % per[s]; radix *= per[s]; }
  return { slot, slot_in_code: !!m, rotation, n_rotations: n, offsets, side_flip: (slot % 2) ^ (Math.floor(slot / n) % 2) };
}
function slotGroups() {
  const G = CFG && CFG.design && CFG.design.assignment === 'counterbalanced' ? CFG.design.slot_groups : null;
  return Array.isArray(G) && G.length ? G : null;
}
function groupRotations(g) { return g.sets.reduce((a, s) => a * ((INDEX.slots_per_set || {})[s] || 1), 1); }
function slotPeriod() {
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  return slotGroups().reduce((p, g) => { const c = 2 * groupRotations(g); return p / gcd(p, c) * c; }, 1);
}
function assignmentOfGroups(code) {
  const per = INDEX.slots_per_set || {}, period = slotPeriod();
  const m = prefixes().re.exec(code);
  const slot = m ? parseInt(m[1], 10) : cyrb53(code) % period;
  const offsets = {}, side_flip_by_part = {}, groups = [];
  for (const g of slotGroups()) {
    const sets = g.sets.slice().sort(), n = groupRotations(g), gslot = slot % (2 * n), rotation = gslot % n, off = {};
    let radix = 1;
    for (const s of sets) { off[s] = Math.floor(rotation / radix) % per[s]; offsets[s] = off[s]; radix *= per[s]; }
    const side_flip = (gslot % 2) ^ (Math.floor(gslot / n) % 2);
    for (const P of g.parts) side_flip_by_part[P] = side_flip;
    groups.push({ parts: g.parts.slice(), sets, slot: gslot, rotation, n_rotations: n, offsets: off, side_flip });
  }
  return { slot, slot_in_code: !!m, period, offsets, side_flip_by_part, groups };
}
async function newCode(slotParam) {
  const PF = prefixes();
  if (slotParam !== null && /^[0-9]{1,7}$/.test(slotParam)) return { code: randomId(`${PF.server}${parseInt(slotParam, 10)}-`, 8), source: 'url' };
  const ep = CFG.design.slot_endpoint;
  if (ep) {
    try {
      const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 5000) : null;
      const r = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: '{}', cache: 'no-store',
                                  signal: ctrl ? ctrl.signal : undefined });
      if (timer) clearTimeout(timer);
      const j = r.ok ? await r.json() : null;
      const m = PF.re.exec((j && j.code) || '');
      if (m && j.code.startsWith(PF.server) && parseInt(m[1], 10) === j.slot) return { code: j.code, source: 'server' };
    } catch (e) { }
  }
  const b = new Uint32Array(1); (window.crypto || window.msCrypto).getRandomValues(b);
  if (slotGroups()) return { code: randomId(`${PF.random}${b[0] % slotPeriod()}-`, 8), source: 'random' };
  return { code: randomId(`${PF.random}${b[0] % (2 * nRotations())}-`, 8), source: 'random' };
}

function buildPlan(code) {
  if (slotGroups()) return buildPlanGroups(code);
  const D = CFG.design, rng = mulberry32(cyrb53(code));
  const A = D.assignment === 'counterbalanced' ? assignmentOf(code) : null;
  const fixedVariant = {};
  const items = INDEX.items;
  const plan = [];
  const practice = items.find(it => it.role === 'practice');
  if (practice) plan.push({ kind: 'trial', part: practice.part, item: practice, practice: true });
  let parts = D.part_order.slice();
  if (D.randomise_part_order) shuffle(parts, rng);
  for (const P of parts) {
    let trials = [];
    const study = items.filter(it => it.part === P && it.role === 'study');
    if (D.assignment === 'all') trials = study.slice();
    else {
      const sets = [...new Set(study.map(it => it.rotation_set))].sort();
      for (const set of sets) {
        const nslot = INDEX.slots_per_set[set];
        const offset = A ? A.offsets[set] : Math.floor(rng() * nslot);
        const groups = [...new Set(study.filter(it => it.rotation_set === set).map(it => it.group))].sort();
        groups.forEach((g, k) => {
          const want = (k + offset) % nslot;
          const it = study.find(x => x.group === g && x.slot === want);
          if (it) { trials.push(it); if (A) fixedVariant[it.id] = (k + A.side_flip) % 2 === 0 ? '1' : '2'; }
        });
      }
    }
    if (D.include_attention_checks) trials = trials.concat(items.filter(it => it.part === P && it.role === 'attention'));
    if (D.randomise_trial_order_within_part) shuffle(trials, rng);
    plan.push({ kind: 'part', part: P });
    for (const it of trials) plan.push({ kind: 'trial', part: P, item: it });
  }
  for (const p of plan) if (p.kind === 'trial') p.variant = !D.randomise_left_right ? '1'
    : (A ? (fixedVariant[p.item.id] || (A.side_flip ? '2' : '1')) : (rng() < 0.5 ? '1' : '2'));
  const AA = CFG.attention.answers;
  for (const p of plan) if (p.kind === 'trial' && p.item.role === 'attention') p.check_answer = AA[Math.floor(rng() * AA.length)];
  return plan.map(p => p.kind === 'part' ? { kind: 'part', part: p.part } : {
    kind: 'trial', part: p.part, practice: !!p.practice, item_id: p.item.id, role: p.item.role, variant: p.variant,
    left: p.item.sides[p.variant].left, right: p.item.sides[p.variant].right, check_answer: p.check_answer || null
  });
}

function buildPlanGroups(code) {
  const D = CFG.design, rng = mulberry32(cyrb53(code));
  const A = assignmentOfGroups(code), flip = P => A.side_flip_by_part[P] || 0;
  const fixedVariant = {};
  const items = INDEX.items;
  const plan = [];
  const practice = items.find(it => it.role === 'practice');
  if (practice) plan.push({ kind: 'trial', part: practice.part, item: practice, practice: true });
  let parts = D.part_order.slice();
  if (D.randomise_part_order) shuffle(parts, rng);
  for (const P of parts) {
    let trials = [];
    const study = items.filter(it => it.part === P && it.role === 'study');
    const sets = [...new Set(study.map(it => it.rotation_set))].sort();
    for (const set of sets) {
      const nslot = INDEX.slots_per_set[set];
      const offset = A.offsets[set];
      const groups = [...new Set(study.filter(it => it.rotation_set === set).map(it => it.group))].sort();
      groups.forEach((g, k) => {
        const want = (k + offset) % nslot;
        const it = study.find(x => x.group === g && x.slot === want);
        if (it) { trials.push(it); fixedVariant[it.id] = (k + flip(P)) % 2 === 0 ? '1' : '2'; }
      });
    }
    if (D.include_attention_checks) trials = trials.concat(items.filter(it => it.part === P && it.role === 'attention'));
    if (D.randomise_trial_order_within_part) shuffle(trials, rng);
    plan.push({ kind: 'part', part: P });
    for (const it of trials) plan.push({ kind: 'trial', part: P, item: it });
  }
  for (const p of plan) if (p.kind === 'trial') p.variant = !D.randomise_left_right ? '1' : (fixedVariant[p.item.id] || (flip(p.part) ? '2' : '1'));
  const AA = CFG.attention.answers;
  for (const p of plan) if (p.kind === 'trial' && p.item.role === 'attention') p.check_answer = AA[Math.floor(rng() * AA.length)];
  return plan.map(p => p.kind === 'part' ? { kind: 'part', part: p.part } : {
    kind: 'trial', part: p.part, practice: !!p.practice, item_id: p.item.id, role: p.item.role, variant: p.variant,
    left: p.item.sides[p.variant].left, right: p.item.sides[p.variant].right, check_answer: p.check_answer || null
  });
}

function welcome() {
  setProgress();
  const agree = el('input', { type: 'checkbox', id: 'agree' });
  const start = el('button', { class: 'primary wide-btn', disabled: true }, T('start_button'));
  agree.addEventListener('change', () => { start.disabled = !agree.checked; });
  start.addEventListener('click', async () => {
    start.disabled = true; agree.disabled = true;
    const prm = new URLSearchParams(location.search);
    const urlCode = prm.get('code');
    const CB = CFG.design.assignment === 'counterbalanced';
    let code = urlCode, slotSource = null;
    if (CB && urlCode) slotSource = prefixes().re.test(urlCode) ? 'code' : 'code_hash';
    else if (CB) { const got = await newCode(prm.get('slot')); code = got.code; slotSource = got.source; }
    code = code || randomId('P-', 8);
    const now = new Date().toISOString();
    S = {
      study_version: CFG.study_version, manifest_sha256: MANIFEST ? MANIFEST.instrument_sha256 : null,
      code, session_id: randomId('S-', 8), seed: cyrb53(code), started_at: now, finished_at: null,
      consent: { version: CFG.consent_version, accepted_at: now },
      device: { browser: browserName(), screen: `${screen_w()}x${screen_h()}`, window: `${window.innerWidth || 0}x${window.innerHeight || 0}` },
      design: CFG.design, assignment: CB ? Object.assign({ mode: 'counterbalanced', slot_source: slotSource }, assignmentOf(code)) : undefined,
      pos: 0, plan: null, responses: []
    };
    S.plan = buildPlan(code);
    save(); howItWorks();
  });
  const banner = T('consent_placeholder_banner');
  screen(
    el('h1', { class: 'study-title' }, CFG.title),
    el('div', { class: 'card' }, T('welcome_title') ? el('h2', {}, T('welcome_title')) : '', [].concat(T('welcome')).map(t => el('p', {}, t))),
    el('div', { class: 'card' }, el('h2', {}, T('consent_title')), banner ? el('p', { class: 'warn' }, banner) : '', el('p', {}, T('consent')),
      el('label', { class: 'row', for: 'agree' }, agree, T('consent_checkbox'))),
    el('div', { class: 'row center' }, start)
  );
}
const screen_w = () => window.screen ? window.screen.width : 0, screen_h = () => window.screen ? window.screen.height : 0;

function howItWorks() {
  setProgress();
  const hasPractice = (!S.plan || S.plan.some(p => p.practice)) && !!T('practice_intro');
  screen(
    CFG.design.show_code === false ? '' : el('div', { class: 'card' }, el('p', {}, T('code_label')), el('p', { class: 'code' }, S.code)),
    T('how').length ? el('div', { class: 'card' }, el('h2', {}, T('how_title')), el('ul', { class: 'how' }, T('how').map(t => el('li', {}, t)))) : '',
    hasPractice ? el('div', { class: 'card' }, el('h2', {}, T('practice_title')), el('p', {}, T('practice_intro'))) : '',
    el('div', { class: 'row center' }, el('button', { class: 'primary wide-btn', onclick: next }, T('part_button')))
  );
}

function soundCheck() {
  setProgress();
  const sc = INDEX.sound_check || {};
  const t0 = performance.now();
  const rec = { file: sc.file || null, plays: 0, ended: 0, errors: 0, ms_to_ok: null };
  const audio = el('audio', { src: sc.file, preload: 'auto' });
  const play = el('button', {}, T('sound_play'));
  const ok = el('button', { class: 'primary', disabled: true }, T('sound_ok'));
  const msg = el('p', { class: 'muted', 'aria-live': 'polite' }, '');
  play.addEventListener('click', () => {
    rec.plays++; audio.pause(); audio.currentTime = 0;
    const p = audio.play(); if (p && p.catch) p.catch(() => { msg.textContent = T('sound_blocked'); });
  });
  audio.addEventListener('ended', () => { rec.ended++; ok.disabled = false; msg.textContent = T('sound_done'); });
  audio.addEventListener('error', () => { rec.errors++; ok.disabled = false; msg.textContent = T('sound_error'); });
  ok.addEventListener('click', () => {
    audio.pause(); rec.ms_to_ok = Math.round(performance.now() - t0);
    S.sound_check = Object.assign({ passed_at: new Date().toISOString() }, rec); save(); next();
  });
  screen(el('div', { class: 'card soundcheck' }, el('h2', {}, T('sound_title')), el('p', {}, T('sound_text')), audio,
    el('div', { class: 'row' }, play, ok), msg, T('sound_help') ? el('p', { class: 'muted' }, T('sound_help')) : ''));
}

function partIntro(P, afterPractice) {
  const part = CFG.parts[P];
  screen(
    afterPractice && T('practice_done') ? el('div', { class: 'card' }, el('p', {}, T('practice_done'))) : '',
    el('div', { class: 'card' }, el('h2', {}, part.title), el('ul', { class: 'how' }, part.intro.map(t => el('li', {}, t))),
      part.sync_pair ? creditLine(part.credit || CFG.credit) : ''),
    el('div', { class: 'row center' }, el('button', { class: 'primary wide-btn', onclick: () => { S.pos++; save(); next(); } }, T('part_button')))
  );
}

function testTools() {
  try {
    const q = new URLSearchParams(location.search).get('test');
    if (q === '0') return false;
    return q === '1' || ['127.0.0.1', 'localhost'].includes(location.hostname);
  } catch (e) { return false; }
}
function testSkipButton(rec, leave) {
  const b = el('button', { class: 'skip-test', type: 'button',
                           style: 'display:block;margin:10px auto 0;padding:4px 12px;font-size:0.8rem;color:#8a8783;background:none;border:1px dashed #cfcac3' },
               (CFG.texts && CFG.texts.test_skip) || 'Skip (test only)');
  b.addEventListener('click', () => {
    S.test_mode = true; S.test_skips = (S.test_skips || 0) + 1;
    rec.test_skipped = true; rec.answers = {}; rec.ratings = {}; leave();
  });
  return b;
}

function ownControls(p, item) {
  const v = p.video, st = p.st, t0 = performance.now(), dur = (item && item.duration_s) || 0;
  st.rewinds = 0; st.events = []; st.events_dropped = 0;
  const log = kind => {
    if (st.events.length >= 100) { st.events_dropped++; return; }
    st.events.push({ kind, ms: Math.round(performance.now() - t0), t: Math.round(1000 * (+v.currentTime || 0)) / 1000 });
  };
  const txt = (k, d) => (CFG.texts && CFG.texts[k]) || d;
  const play = el('button', { class: 'ctl', type: 'button' });
  const rew = el('button', { class: 'ctl', type: 'button', 'aria-label': txt('aria_rewind', 'Back to the start') });
  const fill = el('div', { class: 'track-fill' });
  const time = el('span', { class: 'time' }, `0:00 / ${mmss(dur)}`);
  icon(rew, 'rewind');
  const render = () => {
    const on = !v.paused;
    icon(play, on ? 'pause' : (v.ended ? 'replay' : 'play'));
    play.setAttribute('aria-label', on ? txt('aria_pause_one', 'Pause this video') : txt('aria_play_one', 'Play this video'));
  };
  const show = () => {
    const t = +v.currentTime || 0, d = isFinite(v.duration) && v.duration > 0 ? v.duration : dur;
    fill.style.width = (d ? Math.min(100, 100 * t / d) : 0).toFixed(1) + '%'; time.textContent = `${mmss(t)} / ${mmss(d)}`;
  };
  const toggle = () => {
    if (v.paused) { log('play'); const pr = v.play(); if (pr && pr.catch) pr.catch(() => { log('play_blocked'); render(); }); }
    else { v.pause(); log('pause'); }
    render();
  };
  play.addEventListener('click', toggle);
  v.addEventListener('click', toggle);
  rew.addEventListener('click', () => { st.rewinds++; log('rewind'); v.currentTime = 0; show(); render(); });
  v.addEventListener('play', render); v.addEventListener('pause', render);
  v.addEventListener('ended', () => { log('ended'); render(); show(); });
  v.addEventListener('timeupdate', show);
  render();
  return el('div', { class: 'ctrlbar', style: 'width:100%' }, play, rew, el('div', { class: 'track' }, fill), time);
}

function makePlayer(side, src, audio, onChange, maxWidth) {
  const st = { side, file: src, plays: 0, pauses: 0, seeks: 0, ended: 0, errors: 0, coverage: 0, watched: false, ms_to_watched: null };
  const t0 = performance.now();
  const ctl = { rate: 1 };
  const video = el('video', { src, preload: 'auto', playsinline: true, disablepictureinpicture: true, muted: audio ? null : true,
                              style: maxWidth ? `max-width:${maxWidth}px` : null,
                              'aria-label': side === 'left' ? T('left_video') : T('right_video') });
  if (!audio) video.muted = true;
  const errBox = el('div', { class: 'verror', hidden: true });
  let bins = null, last = null, closed = false;
  const binsReady = () => { if (!bins && isFinite(video.duration) && video.duration > 0) bins = new Uint8Array(Math.ceil(video.duration * 10)); return !!bins; };
  function mark(a, b) { if (!binsReady()) return; for (let i = Math.floor(a * 10); i < Math.min(bins.length, Math.ceil(b * 10)); i++) bins[i] = 1; }
  function check() {
    if (closed || st.watched || !binsReady()) return;
    let c = 0; for (const x of bins) c += x; st.coverage = +(c / bins.length).toFixed(3);
    const atEnd = video.ended || video.currentTime >= video.duration - 0.2;
    if (atEnd && st.coverage >= 0.9) { st.watched = true; st.ms_to_watched = Math.round(performance.now() - t0); onChange(); }
  }
  video.addEventListener('timeupdate', () => {
    const t = video.currentTime;
    if (!video.paused && last !== null && t > last && t - last < 0.75) mark(last, t);
    last = t; check();
  });
  video.addEventListener('play', () => { st.plays++; last = video.currentTime; });
  video.addEventListener('pause', () => { if (!video.ended) st.pauses++; });
  video.addEventListener('seeked', () => { st.seeks++; last = video.currentTime; });
  video.addEventListener('ended', () => { st.ended++; if (last !== null) mark(last, video.duration); check(); });
  video.addEventListener('ratechange', () => { if (video.playbackRate !== ctl.rate) video.playbackRate = ctl.rate; });
  video.addEventListener('contextmenu', e => e.preventDefault());
  video.addEventListener('error', () => {
    if (closed) return;
    st.errors++;
    errBox.hidden = false;
    errBox.replaceChildren(el('span', {}, T('video_error') + ' '),
      el('button', { onclick: () => { errBox.hidden = true; video.src = src + (src.includes('?') ? '&' : '?') + 'retry=' + st.errors; video.load(); } }, T('video_retry')));
    onChange();
  });
  return { st, video, errBox, close: () => { closed = true; }, setRate: r => { ctl.rate = r; video.playbackRate = r; },
           box: el('figure', { class: 'pv' }, video, el('figcaption', {}, side === 'left' ? T('left_video') : T('right_video')), errBox) };
}

function makePanel(P, rec, note, part, item) {
  const L = P.left, R = P.right, TH = 0.040, BACK = 0.015, HARD = 0.250, SLOW = 0.97, FAST = 1.03, MAX_EVENTS = 300;
  const t0 = performance.now();
  const sy = rec.sync = { mode: part.audio ? 'together_left_sound' : 'together_no_sound', threshold_ms: 40, back_ms: 15, reseek_ms: 250,
                          rates: [SLOW, FAST], play_enabled_ms: null, play_enabled_by: null, starts: 0, pauses: 0, resumes: 0, nudges: 0,
                          reseeks: 0, stalls: 0, stall_ms: 0, play_blocked: 0, sound_toggles: 0, samples: 0, over_threshold: 0,
                          abs_drift_sum_ms: 0, abs_drift_max_ms: 0, abs_drift_mean_ms: null, events: [], events_dropped: 0 };
  let state = 'loading', nudge = 0, closed = false, stallAt = null, pollTimer = null, fallbackTimer = null;
  const dur = (item && item.duration_s) || 0;
  const ms = () => Math.round(performance.now() - t0);
  const log = (kind, extra) => {
    if (sy.events.length >= MAX_EVENTS) { sy.events_dropped++; return; }
    sy.events.push(Object.assign({ kind, ms: ms(), t: Math.round(1000 * (+L.video.currentTime || 0)) / 1000 }, extra || {}));
  };
  const big = el('button', { class: 'bigplay', disabled: true, 'aria-label': T('aria_play') });
  const stallBox = el('div', { class: 'stall', hidden: true }, T('sync_stalled'));
  const ctrl = el('button', { class: 'ctl', disabled: true, 'aria-label': T('aria_play') });
  const fill = el('div', { class: 'track-fill' });
  const time = el('span', { class: 'time' }, `0:00 / ${mmss(dur)}`);
  const snd = part.audio ? el('button', { class: 'ctl', 'aria-label': T('aria_sound_off') }) : null;
  const both = fn => { fn(L.video); fn(R.video); };
  const ready4 = v => v.readyState >= 4, ready3 = v => v.readyState >= 3;
  function render() {
    const playing = state === 'playing' || state === 'stalled';
    big.hidden = playing; big.disabled = state === 'loading'; ctrl.disabled = state === 'loading';
    icon(big, state === 'ended' ? 'replay' : 'play'); big.setAttribute('aria-label', T(state === 'ended' ? 'aria_replay' : 'aria_play'));
    icon(ctrl, playing ? 'pause' : (state === 'ended' ? 'replay' : 'play'));
    ctrl.setAttribute('aria-label', T(playing ? 'aria_pause' : (state === 'ended' ? 'aria_replay' : 'aria_play')));
    stallBox.hidden = state !== 'stalled';
    if (snd) { icon(snd, L.video.muted ? 'mute' : 'sound'); snd.setAttribute('aria-label', T(L.video.muted ? 'aria_sound_on' : 'aria_sound_off')); }
  }
  function enablePlay(by) {
    if (closed || sy.play_enabled_ms !== null) return;
    sy.play_enabled_ms = ms(); sy.play_enabled_by = by; state = 'idle'; log('play_enabled', { by }); render();
  }
  function onReady() {
    if (closed) return;
    if (sy.play_enabled_ms === null) {
      if (ready4(L.video) && ready4(R.video)) enablePlay('canplaythrough');
      else if (ms() >= 10000 && ready3(L.video) && ready3(R.video)) enablePlay('canplay_after_10s');
    } else if (state === 'stalled') tryResume();
  }
  function blocked() {
    sy.play_blocked++; log('play_blocked');
    both(v => v.pause()); R.setRate(1); nudge = 0; state = 'paused'; note.hidden = false; note.textContent = T('sync_play_blocked'); render();
  }
  function playBoth() {
    if (Math.abs(R.video.currentTime - L.video.currentTime) > 0.001) R.video.currentTime = L.video.currentTime;
    let failed = false;
    for (const v of [L.video, R.video]) {
      const p = v.play();
      if (p && p.catch) p.catch(() => { if (!failed && !closed) { failed = true; blocked(); } });
    }
  }
  function start() {
    rec.play_both++; sy.starts++;
    both(v => v.pause()); R.setRate(1); nudge = 0;
    both(v => { v.currentTime = 0; });
    state = 'playing'; log('start'); render(); playBoth();
  }
  function pause() { state = 'paused'; both(v => v.pause()); R.setRate(1); nudge = 0; sy.pauses++; log('pause'); render(); }
  function resume() { state = 'playing'; sy.resumes++; log('resume'); render(); playBoth(); }
  function toggle() {
    if (state === 'loading') return;
    if (state === 'playing') pause(); else if (state === 'paused') resume(); else if (state === 'idle' || state === 'ended') start();
  }
  big.addEventListener('click', toggle);
  ctrl.addEventListener('click', toggle);
  if (snd) snd.addEventListener('click', () => { L.video.muted = !L.video.muted; sy.sound_toggles++; log(L.video.muted ? 'sound_off' : 'sound_on'); render(); });
  function check() {
    if (closed || state !== 'playing' || L.video.paused || R.video.paused || L.video.ended || R.video.ended) return;
    const d = R.video.currentTime - L.video.currentTime, ad = Math.abs(d), adm = Math.round(ad * 1000), dm = Math.round(d * 1000);
    sy.samples++; sy.abs_drift_sum_ms += adm; if (adm > sy.abs_drift_max_ms) sy.abs_drift_max_ms = adm; if (ad > TH) sy.over_threshold++;
    if (ad > HARD) { R.setRate(1); nudge = 0; R.video.currentTime = L.video.currentTime; sy.reseeks++; log('reseek', { drift_ms: dm }); return; }
    if (nudge === 0 && ad > TH) { nudge = d > 0 ? -1 : 1; R.setRate(d > 0 ? SLOW : FAST); sy.nudges++; log('nudge', { drift_ms: dm, rate: d > 0 ? SLOW : FAST }); }
    else if ((nudge === -1 && d < BACK) || (nudge === 1 && d > -BACK)) { R.setRate(1); nudge = 0; log('nudge_end', { drift_ms: dm }); }
  }
  function onTime() {
    const t = +L.video.currentTime || 0, d = isFinite(L.video.duration) && L.video.duration > 0 ? L.video.duration : dur;
    fill.style.width = (d ? Math.min(100, 100 * t / d) : 0).toFixed(1) + '%'; time.textContent = `${mmss(t)} / ${mmss(d)}`;
  }
  function onEnd() {
    if (closed) return;
    R.setRate(1); nudge = 0;
    if (L.video.ended && R.video.ended && state !== 'ended') { state = 'ended'; log('ended'); render(); }
  }
  function onWaiting(e) {
    if (closed || state !== 'playing' || L.video.ended || R.video.ended) return;
    state = 'stalled'; stallAt = performance.now(); sy.stalls++;
    log('stall', { side: e && e.target === R.video ? 'right' : 'left' });
    both(v => v.pause()); R.setRate(1); nudge = 0; render();
    poll();
  }
  function tryResume() {
    if (closed || state !== 'stalled' || !(ready3(L.video) && ready3(R.video))) return;
    const d = Math.round(performance.now() - stallAt); sy.stall_ms += d;
    state = 'playing'; log('stall_end', { stall_ms: d }); render(); playBoth();
  }
  function poll() { clearTimeout(pollTimer); if (closed || state !== 'stalled') return; tryResume(); if (state === 'stalled') pollTimer = setTimeout(poll, 250); }
  for (const p of [L, R]) {
    p.video.addEventListener('canplaythrough', onReady); p.video.addEventListener('canplay', onReady);
    p.video.addEventListener('timeupdate', check); p.video.addEventListener('ended', onEnd); p.video.addEventListener('waiting', onWaiting);
  }
  L.video.addEventListener('timeupdate', onTime);
  setTimeout(onReady, 0);
  fallbackTimer = setTimeout(onReady, 10050);
  render();
  function close() {
    closed = true; clearTimeout(pollTimer); clearTimeout(fallbackTimer);
    sy.abs_drift_mean_ms = sy.samples ? Math.round(sy.abs_drift_sum_ms / sy.samples) : null;
  }
  const w = item && item.width;
  return {
    close,
    box: el('div', { class: 'panel', style: part.sync_pair && w ? `max-width:${2 * w + 44}px` : null },
      el('div', { class: 'pv-row' }, L.box, R.box, big, stallBox),
      el('div', { class: 'ctrlbar' }, ctrl, el('div', { class: 'track' }, fill), time, snd || ''))
  };
}

function choiceGroup(id, text, hint, rec, store, update, small) {
  const opts = CFG.design.tie_option ? ['left', 'tie', 'right'] : ['left', 'right'];
  const btns = opts.map(o => el('button', { class: 'choice' + (o === 'tie' ? ' tie' : ''), 'aria-pressed': 'false', disabled: true }, ANSWER_LABEL(o)));
  btns.forEach((b, k) => b.addEventListener('click', () => {
    store[id] = opts[k];
    btns.forEach((x, j) => { x.classList.toggle('chosen', j === k); x.setAttribute('aria-pressed', j === k ? 'true' : 'false'); });
    update(id, opts[k]);
  }));
  const box = el('fieldset', { class: small ? 'question small' : 'question' }, el('legend', {}, rich(text)), hint ? el('p', { class: 'qhint' }, hint) : '',
                 el('div', { class: 'choices' }, btns));
  return { box, btns };
}

function ratingGroup(side, rec, update) {
  const name = `rate_${side}_${S.pos}`;
  const inputs = [1, 2, 3, 4, 5].map(v => el('input', { type: 'radio', name, value: v, disabled: true, id: `${name}_${v}` }));
  inputs.forEach(inp => inp.addEventListener('change', () => { rec.ratings[side] = Number(inp.value); update(); }));
  const box = el('fieldset', { class: 'rating' }, el('legend', {}, side === 'left' ? T('left_video') : T('right_video')),
    el('div', { class: 'scale' }, inputs.map((inp, k) => el('label', { for: inp.id }, inp, el('span', {}, String(k + 1))))));
  return { box, inputs };
}

function kicker(step) {
  if (step.practice) return T('kicker_practice');
  const mine = S.plan.filter(p => p.kind === 'trial' && !p.practice && p.part === step.part);
  const k = 1 + mine.indexOf(S.plan[S.pos]);
  return T('kicker').replace('{part}', step.part).replace('{k}', k).replace('{n}', mine.length);
}

function trial(step) {
  if (speakerLayoutOn(step)) return trialSpeaker(step);
  if (CFG.design.independent_videos && !CFG.design.ratings) return trialIndependent(step);
  const part = CFG.parts[step.part];
  const wide = !!part.sync_pair;
  const item = INDEX.items.find(it => it.id === step.item_id) || null;
  const t0 = performance.now();
  const rec = { trial_no: S.pos, part: step.part, practice: step.practice, item_id: step.item_id, role: step.role, variant: step.variant,
                files: { left: step.left, right: step.right }, answers: {}, ratings: {}, check: null, video: {}, play_both: 0,
                watched_full: false, ms_to_unlock: null, ms_to_next: null, hidden_ms: 0, skipped_error: false, attention_pass: null,
                answer_events: [] };
  const checkStore = {};
  let hiddenAt = null;
  const onVis = () => { if (document.hidden) hiddenAt = performance.now(); else if (hiddenAt !== null) { rec.hidden_ms += Math.round(performance.now() - hiddenAt); hiddenAt = null; } };
  document.addEventListener('visibilitychange', onVis);

  const note = el('p', { class: 'note', 'aria-live': 'polite' }, CFG.design.require_full_view ? T('wait_for_end') : '');
  const nextBtn = el('button', { class: 'primary next', disabled: true }, T('next_button'));
  const skipBtn = el('button', { class: 'skip', hidden: true }, T('video_skip'));
  const maxW = wide && item ? item.width : null;
  const P = { left: makePlayer('left', step.left, !!part.audio, () => update(), maxW),
              right: makePlayer('right', step.right, false, () => update(), maxW) };
  rec.video = { left: P.left.st, right: P.right.st };
  const panel = makePanel(P, rec, note, part, item);

  const onAnswer = (qid, a) => { if (qid) rec.answer_events.push({ q: qid, a, ms: Math.round(performance.now() - t0) }); update(); };
  const qGroups = part.questions.map(q => choiceGroup(q.id, q.text, q.hint, rec, rec.answers, onAnswer));
  let checkGroup = null;
  if (step.role === 'attention') {
    checkGroup = choiceGroup(CFG.attention.id, CFG.attention.text.replace('{answer}', ANSWER_LABEL(step.check_answer)), '', rec, checkStore, onAnswer, true);
  }
  const rateL = ratingGroup('left', rec, () => update()), rateR = ratingGroup('right', rec, () => update());
  const inOrder = !!CFG.design.reveal_questions_in_order;
  const seq = [...qGroups.map((g, j) => ({ g, done: () => !!rec.answers[part.questions[j].id] })),
               ...(checkGroup ? [{ g: checkGroup, done: () => !!checkStore[CFG.attention.id] }] : [])];

  function update() {
    const watched = P.left.st.watched && P.right.st.watched;
    const unlocked = watched || !CFG.design.require_full_view;
    if (watched && !rec.watched_full) { rec.watched_full = true; rec.ms_to_unlock = Math.round(performance.now() - t0); }
    let open = true;
    for (const { g, done } of seq) {
      g.box.hidden = !open;
      g.btns.forEach(b => { b.disabled = !unlocked || !open; });
      if (inOrder && !done()) open = false;
    }
    [...rateL.inputs, ...rateR.inputs].forEach(b => { b.disabled = !unlocked; });
    const answered = part.questions.every(q => rec.answers[q.id]) && (!checkGroup || checkStore[CFG.attention.id]) &&
                     (!CFG.design.ratings || (rec.ratings.left && rec.ratings.right));
    nextBtn.disabled = !(unlocked && answered);
    const msg = !unlocked ? T('wait_for_end') : (answered ? '' : T('answer_all'));
    note.textContent = msg; note.hidden = !msg;
    skipBtn.hidden = !(P.left.st.errors + P.right.st.errors >= 2 && !watched);
  }
  function leave() {
    document.removeEventListener('visibilitychange', onVis);
    panel.close();
    for (const s of ['left', 'right']) { P[s].close(); P[s].video.pause(); P[s].video.removeAttribute('src'); P[s].video.load(); }
    rec.ms_to_next = Math.round(performance.now() - t0);
    S.responses.push(rec); S.pos++; save(); next();
  }
  nextBtn.addEventListener('click', () => {
    if (checkGroup) {
      rec.check = { id: CFG.attention.id, required: step.check_answer, answer: checkStore[CFG.attention.id] };
      rec.attention_pass = rec.check.answer === step.check_answer;
    }
    leave();
  });
  skipBtn.addEventListener('click', () => { rec.skipped_error = true; rec.answers = {}; rec.ratings = {}; leave(); });

  const rating = part.rating && CFG.design.ratings ? el('div', { class: 'ratings' },
    el('h3', {}, T('rate_title')), el('p', { class: 'rtext' }, part.rating.text),
    el('p', { class: 'qhint' }, T('rate_low') + ' … ' + T('rate_high')),
    el('div', { class: 'pair' }, rateL.box, rateR.box)) : '';
  const narrow = wide && CFG.design.min_window_width && window.innerWidth && window.innerWidth < CFG.design.min_window_width;
  screen(
    el('div', { class: 'stage' },
      narrow ? el('p', { class: 'warn' }, T('narrow_window')) : '',
      el('p', { class: 'kicker' }, kicker(step)),
      el('h2', { class: 'screen-title' }, T('screen_title')),
      panel.box,
      wide ? creditLine(part.credit || CFG.credit) : '',
      el('div', { class: 'qwrap' }, note, ...qGroups.map(g => g.box), checkGroup ? checkGroup.box : '', rating, skipBtn, nextBtn))
  );
  if (testTools()) nextBtn.parentNode.append(testSkipButton(rec, leave));
  if (wide && app.classList) app.classList.add('wide');
  update();
  preloadNext();
}

function trialIndependent(step) {
  const part = CFG.parts[step.part];
  const wide = !!part.sync_pair;
  const item = INDEX.items.find(it => it.id === step.item_id) || null;
  const t0 = performance.now();
  const rec = { trial_no: S.pos, part: step.part, practice: step.practice, item_id: step.item_id, role: step.role, variant: step.variant,
                files: { left: step.left, right: step.right }, answers: {}, ratings: {}, check: null, video: {}, play_both: 0,
                watched_full: false, ms_to_unlock: null, ms_to_next: null, hidden_ms: 0, skipped_error: false, attention_pass: null,
                answer_events: [], playback: 'independent' };
  const checkStore = {};
  let hiddenAt = null;
  const onVis = () => { if (document.hidden) hiddenAt = performance.now(); else if (hiddenAt !== null) { rec.hidden_ms += Math.round(performance.now() - hiddenAt); hiddenAt = null; } };
  document.addEventListener('visibilitychange', onVis);

  const note = el('p', { class: 'note', 'aria-live': 'polite' }, CFG.design.require_full_view ? T('wait_for_end') : '');
  const nextBtn = el('button', { class: 'primary next', disabled: true }, T('next_button'));
  const skipBtn = el('button', { class: 'skip', hidden: true }, T('video_skip'));
  const maxW = wide && item ? item.width : null;
  const P = { left: makePlayer('left', step.left, !!part.audio, () => update(), maxW),
              right: makePlayer('right', step.right, !!part.audio, () => update(), maxW) };
  rec.video = { left: P.left.st, right: P.right.st };
  for (const s of ['left', 'right']) P[s].box.append(ownControls(P[s], item));
  const w = item && item.width;
  const panel = el('div', { class: 'panel', style: wide && w ? `max-width:${2 * w + 44}px` : null }, el('div', { class: 'pv-row' }, P.left.box, P.right.box));

  const onAnswer = (qid, a) => { if (qid) rec.answer_events.push({ q: qid, a, ms: Math.round(performance.now() - t0) }); update(); };
  const qGroups = part.questions.map(q => choiceGroup(q.id, q.text, q.hint, rec, rec.answers, onAnswer));
  let checkGroup = null;
  if (step.role === 'attention') {
    checkGroup = choiceGroup(CFG.attention.id, CFG.attention.text.replace('{answer}', ANSWER_LABEL(step.check_answer)), '', rec, checkStore, onAnswer, true);
  }
  const inOrder = !!CFG.design.reveal_questions_in_order;
  const seq = [...qGroups.map((g, j) => ({ g, done: () => !!rec.answers[part.questions[j].id] })),
               ...(checkGroup ? [{ g: checkGroup, done: () => !!checkStore[CFG.attention.id] }] : [])];

  function update() {
    const watched = P.left.st.watched && P.right.st.watched;
    const unlocked = watched || !CFG.design.require_full_view;
    if (watched && !rec.watched_full) { rec.watched_full = true; rec.ms_to_unlock = Math.round(performance.now() - t0); }
    let open = true;
    for (const { g, done } of seq) {
      g.box.hidden = !open;
      g.btns.forEach(b => { b.disabled = !unlocked || !open; });
      if (inOrder && !done()) open = false;
    }
    const answered = part.questions.every(q => rec.answers[q.id]) && (!checkGroup || checkStore[CFG.attention.id]);
    nextBtn.disabled = !(unlocked && answered);
    const msg = !unlocked ? T('wait_for_end') : (answered ? '' : T('answer_all'));
    note.textContent = msg; note.hidden = !msg;
    skipBtn.hidden = !(P.left.st.errors + P.right.st.errors >= 2 && !watched);
  }
  function leave() {
    document.removeEventListener('visibilitychange', onVis);
    for (const s of ['left', 'right']) { P[s].close(); P[s].video.pause(); P[s].video.removeAttribute('src'); P[s].video.load(); }
    rec.ms_to_next = Math.round(performance.now() - t0);
    S.responses.push(rec); S.pos++; save(); next();
  }
  nextBtn.addEventListener('click', () => {
    if (checkGroup) {
      rec.check = { id: CFG.attention.id, required: step.check_answer, answer: checkStore[CFG.attention.id] };
      rec.attention_pass = rec.check.answer === step.check_answer;
    }
    leave();
  });
  skipBtn.addEventListener('click', () => { rec.skipped_error = true; rec.answers = {}; rec.ratings = {}; leave(); });

  const narrow = wide && CFG.design.min_window_width && window.innerWidth && window.innerWidth < CFG.design.min_window_width;
  screen(
    el('div', { class: 'stage' },
      narrow ? el('p', { class: 'warn' }, T('narrow_window')) : '',
      el('p', { class: 'kicker' }, kicker(step)),
      el('h2', { class: 'screen-title' }, T('screen_title')),
      panel,
      wide ? creditLine(part.credit || CFG.credit) : '',
      el('div', { class: 'qwrap' }, note, ...qGroups.map(g => g.box), checkGroup ? checkGroup.box : '', skipBtn, nextBtn,
        testTools() ? testSkipButton(rec, leave) : ''))
  );
  if (wide && app.classList) app.classList.add('wide');
  rec.layout = narrowOn() ? 'narrow' : 'wide';
  rec.window = `${window.innerWidth || 0}x${window.innerHeight || 0}`;
  if (rec.layout === 'narrow') {
    const SIDEW = { left: (CFG.texts && CFG.texts.top) || 'Top', tie: T('tie'), right: (CFG.texts && CFG.texts.bottom) || 'Bottom' };
    panel.setAttribute('style', 'max-width:100%');
    panel.children[0].setAttribute('style', 'grid-template-columns:1fr');
    for (const s of ['left', 'right']) {
      P[s].box.children[1].textContent = SIDEW[s];
      P[s].video.setAttribute('aria-label', SIDEW[s]);
      P[s].video.setAttribute('style', 'display:block;width:100%;height:auto;max-height:38vh;object-fit:contain;background:#000;border-radius:4px');
    }
    const OPTSW = CFG.design.tie_option ? ['left', 'tie', 'right'] : ['left', 'right'];
    for (const g of [...qGroups, ...(checkGroup ? [checkGroup] : [])]) g.btns.forEach((x, k) => { x.textContent = SIDEW[OPTSW[k]]; });
    if (checkGroup) checkGroup.box.children[0].textContent = CFG.attention.text.replace('{answer}', SIDEW[step.check_answer]);
  }
  update();
  preloadNext();
}

function speakerLayoutOn(step) {
  const item = INDEX.items.find(it => it.id === step.item_id);
  const sd = item && item.sides && item.sides[step.variant];
  if (!sd || !sd.speaker) return false;
  const d = CFG.design.speaker_layout, p = CFG.parts[step.part] || {};
  return p.speaker_layout === true || d === true || (Array.isArray(d) && d.includes(step.part)) || (!!d && typeof d === 'object' && d[step.part] === true);
}
function trialSpeaker(step) {
  const part = CFG.parts[step.part];
  const wide = !!part.sync_pair;
  const item = INDEX.items.find(it => it.id === step.item_id) || null;
  const spkFile = item.sides[step.variant].speaker;
  const txt = (k, d) => (CFG.texts && CFG.texts[k]) || d;
  const SIDE = { left: txt('top', 'Top'), tie: T('tie'), right: txt('bottom', 'Bottom') };
  const t0 = performance.now();
  const rec = { trial_no: S.pos, part: step.part, practice: step.practice, item_id: step.item_id, role: step.role, variant: step.variant,
                files: { left: step.left, right: step.right }, answers: {}, ratings: {}, check: null, video: {}, play_both: 0,
                watched_full: false, ms_to_unlock: null, ms_to_next: null, hidden_ms: 0, skipped_error: false, attention_pass: null,
                answer_events: [], playback: 'speaker_layout', speaker_layout: true,
                speaker: { file: spkFile, plays: 0, pauses: 0, resyncs: 0, errors: 0, events: [], events_dropped: 0 } };
  const checkStore = {};
  let hiddenAt = null;
  const onVis = () => { if (document.hidden) hiddenAt = performance.now(); else if (hiddenAt !== null) { rec.hidden_ms += Math.round(performance.now() - hiddenAt); hiddenAt = null; } };
  document.addEventListener('visibilitychange', onVis);
  const note = el('p', { class: 'note', 'aria-live': 'polite' }, CFG.design.require_full_view ? T('wait_for_end') : '');
  const nextBtn = el('button', { class: 'primary next', disabled: true }, T('next_button'));
  const skipBtn = el('button', { class: 'skip', hidden: true }, T('video_skip'));
  const P = { left: makePlayer('left', step.left, false, () => update(), null), right: makePlayer('right', step.right, false, () => update(), null) };
  rec.video = { left: P.left.st, right: P.right.st };
  const label = t => el('p', { class: 'kicker', style: 'margin:0 0 4px' }, t);
  const LBL = { left: txt('reactor_top_label', 'Reactor (top)'), right: txt('reactor_bottom_label', 'Reactor (bottom)') };
  const spk = el('video', { src: spkFile, preload: 'auto', playsinline: true, disablepictureinpicture: true, 'aria-label': txt('speaker_label', 'Speaker'),
                            style: 'display:block;width:auto;max-width:100%;height:min(calc(64vh + 72px),480px);background:#000;border-radius:4px' });
  spk.addEventListener('contextmenu', e => e.preventDefault());
  spk.addEventListener('ratechange', () => { if (spk.playbackRate !== 1) spk.playbackRate = 1; });
  spk.addEventListener('error', () => { rec.speaker.errors++; });
  const sp = rec.speaker;
  const slog = (kind, extra) => {
    if (sp.events.length >= 100) { sp.events_dropped++; return; }
    sp.events.push(Object.assign({ kind, ms: Math.round(performance.now() - t0), t: Math.round(1000 * (+spk.currentTime || 0)) / 1000 }, extra || {}));
  };
  let active = null;
  const other = s => (s === 'left' ? 'right' : 'left');
  function follow(s) {
    const v = P[s].video, o = P[other(s)].video;
    if (!o.paused) o.pause();
    active = s;
    if (Math.abs((+spk.currentTime || 0) - (+v.currentTime || 0)) > 0.001) spk.currentTime = v.currentTime;
    if (spk.paused) {
      sp.plays++; slog('play', { with: s });
      const pr = spk.play(); if (pr && pr.catch) pr.catch(() => slog('play_blocked', { with: s }));
    }
  }
  function stopSpeaker(s, why) { if (active === s && !spk.paused) { spk.pause(); sp.pauses++; slog(why, { with: s }); } if (spk.playbackRate !== 1) spk.playbackRate = 1; }
  const figs = {};
  for (const s of ['left', 'right']) {
    const p = P[s], v = p.video;
    v.muted = true; v.setAttribute('aria-label', LBL[s]);
    v.style.cssText = 'display:block;width:auto;max-width:100%;height:min(32vh,320px);background:#000;border-radius:4px';
    const bar = ownControls(p, item);
    const afterClick = () => { if (!v.paused) follow(s); else stopSpeaker(s, 'pause'); };
    bar.children[0].addEventListener('click', afterClick);
    v.addEventListener('click', afterClick);
    bar.children[1].addEventListener('click', () => { if (active === s) { spk.currentTime = v.currentTime; slog('rewind', { with: s }); } });
    v.addEventListener('play', () => follow(s));
    v.addEventListener('pause', () => stopSpeaker(s, 'pause'));
    v.addEventListener('ended', () => stopSpeaker(s, 'ended'));
    v.addEventListener('seeked', () => { if (active === s) spk.currentTime = v.currentTime; });
    v.addEventListener('timeupdate', () => {
      if (active !== s || v.paused) return;
      if (spk.playbackRate !== 1) spk.playbackRate = 1;
    });
    figs[s] = el('figure', { class: 'pv', style: 'margin:0' }, label(LBL[s]), v, bar, p.errBox);
  }
  const w = item && item.width;
  const panel = el('div', { class: 'panel', style: 'max-width:' + (w ? (item.speaker_width || w) + w + 80 : 900) + 'px' },
    el('div', { class: 'spk-row', style: 'display:flex;flex-wrap:wrap;gap:16px;justify-content:center;align-items:center' },
      el('figure', { class: 'pv spk', style: 'margin:0' }, label(txt('speaker_label', 'Speaker')), spk),
      el('div', { class: 'reactors', style: 'display:flex;flex-direction:column;gap:12px' }, figs.left, figs.right)));

  const onAnswer = (qid, a) => { if (qid) rec.answer_events.push({ q: qid, a, ms: Math.round(performance.now() - t0) }); update(); };
  const OPTS = CFG.design.tie_option ? ['left', 'tie', 'right'] : ['left', 'right'];
  const relabel = g => { g.btns.forEach((x, k) => { x.textContent = SIDE[OPTS[k]]; }); return g; };
  const qGroups = part.questions.map(q => relabel(choiceGroup(q.id, q.text, q.hint, rec, rec.answers, onAnswer)));
  let checkGroup = null;
  if (step.role === 'attention') {
    checkGroup = relabel(choiceGroup(CFG.attention.id, CFG.attention.text.replace('{answer}', SIDE[step.check_answer]), '', rec, checkStore, onAnswer, true));
  }
  const inOrder = !!CFG.design.reveal_questions_in_order;
  const seq = [...qGroups.map((g, j) => ({ g, done: () => !!rec.answers[part.questions[j].id] })),
               ...(checkGroup ? [{ g: checkGroup, done: () => !!checkStore[CFG.attention.id] }] : [])];
  function update() {
    const watched = P.left.st.watched && P.right.st.watched;
    const unlocked = watched || !CFG.design.require_full_view;
    if (watched && !rec.watched_full) { rec.watched_full = true; rec.ms_to_unlock = Math.round(performance.now() - t0); }
    let open = true;
    for (const { g, done } of seq) {
      g.box.hidden = !open;
      g.btns.forEach(b => { b.disabled = !unlocked || !open; });
      if (inOrder && !done()) open = false;
    }
    const answered = part.questions.every(q => rec.answers[q.id]) && (!checkGroup || checkStore[CFG.attention.id]);
    nextBtn.disabled = !(unlocked && answered);
    const msg = !unlocked ? T('wait_for_end') : (answered ? '' : T('answer_all'));
    note.textContent = msg; note.hidden = !msg;
    skipBtn.hidden = !(P.left.st.errors + P.right.st.errors >= 2 && !watched);
  }
  function leave() {
    document.removeEventListener('visibilitychange', onVis);
    active = null;
    for (const s of ['left', 'right']) { P[s].close(); P[s].video.pause(); P[s].video.removeAttribute('src'); P[s].video.load(); }
    spk.pause(); spk.removeAttribute('src'); spk.load();
    rec.ms_to_next = Math.round(performance.now() - t0);
    S.responses.push(rec); S.pos++; save(); next();
  }
  nextBtn.addEventListener('click', () => {
    if (checkGroup) {
      rec.check = { id: CFG.attention.id, required: step.check_answer, answer: checkStore[CFG.attention.id] };
      rec.attention_pass = rec.check.answer === step.check_answer;
    }
    leave();
  });
  skipBtn.addEventListener('click', () => { rec.skipped_error = true; rec.answers = {}; rec.ratings = {}; leave(); });
  const narrow = wide && CFG.design.min_window_width && window.innerWidth && window.innerWidth < CFG.design.min_window_width;
  screen(
    el('div', { class: 'stage' },
      narrow ? el('p', { class: 'warn' }, T('narrow_window')) : '',
      el('p', { class: 'kicker' }, kicker(step)),
      el('h2', { class: 'screen-title' }, T('screen_title')),
      panel,
      wide ? creditLine(part.credit || CFG.credit) : '',
      el('div', { class: 'qwrap' }, note, ...qGroups.map(g => g.box), checkGroup ? checkGroup.box : '', skipBtn, nextBtn,
        testTools() ? testSkipButton(rec, leave) : ''))
  );
  if (wide && app.classList) app.classList.add('wide');
  rec.layout = narrowOn() ? 'narrow' : 'wide';
  rec.window = `${window.innerWidth || 0}x${window.innerHeight || 0}`;
  if (rec.layout === 'narrow') {
    panel.setAttribute('style', 'max-width:100%');
    panel.children[0].setAttribute('style', 'display:flex;flex-direction:column;gap:10px;align-items:stretch');
    panel.children[0].children[1].setAttribute('style', 'display:flex;flex-direction:column;gap:10px');
    for (const v of [spk, P.left.video, P.right.video]) v.setAttribute('style', 'display:block;width:100%;height:27vh;object-fit:contain;background:transparent;border-radius:4px');
  }
  update();
  preloadNext();
  const nx = S.plan.slice(S.pos + 1).find(p => p.kind === 'trial');
  const nxi = nx && INDEX.items.find(it => it.id === nx.item_id);
  const nsp = nxi && nxi.sides && nxi.sides[nx.variant] && nxi.sides[nx.variant].speaker;
  if (nsp && nsp !== spkFile) { const v = document.createElement('video'); v.preload = 'auto'; v.muted = true; v.src = nsp; }
}

function preloadNext() {
  const nx = S.plan.slice(S.pos + 1).find(p => p.kind === 'trial');
  if (!nx) return;
  for (const f of new Set([nx.left, nx.right])) { const v = document.createElement('video'); v.preload = 'auto'; v.muted = true; v.src = f; }
}

function next() {
  setProgress();
  if (S.pos >= S.plan.length) return finish();
  if (CFG.design.sound_check && INDEX.sound_check && !S.sound_check && !PREVIEW) return soundCheck();
  const sb = CFG.design.sound_check_before_part, st0 = S.plan[S.pos];
  if (sb && INDEX.sound_check && !S.sound_check && !PREVIEW && st0 && st0.kind === 'part' && st0.part === sb) return soundCheck();
  const step = S.plan[S.pos];
  if (step.kind === 'part') {
    const prev = S.plan[S.pos - 1];
    return partIntro(step.part, prev && prev.practice);
  }
  trial(step);
}

function toCSV() {
  const head = ['code', 'session_id', 'study_version', 'manifest_sha256', 'trial_no', 'part', 'practice', 'item_id', 'role', 'variant',
                'file_left', 'file_right', 'kind', 'question', 'answer', 'required_answer', 'plays_left', 'plays_right', 'watched_full',
                'ms_to_unlock', 'ms_to_next', 'skipped_error'];
  const rows = [head.join(',')];
  const esc = v => (v === null || v === undefined) ? '' : String(v).replace(/[",\n\r]/g, ' ');
  for (const r of S.responses) {
    const base = [S.code, S.session_id, S.study_version, S.manifest_sha256, r.trial_no, r.part, r.practice, r.item_id, r.role, r.variant, r.files.left, r.files.right];
    const tail = [r.video.left ? r.video.left.plays : '', r.video.right ? r.video.right.plays : '', r.watched_full, r.ms_to_unlock, r.ms_to_next, r.skipped_error];
    for (const [q, a] of Object.entries(r.answers)) rows.push([...base, 'choice', q, a, '', ...tail].map(esc).join(','));
    if (r.check) rows.push([...base, 'attention_check', r.check.id, r.check.answer, r.check.required, ...tail].map(esc).join(','));
    for (const [side, v] of Object.entries(r.ratings)) rows.push([...base, 'rating', 'rating_' + side, v, '', ...tail].map(esc).join(','));
  }
  return rows.join('\n') + '\n';
}
function download(name, text, type) {
  const a = el('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a); a.click(); a.remove();
}
function finish() {
  if (!S.finished_at) {
    S.finished_at = new Date().toISOString();
    const ch = S.responses.filter(r => r.role === 'attention');
    S.attention_summary = { n: ch.length, passed: ch.filter(r => r.attention_pass).length };
    save(); archive();
  }
  setProgress();
  const status = el('p', { 'aria-live': 'polite' }, '');
  const base = `reaction_study_${S.code}`;
  screen(
    el('div', { class: 'card' }, el('h1', { class: 'study-title' }, T('thanks_title')), T('thanks') ? el('p', {}, T('thanks')) : '', status,
      CFG.design.show_code === false ? '' : el('p', { class: 'muted' }, T('code_label')), CFG.design.show_code === false ? '' : el('p', { class: 'code' }, S.code),
      T('thanks_download') ? el('p', {}, T('thanks_download')) : '',
      el('div', { class: 'row' },
        el('button', { onclick: () => download(base + '.json', JSON.stringify(S, null, 1), 'application/json') }, T('download_json')),
        T('download_csv') ? el('button', { onclick: () => download(base + '.csv', toCSV(), 'text/csv') }, T('download_csv')) : ''),
      CFG.design.about_link === false ? '' : el('p', {}, el('a', { href: CFG.about_page || 'about.html' }, T('about_link'))))
  );
  const SUB = CFG.submit || {};
  const ep = SUB.endpoint || '';
  let url = ep === 'local' ? 'submit' : ep;
  if (ep === 'local' && SUB.local_hosts_only && !['127.0.0.1', 'localhost'].includes(location.hostname)) url = '';
  const autoDownload = () => {
    if (!SUB.download_on_failure || S.auto_downloaded) return;
    S.auto_downloaded = new Date().toISOString(); save();
    download(base + '.json', JSON.stringify(S, null, 1), 'application/json');
  };
  if (!url) { status.textContent = SUB.download_on_failure ? T('no_upload_download').replace('{file}', base + '.json') : T('no_upload'); autoDownload(); return; }
  if (S.uploaded) { status.textContent = T('uploaded_ok'); return; }
  status.textContent = T('uploading');
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(S) })
    .then(r => { if (!r.ok && r.type !== 'opaque') throw new Error(r.status); S.uploaded = true; save(); status.textContent = T('uploaded_ok'); })
    .catch(() => { status.textContent = T('upload_failed').replace('{file}', base + '.json'); autoDownload(); });
}

async function main() {
  try {
    CFG = await (await fetch(CONFIG_URL, { cache: 'no-store' })).json();
    INDEX = await (await fetch(CFG.stimuli_index, { cache: 'no-store' })).json();
  } catch (e) {
    app.replaceChildren(el('p', { class: 'warn' }, 'Could not load ' + CONFIG_URL + ' / the stimulus index. Open the page through a web server (python3 scripts/local_server.py), not as a file.'));
    return;
  }
  if (CFG.store_key) STORE_KEY = CFG.store_key;
  try { MANIFEST = await (await fetch(CFG.manifest, { cache: 'no-store' })).json(); } catch (e) { MANIFEST = null; }
  document.title = CFG.title;
  const prm = new URLSearchParams(location.search);
  if (prm.has('preview') && ['127.0.0.1', 'localhost'].includes(location.hostname)) {
    PREVIEW = true;
    const code = prm.get('code') || 'PREVIEW-TEST';
    S = { study_version: CFG.study_version, manifest_sha256: MANIFEST ? MANIFEST.instrument_sha256 : null, code, session_id: 'PREVIEW', preview: true,
          started_at: new Date().toISOString(), finished_at: null, consent: null, device: {}, design: CFG.design, pos: 0, plan: null, responses: [] };
    S.plan = buildPlan(code); S.pos = Math.min(Math.max(0, parseInt(prm.get('preview'), 10) || 0), S.plan.length - 1);
    return next();
  }
  const old = load();
  const sameInstrument = old && old.study_version === CFG.study_version && old.manifest_sha256 === (MANIFEST ? MANIFEST.instrument_sha256 : null);
  if (old && old.plan && !old.finished_at && sameInstrument) {
    screen(el('div', { class: 'card' }, el('p', {}, T('resume')),
      el('div', { class: 'row' },
        el('button', { class: 'primary', onclick: () => { S = old; next(); } }, T('resume_yes')),
        el('button', { onclick: () => { try { localStorage.removeItem(STORE_KEY); } catch (e) { } welcome(); } }, T('resume_no')))));
    return;
  }
  welcome();
}
main();
