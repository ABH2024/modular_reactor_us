/* user_study_site/app.js - the study page of every part (v3 of 2026-11-12). Plain JavaScript, no framework, no external file.
   index.html loads it with config.json (Part A); index_partBC.html loads it with data-config="config_partBC.json" (Parts B/C).
   Previous version (v1 2026-10-30 + the switches of 2026-11-09): app_old_2026-11-12.js. The plan (buildPlan, assignmentOf), the slots
   and the answers format are unchanged (analysis/study_plan.py and analysis/study_plan_partBC.py mirror them); new answer keys only
   ADD information (rec.sync, sound_check, auto_downloaded, device.window).
   2026-11-12 (user decisions):
   - one layout for every part (sober, light): a thin progress bar on top; a small-caps label (PART A - COMPARISON k OF n, or
     PRACTICE); a title line; ONE framed panel with the two videos side by side (small Left / Right captions), one round play button
     over the panel and ONE control bar below it (play / pause, progress, time, sound button when the part has sound); native controls
     hidden, no seeking, replay allowed; one card per question (keyword in bold with **...** in the config, one-line hint, three equal
     buttons Left / No clear difference / Right; the chosen one turns dark); the attention line as a third small card; a full-width
     Next button. The questions are shown from the start (design.reveal_questions_in_order false) and unlock once both videos played
     to the end (each video reached its end with >= 90 % of its 0.1-s bins played, as before); until then one grey note.
   - the panel plays both videos TOGETHER: the LEFT video is the clock (and carries the sound when the part has sound), the RIGHT one
     is muted and follows it: more than 40 ms off -> playbackRate 0.97 (ahead) / 1.03 (behind) until back within 15 ms; beyond 250 ms ->
     re-seeked to the left time. Play is enabled when both videos can play through (or both can play after 10 s). A 'waiting' event on
     either video pauses both ('Loading...'); both resume together from the left time when both can play. Starts, pauses, corrections,
     re-seeks, stalls and sound toggles are logged in the screen's answers (rec.sync).
   - parts.<P>.sync_pair (conversation parts): the page uses the full window width on comparison screens and each video is shown at
     most at its native size (max-width from the stimulus index); the question cards stay in the central column; credit / parts.<P>.credit:
     a licence credit line under the panel
   - config file from the data-config attribute of the script tag (default config.json); store_key: own localStorage key;
     design.code_prefix {server, random}: participant code prefixes (default P / R); design.sound_check: a sound check screen first
   - submit.local_hosts_only: with endpoint 'local', POST only when served from 127.0.0.1 / localhost (nothing is sent to a static host);
     submit.download_on_failure: when no upload happens or it fails, the JSON download starts by itself (once)
   - about_page: the link on the last screen (default about.html); texts.welcome may be a list (one paragraph each); an EMPTY text hides
     its line (welcome_title, consent_placeholder_banner, practice_intro, practice_done, sound_help, thanks, thanks_download,
     download_csv, progress); an empty texts.how list hides the 'How it works' card
   2026-11-12 (later; the combined page index_all.html + config_all.json: one rater does part A, then B, then C, one submission at the
   end). Two new switches, absent from the older configs (whose behaviour is unchanged; copy before this edit: app_old2_2026-11-12.js):
   - design.slot_groups [{parts, sets}]: per-part counterbalancing. The code carries ONE slot s; each group of parts uses its own slot
     s mod (2 x the number of rotations of its rotation sets) with the rule below (rotation, offsets, side flip), so each part is balanced
     exactly as on its own page; without a server the random slot is drawn in 0 .. (least common multiple of the group cycles) - 1.
     Mirrored in analysis/study_plan_all.py.
   - design.sound_check_before_part (a part letter): the sound check is shown once, just before that part's introduction.
   2026-11-13 (user; copy before this edit: app_old3_2026-11-13.js). Two more additions, the older behaviour unchanged without them:
   - design.independent_videos (default false): each video of a pair has its OWN control bar under it (play / pause, back to the start,
     progress, time; a click on the video plays / pauses it) and, in the parts with sound, its own sound; no shared bar, no round play
     button, no synchronised playback (no rec.sync). The answers still unlock once EACH video was played to the end at least once. Per
     video, the answers keep plays, pauses, ended, coverage and now rewinds + a short event list (play / pause / rewind / ended).
   - a test-only button 'Skip (test only)' under Next, shown only when the page is served from 127.0.0.1 / localhost or opened with
     ?test=1 (?test=0 hides it on a local server): it leaves the screen without answers and marks the session test_mode: true (the
     analyses quarantine every test session).
   2026-11-13, later (user "go, keep speaker"; copy before this edit: app_old4_2026-11-13.js): the SPEAKER LAYOUT, per part
   (parts.<P>.speaker_layout, or design.speaker_layout true / [parts] / {part: true}), used only when the stimulus index gives a speaker
   file (sides.<v>.speaker): the partner video ONCE on the left ('Speaker', the only sound), the two compared reactions stacked on the
   right ('Reactor (top)' = the stored side 'left', 'Reactor (bottom)' = 'right'), each with its own control bar; playing a reactor plays
   the speaker with it (speaker time = reactor time on play, reset when more than 80 ms off, no rate nudging) and pauses the other reactor;
   pausing / rewinding a reactor pauses / rewinds the speaker; answer buttons Top / No clear difference / Bottom, stored as left / tie /
   right as before; the answers unlock once BOTH reactors were played to the end; rec.speaker_layout true + rec.speaker (file, plays,
   pauses, resyncs, events).
   Reads the config (design + all wording), the stimulus index (neutral stimulus ids) and the manifest (sha256 of the instrument files;
   its hash is stored in every answer file). The method shown on each side is NOT known to this page (the key is kept outside the
   published files, for the analysis only). */
'use strict';

const SCRIPT_TAG = (typeof document !== 'undefined' && document.currentScript) || null;
const CONFIG_URL = (SCRIPT_TAG && SCRIPT_TAG.getAttribute && SCRIPT_TAG.getAttribute('data-config')) || 'config.json';
let STORE_KEY = 'reaction_study_state_v1';                   // CFG.store_key replaces it once the config is loaded
let CFG = null, INDEX = null, MANIFEST = null, S = null;   // config, stimulus index, manifest, participant state
const app = document.getElementById('app');

/* ---------------- seeded random numbers (same code -> same plan) ---------------- */
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

/* ---------------- storage (never required: wrapped in try/catch) ---------------- */
let PREVIEW = false;   // ?preview=<plan step> on 127.0.0.1 / localhost only: shows one screen of a test plan, saves nothing (layout checks)
function save() { if (PREVIEW) return; try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* storage blocked: fine */ } }
function load() { try { const t = localStorage.getItem(STORE_KEY); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
function archive() {   // keeps finished answers in a list, so a later participant on the same browser does not erase them
  try { const k = STORE_KEY + '_done'; const L = JSON.parse(localStorage.getItem(k) || '[]'); L.push(S); localStorage.setItem(k, JSON.stringify(L)); } catch (e) { }
}

/* ---------------- helpers ---------------- */
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
const rich = s => String(s).split(/\*\*(.+?)\*\*/).map((x, i) => (i % 2 ? el('strong', {}, x) : x));   // **keyword** -> bold
const plain = s => String(s).replace(/\*\*(.+?)\*\*/g, '$1');
const ICON = {   // constant inline icons (no external file)
  play: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>',
  replay: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z" fill="currentColor"/></svg>',
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9zM16 8.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="1.8"/></svg>'
};
ICON.rewind = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6h2v12H6zM9.5 12l8.5 6V6z" fill="currentColor"/></svg>';   // 2026-11-13
function icon(e, name) { e.innerHTML = ICON[name]; }
function screen(...kids) { if (app.classList) app.classList.remove('wide'); app.replaceChildren(...kids); window.scrollTo(0, 0); }
function setProgress() {
  const bar = document.getElementById('topbar');
  if (!S || !S.plan) { bar.hidden = true; return; }
  const n = S.plan.length, i = Math.min(S.pos + 1, n);
  bar.hidden = false;
  document.getElementById('progress-text').textContent = T('progress') ? T('progress').replace('{i}', i).replace('{n}', n) : '';
  document.getElementById('progress-fill').style.width = (100 * S.pos / n).toFixed(1) + '%';
}
function browserName() {   // only the browser NAME (the consent names it); the full user-agent string is not stored
  const u = navigator.userAgent;
  if (/Edg\//.test(u)) return 'Edge'; if (/OPR\//.test(u)) return 'Opera'; if (/Firefox\//.test(u)) return 'Firefox';
  if (/Chrome\//.test(u) || /Chromium\//.test(u)) return 'Chrome'; if (/Safari\//.test(u)) return 'Safari'; return 'Other';
}
const ANSWER_LABEL = a => T(a);   // 'left' | 'right' | 'tie' -> the button text
function creditLine(c) {          // licence credit of the partner videos (names the source of the videos, nothing else)
  if (!c || !c.text) return '';
  return el('p', { class: 'credit' }, c.text + ' ', c.url ? el('a', { href: c.url, target: '_blank', rel: 'noopener noreferrer' }, c.link_text || c.url) : '',
            c.after || '');
}
const mmss = s => { s = Math.max(0, Math.floor(+s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

/* ---------------- counterbalanced assignment (2026-11-09; mirrored in analysis/study_plan.py / study_plan_partBC.py) ----------------
   slot s from the code (P<s>-XXXX-XXXX, or R<s>-... for a random slot; with design.code_prefix: <server><s>- / <random><s>-;
   a code without a number: s = cyrb53(code) mod 2n); n = product of the comparisons per rotation set: rotation r = s mod n, offset of
   each set in mixed radix (sets sorted); sides: flip = (s mod 2) XOR (floor(s / n) mod 2); study screen of rank k: variant 1 when
   (k + flip) is even. */
function prefixes() {
  const cp = (CFG && CFG.design && CFG.design.code_prefix) || null;
  if (cp && /^[A-Z]{1,4}$/.test(cp.server || '') && /^[A-Z]{1,4}$/.test(cp.random || '') && cp.server !== cp.random)
    return { server: cp.server, random: cp.random, re: new RegExp('^(?:' + cp.server + '|' + cp.random + ')([0-9]{1,7})-') };
  return { server: 'P', random: 'R', re: /^[PR]([0-9]{1,7})-/ };
}
function nRotations() { const per = INDEX.slots_per_set || {}; return Object.keys(per).sort().reduce((a, s) => a * per[s], 1); }
function assignmentOf(code) {
  if (slotGroups()) return assignmentOfGroups(code);   // 2026-11-12: per-part counterbalancing (combined page)
  const per = INDEX.slots_per_set || {}, sets = Object.keys(per).sort(), n = nRotations();
  const m = prefixes().re.exec(code);
  const slot = m ? parseInt(m[1], 10) : cyrb53(code) % (2 * n);
  const rotation = slot % n, offsets = {};
  let radix = 1;
  for (const s of sets) { offsets[s] = Math.floor(rotation / radix) % per[s]; radix *= per[s]; }
  return { slot, slot_in_code: !!m, rotation, n_rotations: n, offsets, side_flip: (slot % 2) ^ (Math.floor(slot / n) % 2) };
}
/* per-part counterbalancing (design.slot_groups, 2026-11-12; mirrored in analysis/study_plan_all.py): group g = {parts, sets};
   n_g = product of the comparisons of its sets; its slot = s mod 2 n_g; rotation, offsets and side flip of that slot as above */
function slotGroups() {
  const G = CFG && CFG.design && CFG.design.assignment === 'counterbalanced' ? CFG.design.slot_groups : null;
  return Array.isArray(G) && G.length ? G : null;
}
function groupRotations(g) { return g.sets.reduce((a, s) => a * ((INDEX.slots_per_set || {})[s] || 1), 1); }
function slotPeriod() {   // least common multiple of the group cycles (2 n_g): the range of a random slot and of a code-hash slot
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
async function newCode(slotParam) {   // counterbalanced only: a new participant code that carries its slot
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
    } catch (e) { /* no slot server (static hosting, timeout): random slot below */ }
  }
  const b = new Uint32Array(1); (window.crypto || window.msCrypto).getRandomValues(b);
  if (slotGroups()) return { code: randomId(`${PF.random}${b[0] % slotPeriod()}-`, 8), source: 'random' };   // 2026-11-12
  return { code: randomId(`${PF.random}${b[0] % (2 * nRotations())}-`, 8), source: 'random' };
}

/* ---------------- the plan of one participant (mirrored in analysis/study_plan.py; unchanged) ---------------- */
function buildPlan(code) {
  if (slotGroups()) return buildPlanGroups(code);   // 2026-11-12: combined page (side pattern per slot group)
  const D = CFG.design, rng = mulberry32(cyrb53(code));
  const A = D.assignment === 'counterbalanced' ? assignmentOf(code) : null;   // 2026-11-09; null = v1 (random rotation and sides)
  const fixedVariant = {};                                                      // counterbalanced: item id -> variant of the side pattern
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
  // left / right: the variant (1 or 2) of each trial; both variants hold the same pair with the sides swapped
  for (const p of plan) if (p.kind === 'trial') p.variant = !D.randomise_left_right ? '1'
    : (A ? (fixedVariant[p.item.id] || (A.side_flip ? '2' : '1')) : (rng() < 0.5 ? '1' : '2'));
  // attention checks: the answer the extra line asks for
  const AA = CFG.attention.answers;
  for (const p of plan) if (p.kind === 'trial' && p.item.role === 'attention') p.check_answer = AA[Math.floor(rng() * AA.length)];
  return plan.map(p => p.kind === 'part' ? { kind: 'part', part: p.part } : {
    kind: 'trial', part: p.part, practice: !!p.practice, item_id: p.item.id, role: p.item.role, variant: p.variant,
    left: p.item.sides[p.variant].left, right: p.item.sides[p.variant].right, check_answer: p.check_answer || null
  });
}

/* the plan with design.slot_groups (2026-11-12, combined page; mirrored in analysis/study_plan_all.py): buildPlan's steps with the
   offsets and the side flip of each part's slot group (needs unique item ids in the index) */
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

/* ---------------- screens ---------------- */
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
  const hasPractice = (!S.plan || S.plan.some(p => p.practice)) && !!T('practice_intro');   // an empty practice_intro hides the card
  screen(
    CFG.design.show_code === false ? '' : el('div', { class: 'card' }, el('p', {}, T('code_label')), el('p', { class: 'code' }, S.code)),   // 2026-11-13: design.show_code false hides the code
    T('how').length ? el('div', { class: 'card' }, el('h2', {}, T('how_title')), el('ul', { class: 'how' }, T('how').map(t => el('li', {}, t)))) : '',
    hasPractice ? el('div', { class: 'card' }, el('h2', {}, T('practice_title')), el('p', {}, T('practice_intro'))) : '',
    el('div', { class: 'row center' }, el('button', { class: 'primary wide-btn', onclick: next }, T('part_button')))
  );
}

/* sound check (design.sound_check): the test sound must play to the end once before 'I can hear it' unlocks */
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

/* 2026-11-13: the test-only Skip button (127.0.0.1 / localhost, or ?test=1 on any host; ?test=0 hides it) */
function testTools() {
  try {
    const q = new URLSearchParams(location.search).get('test');
    if (q === '0') return false;
    return q === '1' || ['127.0.0.1', 'localhost'].includes(location.hostname);
  } catch (e) { return false; }
}
function testSkipButton(rec, leave) {   // leaves the screen without answers; the session is marked test_mode (quarantined by the analyses)
  const b = el('button', { class: 'skip-test', type: 'button',
                           style: 'display:block;margin:10px auto 0;padding:4px 12px;font-size:0.8rem;color:#8a8783;background:none;border:1px dashed #cfcac3' },
               (CFG.texts && CFG.texts.test_skip) || 'Skip (test only)');
  b.addEventListener('click', () => {
    S.test_mode = true; S.test_skips = (S.test_skips || 0) + 1;
    rec.test_skipped = true; rec.answers = {}; rec.ratings = {}; leave();
  });
  return b;
}

/* 2026-11-13 (design.independent_videos): the control bar of ONE video (play / pause, back to the start, progress, time); a click on the
   video plays / pauses it; no seeking. Logs rewinds and play / pause / rewind / ended events in that video's record. */
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

/* one video of the panel: no native controls; its own 'watched' tracking (end reached + >= 90 % of 0.1-s bins actually played) */
function makePlayer(side, src, audio, onChange, maxWidth) {
  const st = { side, file: src, plays: 0, pauses: 0, seeks: 0, ended: 0, errors: 0, coverage: 0, watched: false, ms_to_watched: null };
  const t0 = performance.now();
  const ctl = { rate: 1 };          // the only playback rate allowed (1 unless the sync logic nudges this video)
  const video = el('video', { src, preload: 'auto', playsinline: true, disablepictureinpicture: true, muted: audio ? null : true,
                              style: maxWidth ? `max-width:${maxWidth}px` : null,
                              'aria-label': side === 'left' ? T('left_video') : T('right_video') });
  if (!audio) video.muted = true;   // no sound track (Part A) or the right video (the sound comes from the left one)
  const errBox = el('div', { class: 'verror', hidden: true });
  let bins = null, last = null, closed = false;   // closed: the screen was left (events of the unloaded player are ignored)
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
    if (!video.paused && last !== null && t > last && t - last < 0.75) mark(last, t);   // jumps (seeking) are not counted as watched
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

/* the panel: two videos played TOGETHER from one control bar; the LEFT one is the clock (and the sound), the RIGHT one follows it */
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
  function blocked() {      // play() refused (autoplay rules): both stay paused, the participant resumes with a click
    sy.play_blocked++; log('play_blocked');
    both(v => v.pause()); R.setRate(1); nudge = 0; state = 'paused'; note.hidden = false; note.textContent = T('sync_play_blocked'); render();
  }
  function playBoth() {     // both from the left position
    if (Math.abs(R.video.currentTime - L.video.currentTime) > 0.001) R.video.currentTime = L.video.currentTime;
    let failed = false;
    for (const v of [L.video, R.video]) {
      const p = v.play();
      if (p && p.catch) p.catch(() => { if (!failed && !closed) { failed = true; blocked(); } });
    }
  }
  function start() {        // both from the start (first play and replay)
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
  function check() {        // at every time update of either video
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

function ratingGroup(side, rec, update) {   // v1 configs only (design.ratings); not used since 2026-11-07
  const name = `rate_${side}_${S.pos}`;
  const inputs = [1, 2, 3, 4, 5].map(v => el('input', { type: 'radio', name, value: v, disabled: true, id: `${name}_${v}` }));
  inputs.forEach(inp => inp.addEventListener('change', () => { rec.ratings[side] = Number(inp.value); update(); }));
  const box = el('fieldset', { class: 'rating' }, el('legend', {}, side === 'left' ? T('left_video') : T('right_video')),
    el('div', { class: 'scale' }, inputs.map((inp, k) => el('label', { for: inp.id }, inp, el('span', {}, String(k + 1))))));
  return { box, inputs };
}

function kicker(step) {     // PART A - COMPARISON k OF n (study + attention screens of the part, practice not counted), or PRACTICE
  if (step.practice) return T('kicker_practice');
  const mine = S.plan.filter(p => p.kind === 'trial' && !p.practice && p.part === step.part);
  const k = 1 + mine.indexOf(S.plan[S.pos]);
  return T('kicker').replace('{part}', step.part).replace('{k}', k).replace('{n}', mine.length);
}

function trial(step) {
  if (speakerLayoutOn(step)) return trialSpeaker(step);   // 2026-11-13: speaker layout (parts B / C)
  if (CFG.design.independent_videos && !CFG.design.ratings) return trialIndependent(step);   // 2026-11-13: one control bar per video
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
  // questions in screen order (+ the attention line last); with design.reveal_questions_in_order a group is shown only when every
  // group above it has an answer (since 2026-11-12 false: all shown from the start, locked until both videos played to the end)
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
  if (testTools()) nextBtn.parentNode.append(testSkipButton(rec, leave));   // 2026-11-13: test only (127.0.0.1 / localhost / ?test=1)
  if (wide && app.classList) app.classList.add('wide');
  update();
  preloadNext();
}

/* 2026-11-13 (design.independent_videos): the comparison screen with two INDEPENDENT videos (copy of trial() without the shared panel):
   each video has its own control bar and, in the parts with sound, its own sound (both files of a pair carry the same sound); no
   synchronised playback, no rec.sync; the answers unlock once EACH video was played to the end at least once (makePlayer's rule). */
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
  update();
  preloadNext();
}

/* 2026-11-13: the SPEAKER LAYOUT (see the note at the top). On when the part asks for it and the index item has a speaker file. */
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
  const SIDE = { left: txt('top', 'Top'), tie: T('tie'), right: txt('bottom', 'Bottom') };   // stored values unchanged: left = top
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
  // the speaker: the partner video with the sound of both voices, no controls of its own; it follows the reactor that plays
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
  let active = null;                                     // the reactor ('left' = top, 'right' = bottom) the speaker follows
  const other = s => (s === 'left' ? 'right' : 'left');
  function follow(s) {                                   // play reactor s with the speaker; the other reactor pauses
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
    const afterClick = () => { if (!v.paused) follow(s); else stopSpeaker(s, 'pause'); };   // inside the click: allowed to start the sound
    bar.children[0].addEventListener('click', afterClick);
    v.addEventListener('click', afterClick);
    bar.children[1].addEventListener('click', () => { if (active === s) { spk.currentTime = v.currentTime; slog('rewind', { with: s }); } });
    v.addEventListener('play', () => follow(s));
    v.addEventListener('pause', () => stopSpeaker(s, 'pause'));
    v.addEventListener('ended', () => stopSpeaker(s, 'ended'));
    v.addEventListener('seeked', () => { if (active === s) spk.currentTime = v.currentTime; });
    v.addEventListener('timeupdate', () => {   // 2026-11-13 (user: sound cuts): no correction during playback; the speaker is aligned only at play, pause, rewind and seek
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
  const OPTS = CFG.design.tie_option ? ['left', 'tie', 'right'] : ['left', 'right'];   // the order of choiceGroup's buttons
  const relabel = g => { g.btns.forEach((x, k) => { x.textContent = SIDE[OPTS[k]]; }); return g; };   // Top / No clear difference / Bottom
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
  update();
  preloadNext();
  const nx = S.plan.slice(S.pos + 1).find(p => p.kind === 'trial');   // also warm the next speaker file
  const nxi = nx && INDEX.items.find(it => it.id === nx.item_id);
  const nsp = nxi && nxi.sides && nxi.sides[nx.variant] && nxi.sides[nx.variant].speaker;
  if (nsp && nsp !== spkFile) { const v = document.createElement('video'); v.preload = 'auto'; v.muted = true; v.src = nsp; }
}

function preloadNext() {   // warms the cache for the next screen's two videos
  const nx = S.plan.slice(S.pos + 1).find(p => p.kind === 'trial');
  if (!nx) return;
  for (const f of new Set([nx.left, nx.right])) { const v = document.createElement('video'); v.preload = 'auto'; v.muted = true; v.src = f; }
}

function next() {
  setProgress();
  if (S.pos >= S.plan.length) return finish();
  if (CFG.design.sound_check && INDEX.sound_check && !S.sound_check && !PREVIEW) return soundCheck();
  const sb = CFG.design.sound_check_before_part, st0 = S.plan[S.pos];   // 2026-11-12: the sound check just before that part (combined page)
  if (sb && INDEX.sound_check && !S.sound_check && !PREVIEW && st0 && st0.kind === 'part' && st0.part === sb) return soundCheck();
  const step = S.plan[S.pos];
  if (step.kind === 'part') {
    const prev = S.plan[S.pos - 1];
    return partIntro(step.part, prev && prev.practice);
  }
  trial(step);
}

/* ---------------- end: upload (optional) + download ---------------- */
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
      CFG.design.about_link === false ? '' : el('p', {}, el('a', { href: CFG.about_page || 'about.html' }, T('about_link'))))   // 2026-11-13: design.about_link false hides the link
  );
  const SUB = CFG.submit || {};
  const ep = SUB.endpoint || '';
  let url = ep === 'local' ? 'submit' : ep;
  if (ep === 'local' && SUB.local_hosts_only && !['127.0.0.1', 'localhost'].includes(location.hostname)) url = '';   // static host: send nothing
  const autoDownload = () => {   // submit.download_on_failure: the JSON file is downloaded once without a click
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

/* ---------------- start ---------------- */
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
