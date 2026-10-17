/*!
 * portfolio-character-guide.js  -  "Twin Heroes" edition
 *
 * Two original, inline-SVG heroes live in a corner dock, react to the mouse, and walk visitors
 * through your sections:
 *   - Nova   : red-and-gold armored hero. Glowing palm + boot thrusters, hover / takeoff / flyovers,
 *              repulsor blasts at whatever you click, and a targeting-scan on project cards.
 *   - Weaver : web-swinging hero. Swing entrances, web-shots that snap onto what you click, upside-down
 *              hangs, flips and dramatic landings.
 *   - Team-up: a button that sends both heroes across the screen to meet in a comic burst.
 * A separate cinematic layer adds occasional flyovers, web-swings, lightning, sparks, comic-style
 * impact bursts and light-sweep transitions. It introduces sections, reacts to scrolling, celebrates
 * project exploration and powers an optional guided tour.
 *
 * - One file: SVG art, CSS and logic. No libraries, no images, no network requests, no build step.
 * - Does not touch your HTML or CSS. Everything lives in its own namespaced (.pcg-*) overlay.
 * - Never blocks anything: the overlay ignores the pointer, only the small guide bodies and the
 *   control buttons are clickable.
 * - Visitors can mute the chatter, turn the cinematic effects off, move the dock to the other
 *   side, or hide everything. Choices are remembered (localStorage, with an in-memory fallback).
 * - Honors prefers-reduced-motion (static guides, no flybys), pauses when the tab is hidden and
 *   works on GitHub Pages as-is.
 *
 * Optional settings (all optional):
 *   <script src="portfolio-character-guide.js" defer data-intensity="calm|normal|epic"></script>
 *   or  window.PCG_CONFIG = { intensity: 'calm', fx: 'off' }  before the script loads.
 *
 * All character art is original. It is inspired by the *idea* of an armored flying hero, a
 * web-slinger and exotic sports cars; it uses no copyrighted designs, logos, names or assets.
 */
(function () {
  'use strict';

  if (window.__pcgLoaded) return;
  window.__pcgLoaded = true;

  var doc = document;
  var win = window;

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                       */
  /* ------------------------------------------------------------------ */
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  var shuffle = function (arr) {
    var a = arr.slice(), i, j, t;
    for (i = a.length - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  };
  var now = function () { return (win.performance && performance.now) ? performance.now() : Date.now(); };
  var mq = function (q) { return win.matchMedia ? win.matchMedia(q) : { matches: false, addEventListener: function () {} }; };
  var onMQ = function (m, fn) {
    if (m.addEventListener) m.addEventListener('change', fn);
    else if (m.addListener) m.addListener(fn);
  };

  var mqReduce = mq('(prefers-reduced-motion: reduce)');
  var mqCompact = mq('(max-width: 640px)');
  var HAS_WAAPI = typeof Element !== 'undefined' && !!Element.prototype.animate;

  // localStorage can throw (private mode, blocked cookies): fall back to memory.
  var memStore = {};
  var store = {
    get: function (k) {
      try { var v = win.localStorage.getItem('pcg:' + k); return v; }
      catch (e) { return Object.prototype.hasOwnProperty.call(memStore, k) ? memStore[k] : null; }
    },
    set: function (k, v) {
      try { win.localStorage.setItem('pcg:' + k, v); }
      catch (e) { memStore[k] = v; }
    }
  };

  /* ---- optional configuration (script data-attributes or window.PCG_CONFIG) ---- */
  var scriptEl = doc.currentScript;
  var cfg = win.PCG_CONFIG || {};
  function opt(name, def) {
    if (cfg[name] != null) return String(cfg[name]);
    var v = scriptEl && scriptEl.getAttribute && scriptEl.getAttribute('data-' + name);
    return v != null ? v : def;
  }
  var nav = win.navigator || {};
  var lowEnd = (nav.hardwareConcurrency || 4) <= 2 || (nav.deviceMemory || 4) <= 2;
  var saveData = !!(nav.connection && nav.connection.saveData);
  var INTENSITY = opt('intensity', lowEnd ? 'calm' : 'normal');
  var PACE = INTENSITY === 'calm' ? 1.9 : (INTENSITY === 'epic' ? 0.6 : 1);   // multiplies waits between ambient shows
  var FX_DEFAULT = !saveData && opt('fx', 'on') !== 'off';
  var AMBIENT_MAX = INTENSITY === 'calm' ? 8 : (INTENSITY === 'epic' ? 26 : 16);  // ambient shows per page view

  /* ------------------------------------------------------------------ */
  /* Original artwork (inline SVG). Shared gradients live in one defs    */
  /* block so every copy of a character looks identical.                 */
  /* ------------------------------------------------------------------ */
  function stops(a) {
    return a.map(function (s) {
      return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>';
    }).join('');
  }
  function lg(id, a, h) {
    return '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + (h ? 1 : 0) + '" y2="' + (h ? 0 : 1) + '">' + stops(a) + '</linearGradient>';
  }
  function rg(id, a) {
    return '<radialGradient id="' + id + '" cx=".5" cy=".5" r=".5">' + stops(a) + '</radialGradient>';
  }

  var SVG_DEFS =
    '<svg class="pcg-defs" width="0" height="0" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><defs>' +
    lg('pcgNR', [['0', '#ff6a6f'], ['.55', '#d62839'], ['1', '#7a0c1b']]) +
    lg('pcgNG', [['0', '#fff1b0'], ['.5', '#f4b942'], ['1', '#a8700a']]) +
    rg('pcgNC', [['0', '#ffffff'], ['.4', '#9ff7ff'], ['1', '#22d3ee', 0]]) +
    lg('pcgFL', [['0', '#ffffff'], ['.3', '#9ff7ff'], ['.7', '#3b82f6'], ['1', '#3b82f6', 0]]) +
    lg('pcgWM', [['0', '#ff6fae'], ['.6', '#d6246e'], ['1', '#7a1250']]) +
    '<filter id="pcgGW" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
    '</defs></svg>';

  function ln(x1, y1, x2, y2, w, c) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round"/>';
  }
  // outlined capsule limb
  function lb(x1, y1, x2, y2, w, c, o) { return ln(x1, y1, x2, y2, w + 1.8, o) + ln(x1, y1, x2, y2, w, c); }
  function svgWrap(vb, inner) {
    return '<svg class="pcg-svg" viewBox="' + vb + '" preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' + inner + '</svg>';
  }

  /* ---- Nova: red-and-gold armored hero (upright; rotated for flight) ---- */
  function novaSvg() {
    var R = '#d62839', RO = '#7a0c1b', G = '#f4b942', GO = '#8a5a08', GL = '#ffe08a', K = '#1a1024';
    var s = '';
    // thruster flames (behind the armor): palms + boots
    s += '<path class="flame" d="M23 104c-3.2 4-3.2 9.5 0 15 3.2-5.5 3.2-11 0-15z" fill="url(#pcgFL)"/>';
    s += '<path class="flame" d="M77 104c-3.2 4-3.2 9.5 0 15 3.2-5.5 3.2-11 0-15z" fill="url(#pcgFL)" style="animation-delay:-.12s"/>';
    s += '<path class="flame" d="M41 143c-3.8 4.8-3.8 11 0 17 3.8-6 3.8-12.2 0-17z" fill="url(#pcgFL)" style="animation-delay:-.2s"/>';
    s += '<path class="flame" d="M59 143c-3.8 4.8-3.8 11 0 17 3.8-6 3.8-12.2 0-17z" fill="url(#pcgFL)" style="animation-delay:-.06s"/>';
    // legs + boots
    s += lb(42, 102, 41, 120, 13, R, RO) + lb(41, 120, 41, 137, 12, G, GO);
    s += lb(58, 102, 59, 120, 13, R, RO) + lb(59, 120, 59, 137, 12, G, GO);
    s += '<rect x="33" y="134" width="16" height="9" rx="3" fill="' + G + '" stroke="' + GO + '"/>';
    s += '<rect x="51" y="134" width="16" height="9" rx="3" fill="' + G + '" stroke="' + GO + '"/>';
    s += '<circle cx="41" cy="120" r="5" fill="' + GL + '" stroke="' + GO + '" stroke-width=".8"/>';
    s += '<circle cx="59" cy="120" r="5" fill="' + GL + '" stroke="' + GO + '" stroke-width=".8"/>';
    // pelvis
    s += '<path d="M37 88H63L66 103H34Z" fill="url(#pcgNG)" stroke="' + GO + '" stroke-width="1" stroke-linejoin="round"/>';
    // arms with glowing repulsor palms
    s += '<g class="arm-l" style="transform-origin:29px 53px">' + lb(29, 53, 21, 73, 10, R, RO) + lb(21, 73, 23, 91, 9, G, GO) +
      '<circle cx="23" cy="96" r="5.6" fill="' + G + '" stroke="' + GO + '" stroke-width=".8"/><circle class="palm" cx="23" cy="100" r="4" fill="url(#pcgNC)"/></g>';
    s += '<g class="arm-r" style="transform-origin:71px 53px">' + lb(71, 53, 79, 73, 10, R, RO) + lb(79, 73, 77, 91, 9, G, GO) +
      '<circle cx="77" cy="96" r="5.6" fill="' + G + '" stroke="' + GO + '" stroke-width=".8"/><circle class="palm" cx="77" cy="100" r="4" fill="url(#pcgNC)"/></g>';
    // torso, chest plate, power core, abs
    s += '<path d="M33 47H67L71 60L63 88H37L29 60Z" fill="url(#pcgNR)" stroke="' + RO + '" stroke-width="1.2" stroke-linejoin="round"/>';
    s += '<path d="M41 49H59L61 62L50 74L39 62Z" fill="url(#pcgNG)" stroke="' + GO + '" stroke-width=".9" stroke-linejoin="round"/>';
    s += '<circle cx="50" cy="60" r="8.6" fill="#0b1630" stroke="' + GL + '" stroke-width="1.6"/>';
    s += '<circle class="chest" cx="50" cy="60" r="5.6" fill="url(#pcgNC)" filter="url(#pcgGW)"/>';
    s += '<path d="M41 79H59M42 83H58M43 86.5H57" stroke="' + GL + '" stroke-width="1.2" stroke-linecap="round" opacity=".85"/>';
    // pauldrons
    s += '<ellipse cx="30" cy="53" rx="10" ry="8" fill="url(#pcgNR)" stroke="' + GL + '" stroke-width="1.4"/>';
    s += '<ellipse cx="70" cy="53" rx="10" ry="8" fill="url(#pcgNR)" stroke="' + GL + '" stroke-width="1.4"/>';
    // neck + helmet + gold faceplate + glowing eye slits
    s += '<rect x="45" y="41" width="10" height="7" rx="2" fill="' + K + '"/>';
    s += '<path d="M37 20C37 9 43 3 50 3S63 9 63 20V32C63 38 58 43 50 43S37 38 37 32Z" fill="url(#pcgNR)" stroke="' + RO + '" stroke-width="1.2"/>';
    s += '<path d="M41 17H59V31C59 36 55 40 50 40S41 36 41 31Z" fill="url(#pcgNG)" stroke="' + GO + '" stroke-width=".9" stroke-linejoin="round"/>';
    s += '<path d="M50 4V16" stroke="' + GL + '" stroke-width="1.4" stroke-linecap="round"/>';
    s += '<g class="pupil"><path d="M43 22L49 24V27L43 26Z" fill="#eaffff" filter="url(#pcgGW)"/><path d="M57 22L51 24V27L57 26Z" fill="#eaffff" filter="url(#pcgGW)"/></g>';
    s += '<path d="M46 35H54" stroke="' + GO + '" stroke-width="1.2" stroke-linecap="round"/>';
    return svgWrap('0 0 100 160', s);
  }

  /* ---- Weaver: web-swinging hero. pose = 'dock' (hero crouch) | 'swing' (hanging from a web line) ---- */
  function weaverSvg(pose) {
    var M = '#d6246e', MO = '#6e0f3d', V = '#5b2bd6', VO = '#2a1070', K = '#120a2e', WL = 'rgba(18,10,46,.5)';
    var swing = pose === 'swing';
    var P = swing ?
      { aL: [35, 45, 22, 53, 11, 62], aR: [65, 45, 70, 27, 64, 8], lL: [44, 86, 31, 103, 17, 112], lR: [56, 86, 74, 98, 84, 119] } :
      { aL: [35, 45, 23, 60, 29, 77], aR: [65, 45, 78, 58, 71, 73], lL: [44, 86, 34, 106, 41, 130], lR: [56, 86, 68, 104, 61, 130] };
    function limb(p, w1, w2, c1, o1, c2, o2) {
      return lb(p[0], p[1], p[2], p[3], w1, c1, o1) + lb(p[2], p[3], p[4], p[5], w2, c2, o2);
    }
    function glove(p) { return '<circle cx="' + p[4] + '" cy="' + p[5] + '" r="5.2" fill="' + V + '" stroke="' + VO + '" stroke-width=".8"/>'; }
    function boot(p) { return '<ellipse cx="' + p[4] + '" cy="' + (p[5] + 3) + '" rx="6.6" ry="4.6" fill="' + K + '" stroke="#8b5cf6" stroke-opacity=".6" stroke-width=".8"/>'; }
    var s = '';
    // back limbs first
    s += limb(P.lL, 11, 10, V, VO, V, VO) + boot(P.lL);
    s += limb(P.aL, 8, 7.5, M, MO, V, VO) + glove(P.aL);
    // torso with web lines and a diamond emblem
    s += '<path d="M35 41H65L63 62L57 84H43L37 62Z" fill="url(#pcgWM)" stroke="' + MO + '" stroke-width="1.2" stroke-linejoin="round"/>';
    s += '<path d="M42 82H58V88C58 90 56 91 54 91H46C44 91 42 90 42 88Z" fill="' + V + '" stroke="' + VO + '" stroke-width=".9"/>';
    s += '<path d="M50 41V84M37 52Q50 58 63 52M39 62Q50 68 61 62M41 72Q50 77 59 72" stroke="' + WL + '" stroke-width=".8" fill="none"/>';
    s += '<path class="chest" d="M50 48L56.5 55L50 62L43.5 55Z" fill="#e9fcff" stroke="' + VO + '" stroke-width="1"/>';
    s += '<circle cx="35" cy="44" r="6" fill="' + M + '" stroke="' + MO + '" stroke-width="1"/><circle cx="65" cy="44" r="6" fill="' + M + '" stroke="' + MO + '" stroke-width="1"/>';
    // head: suit mask, web pattern, big angular lenses
    s += '<rect x="45" y="33" width="10" height="9" rx="3" fill="' + M + '"/>';
    s += '<ellipse cx="50" cy="21" rx="12.5" ry="15" fill="url(#pcgWM)" stroke="' + MO + '" stroke-width="1.2"/>';
    s += '<path d="M50 6V36M39 13Q50 18 61 13M37.5 22Q50 28 62.5 22M39.5 30Q50 34.5 60.5 30M43 8L46.5 30M57 8L53.5 30" stroke="' + WL + '" stroke-width=".7" fill="none"/>';
    s += '<path d="M38 17Q44 13 49 21Q44 28 36 24Z" fill="#e9fcff" stroke="' + K + '" stroke-width=".9" stroke-linejoin="round"/>';
    s += '<path d="M62 17Q56 13 51 21Q56 28 64 24Z" fill="#e9fcff" stroke="' + K + '" stroke-width=".9" stroke-linejoin="round"/>';
    s += '<g class="pupil"><ellipse cx="43.2" cy="20.6" rx="2" ry="3.1" fill="#22d3ee" transform="rotate(-24 43.2 20.6)"/><ellipse cx="56.8" cy="20.6" rx="2" ry="3.1" fill="#22d3ee" transform="rotate(24 56.8 20.6)"/></g>';
    // front limbs
    s += limb(P.lR, 11, 10, V, VO, V, VO) + boot(P.lR);
    s += limb(P.aR, 8, 7.5, M, MO, V, VO) + glove(P.aR);
    if (swing) s += '<circle class="chest" cx="64" cy="7" r="6" fill="url(#pcgNC)"/>';   // web-shooter glow at the grip
    return svgWrap('0 0 100 160', s);
  }

  var ART = {
    nova: novaSvg(),
    weaverDock: weaverSvg('dock'),
    weaverSwing: weaverSvg('swing')
  };

  /* ------------------------------------------------------------------ */
  /* Characters                                                          */
  /* ------------------------------------------------------------------ */
  var CHARS = {
    nova: {
      name: 'Nova', kind: 'armored hero', color: '#ff6a6f', glow: 'rgba(255,90,95,.55)', w: 1, gaze: 1.3,
      idle: ['hover', 'flex', 'spin', 'scan', 'blast', 'hop'], click: ['hover', 'flex', 'blast', 'hop'],
      quips: [
        'Thrusters at one hundred percent. All systems nominal.',
        'Armor polished, portfolio ready.',
        'Scanning the page\u2026 everything checks out.',
        'Click me any time for a flyover.',
        'Click a button and I\u2019ll fire a repulsor at it. Safely, of course.',
        'Want a show? Hit the team-up button and Weaver and I will cross paths in style.'
      ]
    },
    weaver: {
      name: 'Weaver', kind: 'web-slinging hero', color: '#ff4fd8', glow: 'rgba(255,79,216,.5)', w: 1, gaze: 1.3,
      idle: ['flip', 'zip', 'crouch', 'hang', 'hop'], click: ['flip', 'crouch', 'hang', 'hop'],
      quips: [
        'Just hanging around. Literally.',
        'Web-sense tingling: you are about to find something cool.',
        'Nice scrolling. Smooth as a web line.',
        'Click me and I will swing by.',
        'I tag whatever you click with a web. It\u2019s a hero thing.',
        'The team-up button sends Nova and me on a crossing patrol.'
      ]
    }
  };
  var ORDER = ['nova', 'weaver'];

  var ACTIONS = {
    hop:    { cls: 'act-hop',    ms: 800 },
    dance:  { cls: 'act-dance',  ms: 1500 },
    zip:    { cls: 'act-zip',    ms: 1300 },
    loop:   { cls: 'act-loop',   ms: 1100 },
    spin:   { cls: 'act-spin',   ms: 1200 },
    boost:  { cls: 'is-boost',   ms: 1500 },
    hover:  { cls: 'act-hover',  ms: 1700 },
    flex:   { cls: 'act-flex',   ms: 1000 },
    flip:   { cls: 'act-flip',   ms: 1000 },
    crouch: { cls: 'act-crouch', ms: 800 },
    blast:  { cls: 'act-blast',  ms: 600 },
    scan:   { cls: 'act-scan',   ms: 1250 },
    hang:   { cls: 'act-hang',   ms: 2300 }
  };
  var ACT_CLASSES = Object.keys(ACTIONS).map(function (k) { return ACTIONS[k].cls; });

  var SPARK_COLORS = ['#22d3ee', '#3b82f6', '#8b5cf6', '#ff4fd8'];
  var COMIC_WORDS = ['POW!', 'ZAP!', 'BAM!', 'WHAM!', 'ZOOM!', 'KA-BLAM!'];

  /* ------------------------------------------------------------------ */
  /* Icons for the small control buttons                                 */
  /* ------------------------------------------------------------------ */
  var ICON = {
    tour: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>',
    stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>',
    mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path class="pcg-slash" d="M4 4l16 16"/></svg>',
    fx: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12z"/><path class="pcg-slash" d="M4 4l16 16"/></svg>',
    team: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l1.4 3.2L12 8.6 8.4 10 7 13.4 5.6 10 2 8.6l3.6-1.4z"/><path d="M17 10l1.6 3.8 3.9 1.6-3.9 1.6L17 20.8l-1.6-3.8-3.9-1.6 3.9-1.6z"/></svg>',
    side: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h12l-3-3M17 17H5l3 3"/></svg>',
    hide: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    spark: '<svg viewBox="0 0 24 24" aria-hidden="true" style="fill:currentColor;stroke:none"><path d="M12 2l2.2 6.3L21 10.5l-6.3 2.2L12 20l-2.7-7.3L3 10.5l6.8-2.2z"/></svg>'
  };

  /* ------------------------------------------------------------------ */
  /* Styles (all namespaced, injected once, never touches site CSS)      */
  /* ------------------------------------------------------------------ */
  var CSS = [
    '.pcg-app,.pcg-app *,.pcg-sparks,.pcg-sparks *,.pcg-fx,.pcg-fx *{box-sizing:border-box}',
    '.pcg-app [hidden]{display:none !important}',
    '.pcg-defs{position:absolute;width:0;height:0;overflow:hidden;pointer-events:none}',
    '.pcg-app{--cw:86px;--ch:112px;--aw:1;--pcg-ease:cubic-bezier(.2,.8,.2,1);position:fixed;z-index:900;right:max(12px,env(safe-area-inset-right,0px));bottom:max(12px,env(safe-area-inset-bottom,0px));pointer-events:none;font-family:var(--font-body,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif);color:#eef0ff;transition:opacity .4s}',
    '.pcg-app[data-side="left"]{right:auto;left:max(12px,env(safe-area-inset-left,0px))}',
    '.pcg-app.is-compact{--cw:60px;--ch:84px}',
    '.pcg-app.is-scrolling{opacity:.72}',
    '.pcg-main{display:flex;align-items:flex-end;gap:6px;transition:opacity .45s,transform .55s var(--pcg-ease),visibility .45s}',
    '.pcg-app[data-side="left"] .pcg-main{flex-direction:row-reverse}',
    '.pcg-app.is-off .pcg-main{opacity:0;visibility:hidden;transform:translateY(16px) scale(.96)}',
    '.pcg-stage{position:relative;flex:none;width:calc(var(--cw)*2);height:var(--ch)}',
    '.pcg-app.is-compact .pcg-stage{width:calc(var(--cw)*var(--aw))}',

    /* guides: layer 1 position+wander, layer 2 float, layer 3 actions */
    '.pcg-char{position:absolute;bottom:0;left:calc(var(--x)*var(--cw));width:calc(var(--w)*var(--cw));height:var(--ch);translate:var(--dx,0px) var(--dy,0px);transition:translate 1.9s cubic-bezier(.45,0,.25,1),opacity .35s,filter .5s;pointer-events:none;transform-origin:50% 90%}',
    '.pcg-app.is-compact .pcg-char{left:0}',
    '.pcg-app.is-compact .pcg-char:not(.is-active){display:none}',
    '.pcg-char.pcg-in{animation:pcg-pop .9s var(--pcg-ease) backwards;animation-delay:calc(var(--slot)*.14s)}',
    '.pcg-app.is-compact .pcg-char.pcg-in{animation-delay:0s}',
    '.pcg-char.is-away{opacity:0 !important}',
    '.pcg-bob{position:absolute;inset:0;transform-origin:50% 90%;animation:pcg-bob 3.6s ease-in-out infinite;transition:scale .5s var(--pcg-ease)}',
    '.pcg-char[data-id="weaver"] .pcg-bob{animation-name:pcg-bob-w;animation-duration:3.1s;animation-delay:-1s}',
    '.pcg-act{position:absolute;inset:0;transform-origin:50% 70%}',
    '.pcg-act svg{display:block;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 0 7px var(--cg));translate:calc(var(--lx,0)*3px) calc(var(--ly,0)*2px);transition:translate .35s ease-out}',
    '.pcg-char.is-hover .pcg-bob{scale:1.08}',
    '.pcg-char.is-speaker .pcg-bob{scale:1.14}',
    '.pcg-app.is-touring .pcg-char:not(.is-speaker){opacity:.55;filter:saturate(.6)}',

    /* only the guide body is clickable; the rest never intercepts the page */
    '.pcg-hit{position:absolute;left:12%;right:12%;top:12%;bottom:4%;padding:0;border:0;border-radius:40%;background:transparent;cursor:pointer;pointer-events:auto;-webkit-tap-highlight-color:transparent}',

    /* idle life */
    '.pcg-svg .pupil{transition:transform .14s ease-out}',
    '.pcg-svg .chest,.pcg-svg .palm{transform-box:fill-box;transform-origin:center;animation:pcg-pulse 2.4s ease-in-out infinite}',
    '.pcg-svg .palm{animation-duration:1.7s}',
    '.pcg-svg .flame{transform-box:fill-box;transform-origin:50% 0;animation:pcg-flame .32s ease-in-out infinite alternate;transition:scale .25s}',
    '.pcg-char.is-boost .flame{scale:1.25 1.95}',
    '.pcg-char[data-id="nova"] .arm-l,.pcg-char[data-id="nova"] .arm-r{animation:pcg-arm 3.6s ease-in-out infinite alternate}',
    '.pcg-char[data-id="nova"] .arm-r{animation-delay:-1.8s}',

    /* actions */
    '.act-hop .pcg-act{animation:pcg-hop .75s var(--pcg-ease)}',
    '.act-dance .pcg-act{animation:pcg-wobble .35s ease-in-out 4}',
    '.act-zip .pcg-act{animation:pcg-zip 1.2s cubic-bezier(.6,0,.3,1)}',
    '.act-loop .pcg-act{animation:pcg-loop 1s cubic-bezier(.5,0,.3,1)}',
    '.act-spin .pcg-act{animation:pcg-spin 1.1s cubic-bezier(.6,0,.3,1)}',
    '.act-hover .pcg-act{animation:pcg-hover 1.6s ease-in-out}',
    '.act-hover .flame{scale:1.35 2.1}',
    '.act-flex .pcg-act{animation:pcg-flex .9s ease-in-out}',
    '.act-flip .pcg-act{animation:pcg-flip .95s cubic-bezier(.5,0,.3,1)}',
    '.act-crouch .pcg-act{animation:pcg-crouch .7s ease-in-out}',

    /* emotes + sparks */
    '.pcg-emote{position:absolute;left:50%;top:2px;translate:-50% 0;font:800 20px/1 var(--font-body,system-ui,sans-serif);color:var(--c,#22d3ee);text-shadow:0 0 10px var(--c,#22d3ee);opacity:1;pointer-events:none;animation:pcg-emote 1.4s ease-out forwards}',
    '.pcg-sparks{position:fixed;inset:0;z-index:902;pointer-events:none;overflow:hidden}',
    '.pcg-spark{position:fixed;pointer-events:none;background:var(--c);clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%);filter:drop-shadow(0 0 4px var(--c));will-change:transform,opacity}',

    /* ---------- cinematic layer: sits UNDER the dock and never takes the pointer ---------- */
    '.pcg-fx{position:fixed;inset:0;z-index:899;pointer-events:none;overflow:hidden;--hw:clamp(54px,6.4vw,84px);--cw2:clamp(124px,16vw,220px);contain:layout paint style}',
    '.pcg-actor{position:absolute;left:0;top:0;pointer-events:none;will-change:transform,opacity}',
    '.pcg-hero{width:var(--hw);height:calc(var(--hw)*1.6)}',
    '.pcg-ac-c{margin-left:calc(var(--hw)*-.5);margin-top:calc(var(--hw)*-.8)}',
    '.pcg-ac-h{margin-left:calc(var(--hw)*-.64);margin-top:calc(var(--hw)*-.05);transform-origin:64% 3.1%}',
    '.pcg-ac-h.pcg-flip{margin-left:calc(var(--hw)*-.36);transform-origin:36% 3.1%}',
    '.pcg-ac-h.pcg-flip .pcg-hart{transform:scaleX(-1)}',
    '.pcg-hart{position:absolute;inset:0}',
    '.pcg-hart svg{display:block;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 0 8px rgba(125,249,255,.5))}',
    '.pcg-hart .flame{scale:1.1 1.7}',
    '.pcg-h-weaver .pcg-hart svg{filter:drop-shadow(0 0 8px rgba(255,79,216,.55))}',
    '.pcg-htrail{position:absolute;left:50%;top:88%;width:9px;height:clamp(150px,22vw,300px);margin-left:-4.5px;border-radius:9px;background:linear-gradient(180deg,rgba(255,255,255,.95),rgba(125,249,255,.7) 18%,rgba(139,92,246,.45) 55%,transparent);transform-origin:50% 0;opacity:0}',
    '.pcg-rope{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;opacity:0}',
    '.pcg-streak{position:absolute;left:0;top:0;width:3px;height:14px;margin:-7px 0 0 -1.5px;border-radius:2px;background:linear-gradient(180deg,#fff,var(--c,#ffd86b));box-shadow:0 0 6px var(--c,#ffd86b)}',
    '.pcg-ring{position:absolute;left:0;top:0;width:60px;height:60px;margin:-30px 0 0 -30px;border-radius:50%;border:2px solid var(--c,#7df9ff);box-shadow:0 0 18px var(--c,#7df9ff),inset 0 0 12px var(--c,#7df9ff);opacity:0}',
    '.pcg-flash{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 0,rgba(167,139,250,.30),rgba(139,92,246,.10) 55%,transparent 80%);opacity:0}',
    '.pcg-bolt{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;opacity:0}',
    '.pcg-wipe{position:absolute;top:-10vh;left:0;width:44vw;height:120vh}',
    '.pcg-wipe i{position:absolute;inset:0;transform:skewX(-16deg);background:linear-gradient(90deg,transparent,rgba(34,211,238,.16) 30%,rgba(139,92,246,.26) 58%,rgba(255,79,216,.16) 82%,transparent)}',
    '.pcg-burst{position:absolute;left:0;top:0;width:150px;height:130px;margin:-65px 0 0 -75px;overflow:visible;filter:drop-shadow(0 6px 0 rgba(0,0,0,.3))}',

    /* speech bubble */
    '.pcg-bubble{--c:#22d3ee;--cg:rgba(34,211,238,.5);--tail:60px;position:absolute;right:0;bottom:calc(var(--ch) + 24px);width:min(330px,calc(100vw - 84px));padding:14px 16px;border-radius:18px;background:linear-gradient(155deg,rgba(24,30,66,.95),rgba(8,10,26,.95));border:1px solid var(--cg);box-shadow:0 22px 50px -20px var(--cg),inset 0 1px 0 rgba(255,255,255,.06);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);color:#eef0ff;font-size:14px;line-height:1.55;pointer-events:none;visibility:hidden;opacity:0;translate:0 10px;scale:.94;transform-origin:var(--tail) 100%;transition:opacity .35s,translate .5s var(--pcg-ease),scale .5s var(--pcg-ease),visibility .35s}',
    '.pcg-app[data-side="left"] .pcg-bubble{right:auto;left:0}',
    '.pcg-bubble.is-open{pointer-events:auto;visibility:visible;opacity:1;translate:0 0;scale:1}',
    '.pcg-bubble::after{content:"";position:absolute;bottom:-7px;left:var(--tail);width:13px;height:13px;margin-left:-6px;background:#0d1130;border-right:1px solid var(--cg);border-bottom:1px solid var(--cg);rotate:45deg;border-radius:0 0 4px 0}',
    '.pcg-who{display:flex;align-items:center;gap:8px;margin-bottom:6px;padding-right:26px;font-size:12px;font-weight:700;letter-spacing:.02em;color:var(--c)}',
    '.pcg-dot{width:8px;height:8px;border-radius:50%;background:var(--c);box-shadow:0 0 10px var(--c);flex:none}',
    '.pcg-step{margin-left:auto;font-weight:600;color:#9aa6cf;font-variant-numeric:tabular-nums}',
    '.pcg-msg{margin:0;color:#eef0ff}',
    '.pcg-dots{display:flex;gap:5px;margin-top:11px}',
    '.pcg-dots:empty{display:none}',
    '.pcg-dots i{display:block;width:6px;height:6px;border-radius:4px;background:rgba(150,165,255,.3);transition:width .4s var(--pcg-ease),background .3s}',
    '.pcg-dots i.on{width:18px;background:var(--c);box-shadow:0 0 8px var(--c)}',
    '.pcg-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}',
    '.pcg-actions:empty{display:none}',
    '.pcg-btn{font:600 13px/1 var(--font-body,system-ui,sans-serif);padding:9px 15px;border-radius:999px;border:1px solid rgba(150,165,255,.32);background:rgba(255,255,255,.06);color:#eef0ff;cursor:pointer;transition:transform .3s var(--pcg-ease),box-shadow .3s,border-color .25s,background .25s}',
    '.pcg-btn:hover{transform:translateY(-2px);border-color:var(--c)}',
    '.pcg-btn.is-primary{border-color:transparent;color:#fff;background:linear-gradient(110deg,#6d28d9,#9333ea 50%,#db2777);box-shadow:0 8px 22px -8px rgba(147,51,234,.85)}',
    '.pcg-btn.is-quiet{border-color:transparent;background:transparent;color:#9aa6cf;text-decoration:underline;text-underline-offset:3px;padding-left:6px;padding-right:6px}',
    '.pcg-btn.is-quiet:hover{color:#fff;transform:none}',
    '.pcg-x{position:absolute;top:8px;right:8px;width:26px;height:26px;display:grid;place-items:center;padding:0;border:0;border-radius:50%;background:transparent;color:#9aa6cf;cursor:pointer;transition:background .25s,color .25s}',
    '.pcg-x:hover{background:rgba(255,255,255,.1);color:#fff}',
    '.pcg-x svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2.2;stroke-linecap:round}',

    /* controls */
    '.pcg-ctl{display:flex;flex-direction:column;gap:5px;opacity:.6;transition:opacity .3s}',
    '.pcg-app:hover .pcg-ctl,.pcg-ctl:focus-within{opacity:1}',
    '.pcg-b{width:32px;height:32px;display:grid;place-items:center;padding:0;border-radius:50%;border:1px solid rgba(150,165,255,.3);background:rgba(10,13,30,.74);color:#dfe4ff;cursor:pointer;pointer-events:auto;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);transition:transform .3s var(--pcg-ease),border-color .25s,box-shadow .3s,color .25s}',
    '.pcg-b:hover{transform:translateY(-2px);border-color:#22d3ee;color:#fff;box-shadow:0 0 0 1px rgba(34,211,238,.3),0 8px 22px -8px rgba(34,211,238,.7)}',
    '.pcg-b svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}',
    '.pcg-b .pcg-slash{opacity:0;transition:opacity .25s}',
    '.pcg-b[data-ctl="mute"][aria-pressed="true"] .pcg-slash,.pcg-b[data-ctl="fx"][aria-pressed="false"] .pcg-slash{opacity:1}',
    '.pcg-b[data-ctl="mute"][aria-pressed="true"],.pcg-b[data-ctl="fx"][aria-pressed="false"]{color:#8d98c0}',
    '.pcg-app.is-compact .pcg-b{width:30px;height:30px}',
    '@media (pointer:coarse){.pcg-b{width:38px;height:38px}.pcg-app.is-compact .pcg-b{width:36px;height:36px}}',

    /* launcher shown when guides are hidden */
    '.pcg-launch{position:absolute;bottom:0;right:0;width:48px;height:48px;display:grid;place-items:center;padding:0;border-radius:50%;border:1px solid rgba(139,92,246,.65);background:radial-gradient(circle at 35% 30%,#4b34b0,#0b0e24);color:#fff;cursor:pointer;pointer-events:auto;box-shadow:0 0 26px -4px rgba(139,92,246,.9);opacity:0;visibility:hidden;scale:.6;transition:opacity .4s,scale .55s var(--pcg-ease),visibility .4s}',
    '.pcg-app[data-side="left"] .pcg-launch{right:auto;left:0}',
    '.pcg-app.is-off .pcg-launch{opacity:1;visibility:visible;scale:1}',
    '.pcg-launch svg{width:22px;height:22px;filter:drop-shadow(0 0 6px #22d3ee)}',
    '.pcg-launch::after{content:"";position:absolute;inset:-5px;border-radius:50%;border:1px solid rgba(34,211,238,.5);animation:pcg-ring 2.8s ease-out infinite}',

    '.pcg-app :focus-visible{outline:2px solid #22d3ee;outline-offset:3px}',
    '.pcg-hit:focus-visible{border-radius:50%}',
    '.pcg-sr{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;padding:0}',

    /* light theme (your site toggles data-theme="light" on <html>) */
    '[data-theme="light"] .pcg-bubble{background:linear-gradient(155deg,rgba(255,255,255,.97),rgba(238,242,255,.97));color:#12152e}',
    '[data-theme="light"] .pcg-bubble::after{background:#f3f5ff}',
    '[data-theme="light"] .pcg-msg{color:#12152e}',
    '[data-theme="light"] .pcg-step,[data-theme="light"] .pcg-x{color:#4c577a}',
    '[data-theme="light"] .pcg-btn{background:rgba(20,25,70,.06);color:#12152e;border-color:rgba(70,80,160,.3)}',
    '[data-theme="light"] .pcg-btn.is-primary{color:#fff}',
    '[data-theme="light"] .pcg-btn.is-quiet{background:transparent;color:#4c577a}',
    '[data-theme="light"] .pcg-b{background:rgba(255,255,255,.85);color:#12152e;border-color:rgba(70,80,160,.3)}',
    '[data-theme="light"] .pcg-flash{display:none}',
    '[data-theme="light"] .pcg-wipe i{opacity:.55}',

    /* keyframes */
    '@keyframes pcg-pop{from{opacity:0;scale:.2}60%{scale:1.12}to{opacity:1;scale:1}}',
    '@keyframes pcg-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}',
    '@keyframes pcg-bob-w{0%,100%{transform:translateY(0) rotate(-1.5deg)}50%{transform:translateY(-5px) rotate(1.5deg)}}',
    '@keyframes pcg-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(.82)}}',
    '@keyframes pcg-flame{from{transform:scaleY(.85) scaleX(1)}to{transform:scaleY(1.25) scaleX(.88)}}',
    '@keyframes pcg-arm{from{transform:rotate(-5deg)}to{transform:rotate(5deg)}}',
    '@keyframes pcg-hop{0%{translate:0 0;scale:1 1}18%{translate:0 2px;scale:1.08 .92}45%{translate:0 -22px;scale:.95 1.06}75%{translate:0 0;scale:1.06 .94}100%{translate:0 0;scale:1 1}}',
    '@keyframes pcg-wobble{0%,100%{rotate:0deg}25%{rotate:-9deg}75%{rotate:9deg}}',
    '@keyframes pcg-zip{0%{translate:0 0;rotate:0deg}35%,65%{translate:-62px -12px;rotate:-14deg}100%{translate:0 0;rotate:0deg}}',
    '@keyframes pcg-loop{0%{rotate:0deg;translate:0 0}50%{rotate:-190deg;translate:-26px -34px}100%{rotate:-360deg;translate:0 0}}',
    '@keyframes pcg-spin{to{rotate:360deg}}',
    '@keyframes pcg-hover{0%,100%{translate:0 0}25%{translate:0 -26px}50%{translate:2px -30px}75%{translate:-2px -24px}}',
    '@keyframes pcg-flex{0%,100%{scale:1;rotate:0deg}30%{scale:1.14 1.1}50%{scale:1.1;rotate:-4deg}70%{scale:1.14;rotate:4deg}}',
    '@keyframes pcg-flip{0%{rotate:0deg;translate:0 0}40%{rotate:-200deg;translate:0 -34px}100%{rotate:-360deg;translate:0 0}}',
    '@keyframes pcg-crouch{0%,100%{scale:1 1}40%,60%{scale:1.1 .82}}',
    '@keyframes pcg-emote{0%{opacity:0;translate:-50% 10px;scale:.5}20%{opacity:1;translate:-50% 0;scale:1.2}100%{opacity:0;translate:-50% -30px;scale:1}}',
    '@keyframes pcg-ring{0%{opacity:.9;scale:.9}100%{opacity:0;scale:1.5}}',

    /* hero features */
    '.pcg-char.is-away .pcg-hit{pointer-events:none}',
    '.act-blast .palm{scale:2.7}',
    '.act-blast .pcg-act{animation:pcg-recoil .55s ease-out}',
    '.act-scan .pcg-act{animation:pcg-scan 1.2s ease-in-out}',
    '.act-scan .pupil{filter:drop-shadow(0 0 5px #7df9ff)}',
    '.act-hang .pcg-act{animation:pcg-hang 2.2s cubic-bezier(.4,0,.2,1);transform-origin:50% 40%}',
    '.pcg-char[data-id="weaver"]::before{content:"";position:absolute;left:50%;bottom:calc(100% - 12px);width:2px;height:84px;margin-left:-1px;background:linear-gradient(180deg,transparent,#f1ecff);opacity:0;transform-origin:50% 100%;pointer-events:none}',
    '.pcg-char.act-hang[data-id="weaver"]::before{animation:pcg-hangline 2.2s ease-in-out}',
    '.pcg-beam{position:absolute;left:0;top:0;height:7px;margin-top:-3.5px;border-radius:7px;transform-origin:0 50%;background:linear-gradient(90deg,#ffffff,#7df9ff 35%,rgba(34,211,238,.2));box-shadow:0 0 16px #22d3ee,0 0 34px rgba(34,211,238,.6);opacity:0}',
    '.pcg-scan{position:absolute;opacity:0}',
    '.pcg-scan i{position:absolute;width:20px;height:20px;border:2px solid #7df9ff;box-shadow:0 0 10px #22d3ee}',
    '.pcg-scan i:nth-child(1){left:-6px;top:-6px;border-right:0;border-bottom:0}',
    '.pcg-scan i:nth-child(2){right:-6px;top:-6px;border-left:0;border-bottom:0}',
    '.pcg-scan i:nth-child(3){left:-6px;bottom:-6px;border-right:0;border-top:0}',
    '.pcg-scan i:nth-child(4){right:-6px;bottom:-6px;border-left:0;border-top:0}',
    '.pcg-scan b{position:absolute;left:0;right:0;top:0;height:2px;background:linear-gradient(90deg,transparent,#7df9ff,transparent);box-shadow:0 0 10px #22d3ee}',
    '.pcg-web{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;opacity:0}',
    '@keyframes pcg-recoil{0%{translate:0 0}20%{translate:-4px 0;scale:1.04}100%{translate:0 0}}',
    '@keyframes pcg-scan{0%,100%{rotate:0deg;scale:1}30%{rotate:-4deg;scale:1.05}70%{rotate:4deg;scale:1.05}}',
    '@keyframes pcg-hang{0%{translate:0 0;rotate:0deg}25%{translate:0 -4px;rotate:180deg}45%{translate:2px -3px;rotate:176deg}65%{translate:-2px -3px;rotate:184deg}85%{translate:0 -4px;rotate:180deg}100%{translate:0 0;rotate:360deg}}',
    '@keyframes pcg-hangline{0%{opacity:0;scale:1 .2}20%,85%{opacity:.9;scale:1 1}100%{opacity:0;scale:1 .2}}',

    '@media (prefers-reduced-motion:reduce){.pcg-app *{animation:none !important;transition-duration:.01ms !important}.pcg-spark,.pcg-fx{display:none}}',
    '@media print{.pcg-app,.pcg-sparks,.pcg-fx{display:none !important}}'
  ].join('\n');

  /* ------------------------------------------------------------------ */
  /* Section detection: uses YOUR ids, never invents any                 */
  /* ------------------------------------------------------------------ */
  var WANT = [
    { key: 'about',      ids: ['about', 'about-me', 'aboutme'],                 words: ['about'] },
    { key: 'skills',     ids: ['skills', 'skill', 'skillset', 'tech-stack'],    words: ['skill'] },
    { key: 'projects',   ids: ['projects', 'project', 'portfolio', 'work', 'works'], words: ['project'] },
    { key: 'experience', ids: ['experience', 'exp', 'career'],                  words: ['experience'] },
    { key: 'contact',    ids: ['contact', 'contact-me', 'contactme', 'get-in-touch'], words: ['contact'] }
  ];
  var LABEL = { about: 'About', skills: 'Skills', projects: 'Projects', experience: 'Experience', contact: 'Contact' };
  var BLOCK_TAGS = /^(SECTION|DIV|ARTICLE|MAIN|HEADER|FOOTER|ASIDE)$/;

  function headingText(el) {
    var h = el.querySelector('h1,h2,h3,.section-title');
    return h ? (h.textContent || '').toLowerCase() : '';
  }

  function detectSections() {
    var cands = $$('[id]').filter(function (el) {
      return el.id && BLOCK_TAGS.test(el.tagName) && !el.closest('.pcg-app') && el.offsetHeight > 60;
    });
    var used = [];
    var found = [];
    WANT.forEach(function (w) {
      var free = function (c) { return used.indexOf(c) === -1; };
      var el = cands.filter(free).filter(function (c) { return w.ids.indexOf(c.id.toLowerCase()) > -1; })[0];
      if (!el) el = cands.filter(free).filter(function (c) {
        var id = c.id.toLowerCase();
        return w.words.some(function (k) { return id.indexOf(k) > -1; });
      })[0];
      if (!el) el = cands.filter(free).filter(function (c) {
        return c.tagName === 'SECTION' && w.words.some(function (k) { return headingText(c).indexOf(k) > -1; });
      })[0];
      if (el) { used.push(el); found.push({ key: w.key, el: el, id: el.id }); }
    });
    found.sort(function (a, b) {
      return (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
    });
    return found;
  }

  // Returns the count for the first selector that matches anything (specific first,
  // looser fallbacks after), so child elements like .skill-cat-icon are never counted.
  function count(el, sels) {
    var list = Array.isArray(sels) ? sels : [sels];
    for (var i = 0; i < list.length; i++) {
      try {
        var n = el.querySelectorAll(list[i]).length;
        if (n) return n;
      } catch (e) { /* invalid selector: try next */ }
    }
    return 0;
  }

  function ownerName() {
    var t = (doc.title || '').split(/[|\u2013\u2014\-]/)[0].trim();
    if (t && t.length <= 30) return t;
    var h = $('h1');
    var label = h && (h.getAttribute('aria-label') || h.textContent || '').trim();
    return label && label.length <= 30 ? label : '';
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */
  function init() {
    var sections = detectSections();
    var owner = ownerName();
    var place = owner ? owner + '\u2019s portfolio' : 'this portfolio';

    var fxStored = store.get('fx');
    var state = {
      hidden: store.get('hidden') === '1',
      // "muted" silences automatic speech bubbles, comic words and title cards (old "tips off" counts too)
      muted: store.get('mute') === '1' || store.get('tips') === '0',
      fx: fxStored === null ? FX_DEFAULT : fxStored === '1',
      side: store.get('side') === 'left' ? 'left' : 'right'
    };

    /* ---- inject CSS ---- */
    var styleEl = doc.createElement('style');
    styleEl.id = 'pcg-style';
    styleEl.textContent = CSS;
    doc.head.appendChild(styleEl);

    /* ---- build DOM ---- */
    var app = doc.createElement('div');
    app.className = 'pcg-app';
    app.id = 'pcg-app';
    app.setAttribute('data-side', state.side);
    app.setAttribute('role', 'region');
    app.setAttribute('aria-label', 'Portfolio guides');

    var SLOT_X = { nova: 0, weaver: 1 };
    var dockArt = { nova: ART.nova, weaver: ART.weaverDock };

    var charsHtml = ORDER.map(function (id, i) {
      var c = CHARS[id];
      return '<div class="pcg-char pcg-in" data-id="' + id + '" style="--x:' + SLOT_X[id] + ';--w:' + c.w + ';--slot:' + i + ';--c:' + c.color + ';--cg:' + c.glow + '">' +
        '<div class="pcg-bob"><div class="pcg-act">' + dockArt[id] + '</div></div>' +
        '<button class="pcg-hit" type="button" aria-label="' + c.name + ', the ' + c.kind + '. Activate for a little surprise."></button>' +
        '</div>';
    }).join('');

    app.innerHTML =
      SVG_DEFS +
      '<div class="pcg-main">' +
        '<div class="pcg-stage">' + charsHtml +
          '<div class="pcg-bubble" role="dialog" aria-label="Guide message" aria-hidden="true">' +
            '<button class="pcg-x" type="button" aria-label="Dismiss message"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
            '<div class="pcg-who"><i class="pcg-dot"></i><span class="pcg-name"></span><span class="pcg-step"></span></div>' +
            '<p class="pcg-msg"></p>' +
            '<div class="pcg-dots" aria-hidden="true"></div>' +
            '<div class="pcg-actions"></div>' +
          '</div>' +
        '</div>' +
        '<div class="pcg-ctl">' +
          '<button class="pcg-b" type="button" data-ctl="tour" aria-label="Start guided tour" title="Start guided tour">' + ICON.tour + '</button>' +
          '<button class="pcg-b" type="button" data-ctl="team" aria-label="Hero team-up show" title="Hero team-up show">' + ICON.team + '</button>' +
          '<button class="pcg-b" type="button" data-ctl="mute" aria-label="Mute guide chatter" aria-pressed="false" title="Mute speech and callouts">' + ICON.mute + '</button>' +
          '<button class="pcg-b" type="button" data-ctl="fx" aria-label="Cinematic effects" aria-pressed="true" title="Cinematic effects: on">' + ICON.fx + '</button>' +
          '<button class="pcg-b" type="button" data-ctl="side" aria-label="Move guides to the other side" title="Move to the other side">' + ICON.side + '</button>' +
          '<button class="pcg-b" type="button" data-ctl="hide" aria-label="Hide guides" title="Hide guides">' + ICON.hide + '</button>' +
        '</div>' +
      '</div>' +
      '<button class="pcg-launch" type="button" aria-label="Show portfolio guides" title="Show guides">' + ICON.spark + '</button>' +
      '<div class="pcg-sr" role="status" aria-live="polite"></div>';

    var layer = doc.createElement('div');          // tiny sparkles (above the dock)
    layer.className = 'pcg-sparks';
    layer.setAttribute('aria-hidden', 'true');

    var fx = doc.createElement('div');              // cinematic layer (below the dock)
    fx.className = 'pcg-fx';
    fx.setAttribute('aria-hidden', 'true');

    doc.body.appendChild(fx);
    doc.body.appendChild(app);
    doc.body.appendChild(layer);

    var bubble = $('.pcg-bubble', app);
    var elName = $('.pcg-name', bubble);
    var elStep = $('.pcg-step', bubble);
    var elMsg = $('.pcg-msg', bubble);
    var elDots = $('.pcg-dots', bubble);
    var elActs = $('.pcg-actions', bubble);
    var btnX = $('.pcg-x', bubble);
    var sr = $('.pcg-sr', app);
    var btnTour = $('[data-ctl="tour"]', app);
    var btnTeam = $('[data-ctl="team"]', app);
    var btnMute = $('[data-ctl="mute"]', app);
    var btnFx = $('[data-ctl="fx"]', app);
    var btnSide = $('[data-ctl="side"]', app);
    var btnHide = $('[data-ctl="hide"]', app);
    var btnLaunch = $('.pcg-launch', app);

    var chars = {};
    ORDER.forEach(function (id) {
      var el = $('.pcg-char[data-id="' + id + '"]', app);
      chars[id] = {
        id: id, el: el, art: $('.pcg-act', el), svg: $('svg', el), hit: $('.pcg-hit', el),
        pupils: $$('.pupil', el), gaze: CHARS[id].gaze,
        actT: 0, hapT: 0, clicks: [], lastEmote: 0
      };
    });

    /* ---- tiny utilities that need the DOM ---- */
    function canAnimate() { return !state.hidden && !doc.hidden && !mqReduce.matches; }

    function announce(text) {
      sr.textContent = '';
      setTimeout(function () { sr.textContent = text; }, 60);
    }

    function enter(el) {
      el.classList.remove('pcg-in');
      void el.offsetWidth;
      el.classList.add('pcg-in');
    }

    function setActive(id) {
      ORDER.forEach(function (k) { chars[k].el.classList.toggle('is-active', k === id); });
      app.style.setProperty('--aw', CHARS[id].w);
    }

    function applyCompact() {
      var compact = mqCompact.matches;
      app.classList.toggle('is-compact', compact);
      var active = ORDER.filter(function (k) { return chars[k].el.classList.contains('is-active'); })[0] || 'nova';
      setActive(active);
      if (bubble.classList.contains('is-open')) placeTail(speakerId);
    }

    // centre / size of a docked guide (null when it is not on screen, e.g. compact mode)
    function slotInfo(id) {
      var c = chars[id];
      if (!c || !c.el.offsetWidth) return null;
      var r = c.el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, bottom: r.bottom };
    }

    /* ---- sparkles (little star bursts above the dock) ---- */
    function sparkle(x, y, n, spread) {
      if (mqReduce.matches || !layer.animate) return;
      if (layer.childElementCount > 36) return;
      n = Math.min(n, 14);
      for (var i = 0; i < n; i++) {
        var el = doc.createElement('i');
        el.className = 'pcg-spark';
        var s = rand(7, 15);
        el.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + s + 'px;height:' + s + 'px;--c:' + pick(SPARK_COLORS);
        layer.appendChild(el);
        var a = rand(0, 6.283);
        var d = rand(24, spread || 70);
        var dx = Math.cos(a) * d;
        var dy = Math.sin(a) * d - rand(10, 30);
        var anim = el.animate([
          { transform: 'translate(-50%,-50%) scale(0) rotate(0deg)', opacity: 1 },
          { transform: 'translate(calc(-50% + ' + dx + 'px),calc(-50% + ' + dy + 'px)) scale(1) rotate(' + rand(-180, 180) + 'deg)', opacity: 1, offset: 0.45 },
          { transform: 'translate(calc(-50% + ' + dx * 1.25 + 'px),calc(-50% + ' + (dy * 1.25 + 18) + 'px)) scale(0) rotate(' + rand(-240, 240) + 'deg)', opacity: 0 }
        ], { duration: rand(650, 1100), easing: 'cubic-bezier(.2,.8,.2,1)' });
        (function (node) { anim.onfinish = function () { node.remove(); }; })(el);
      }
    }

    function sparkleAt(id, n) {
      var c = chars[id];
      if (!c || !c.el.offsetWidth) return;
      var r = c.el.getBoundingClientRect();
      sparkle(r.left + r.width / 2, r.top + r.height * 0.45, n, 80);
    }

    function emote(id, glyph) {
      var c = chars[id];
      if (!c || !c.el.offsetWidth) return;
      var t = now();
      if (t - c.lastEmote < 900) return;
      c.lastEmote = t;
      var el = doc.createElement('span');
      el.className = 'pcg-emote';
      el.setAttribute('aria-hidden', 'true');
      el.textContent = glyph;
      c.el.appendChild(el);
      var kill = function () { if (el.parentNode) el.parentNode.removeChild(el); };
      el.addEventListener('animationend', kill);
      setTimeout(kill, 1800);
    }

    /* ---- docked actions ---- */
    function perform(id, name, opts) {
      var c = chars[id];
      if (!c || !c.el.offsetWidth) return;
      var a = ACTIONS[name] || ACTIONS.hop;
      clearTimeout(c.actT);
      ACT_CLASSES.forEach(function (k) { c.el.classList.remove(k); });
      void c.el.offsetWidth;
      c.el.classList.add(a.cls);
      if (opts && opts.happy) {
        c.el.classList.add('is-happy');
        clearTimeout(c.hapT);
        c.hapT = setTimeout(function () { c.el.classList.remove('is-happy'); }, 1500);
      }
      c.actT = setTimeout(function () { c.el.classList.remove(a.cls); }, a.ms);
    }

    function cheerAll() {
      ORDER.forEach(function (id, k) {
        setTimeout(function () {
          perform(id, 'hop', { happy: true });
          sparkleAt(id, 8);
          emote(id, '\u2665');
        }, k * 170);
      });
    }

    /* ---- speech bubble ---- */
    var PRI = { quip: 1, tip: 2, greet: 3, tour: 4 };
    var bubbleT = 0;
    var speakerId = 'nova';
    var dismissedTips = 0;

    function bubbleOpen() { return bubble.classList.contains('is-open'); }
    function bubbleKind() { return bubble.getAttribute('data-kind') || ''; }

    function setSpeaker(id) {
      speakerId = id;
      ORDER.forEach(function (k) { chars[k].el.classList.toggle('is-speaker', k === id); });
      var wasActive = chars[id].el.classList.contains('is-active');
      setActive(id);
      if (mqCompact.matches && !wasActive) enter(chars[id].el);
    }

    function placeTail(id) {
      var c = chars[id];
      if (!c) return;
      var cx = c.el.offsetLeft + c.el.offsetWidth / 2;
      var x = clamp(cx - bubble.offsetLeft, 24, Math.max(24, bubble.offsetWidth - 24));
      bubble.style.setProperty('--tail', x + 'px');
    }

    function startTtl(ms) {
      clearTimeout(bubbleT);
      bubbleT = setTimeout(function () { closeBubble('auto'); }, ms);
    }

    // o.auto = a message the page triggered on its own (tips, greeting): silenced by Mute.
    function speak(o) {
      if (o.auto && state.muted) return false;
      if (bubbleOpen() && (PRI[bubbleKind()] || 0) > (PRI[o.kind] || 0)) return false;
      var c = CHARS[o.who];
      clearTimeout(bubbleT);
      bubble.setAttribute('data-kind', o.kind);
      bubble.setAttribute('data-ttl', o.ttl ? '1' : '');
      bubble.style.setProperty('--c', c.color);
      bubble.style.setProperty('--cg', c.glow);
      elName.textContent = c.name;
      elStep.textContent = o.step || '';
      elMsg.textContent = o.text;
      btnX.hidden = o.kind === 'tour';

      elDots.innerHTML = '';
      if (o.dots) {
        for (var i = 0; i < o.dots.n; i++) {
          var d = doc.createElement('i');
          if (i === o.dots.i) d.className = 'on';
          elDots.appendChild(d);
        }
      }

      elActs.innerHTML = '';
      var focusBtn = null;
      (o.actions || []).forEach(function (a) {
        var b = doc.createElement('button');
        b.type = 'button';
        b.className = 'pcg-btn' + (a.primary ? ' is-primary' : '') + (a.quiet ? ' is-quiet' : '');
        b.textContent = a.label;
        b.addEventListener('click', a.onClick);
        elActs.appendChild(b);
        if (a.focus) focusBtn = b;
      });

      setSpeaker(o.who);
      bubble.classList.add('is-open');
      bubble.setAttribute('aria-hidden', 'false');
      placeTail(o.who);
      announce(c.name + ' says: ' + o.text);
      if (o.ttl) startTtl(o.ttl);
      if (focusBtn) {
        setTimeout(function () { try { focusBtn.focus({ preventScroll: true }); } catch (e) { focusBtn.focus(); } }, 80);
      }
      return true;
    }

    function closeBubble(reason) {
      clearTimeout(bubbleT);
      if (!bubbleOpen()) return;
      var kind = bubbleKind();
      var hadFocus = bubble.contains(doc.activeElement);
      bubble.classList.remove('is-open');
      bubble.setAttribute('aria-hidden', 'true');
      bubble.setAttribute('data-kind', '');
      ORDER.forEach(function (k) { chars[k].el.classList.remove('is-speaker'); });
      if (hadFocus) {
        var target = btnTour.offsetParent !== null ? btnTour : chars[speakerId].hit;
        try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
      }
      if (reason === 'dismiss' && kind === 'tip') {
        dismissedTips++;
        if (dismissedTips >= 2 && !state.muted) setMuted(true, true);
      }
    }

    bubble.addEventListener('pointerenter', function () { clearTimeout(bubbleT); });
    bubble.addEventListener('pointerleave', function () {
      if (bubbleOpen() && bubble.getAttribute('data-ttl') === '1') startTtl(3000);
    });
    bubble.addEventListener('focusin', function () { clearTimeout(bubbleT); });
    btnX.addEventListener('click', function () { closeBubble('dismiss'); });

    /* ---- mute (speech + callouts) and cinematic effects on/off ---- */
    function syncMuteBtn() {
      btnMute.setAttribute('aria-pressed', state.muted ? 'true' : 'false');
      btnMute.setAttribute('aria-label', state.muted ? 'Unmute guide chatter' : 'Mute guide chatter');
      btnMute.title = state.muted ? 'Guides are muted (click to unmute)' : 'Mute speech and callouts';
    }
    function setMuted(on, auto) {
      state.muted = on;
      store.set('mute', on ? '1' : '0');
      store.set('tips', on ? '0' : '1');
      syncMuteBtn();
      if (on && (bubbleKind() === 'tip' || bubbleKind() === 'greet')) closeBubble('auto');
      announce(auto ? 'Guides muted after two dismissed tips. You can unmute with the speech bubble button.' : (on ? 'Guides muted.' : 'Guides unmuted.'));
      emote('weaver', on ? '\u00b7' : '\u2726');
    }

    function syncFxBtn() {
      btnFx.setAttribute('aria-pressed', state.fx ? 'true' : 'false');
      btnFx.setAttribute('aria-label', 'Cinematic effects ' + (state.fx ? 'on' : 'off'));
      btnFx.title = 'Cinematic effects: ' + (state.fx ? 'on' : 'off');
    }
    function setFx(on) {
      state.fx = on;
      store.set('fx', on ? '1' : '0');
      syncFxBtn();
      if (!on) stopShow(); else startLoops();
      announce('Cinematic effects ' + (on ? 'on' : 'off') + '.');
      emote('nova', on ? '\u26a1' : '\u00b7');
    }

    /* ================================================================== */
    /* Cinematic layer                                                     */
    /* One exclusive "show" at a time, always short, always pointer-less.  */
    /* ================================================================== */
    var showing = null, lastShowEnd = -1e9;
    var anims = [], timers = [], rafId = 0;
    var scrollDir = 1;

    function vw() { return win.innerWidth; }
    function vh() { return win.innerHeight; }
    function kill(n) { if (n && n.parentNode) n.parentNode.removeChild(n); }
    function track(n) { fx.appendChild(n); return n; }
    function mk(cls, html, css) {
      var d = doc.createElement('div');
      d.className = cls;
      if (html) d.innerHTML = html;
      if (css) d.style.cssText = css;
      return track(d);
    }
    function later(fn, ms) {
      var t = setTimeout(function () {
        var i = timers.indexOf(t);
        if (i > -1) timers.splice(i, 1);
        fn();
      }, ms);
      timers.push(t);
      return t;
    }

    // Web Animations helper: removes itself from the bookkeeping list; `after` only runs on a natural finish.
    function fxAnim(node, kf, opt, after) {
      if (!node.animate) return null;
      var a = node.animate(kf, opt);
      anims.push(a);
      a.onfinish = function () {
        var i = anims.indexOf(a);
        if (i > -1) anims.splice(i, 1);
        if (after) after();
      };
      a.oncancel = function () { var i = anims.indexOf(a); if (i > -1) anims.splice(i, 1); };
      return a;
    }

    function clearFx() {
      anims.slice().forEach(function (a) { try { a.cancel(); } catch (e) { /* already gone */ } });
      anims.length = 0;
      timers.forEach(clearTimeout);
      timers.length = 0;
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      fx.textContent = '';
    }
    function restoreChars() { ORDER.forEach(function (id) { chars[id].el.classList.remove('is-away'); }); }
    function stopShow() { clearFx(); showing = null; restoreChars(); }

    function canShow() { return HAS_WAAPI && canAnimate() && state.fx; }

    // Starts an exclusive show if nothing else is running. fn(done) must call done() exactly once.
    function run(name, fn) {
      if (showing || !canShow()) return false;
      var token = { name: name };
      showing = token;
      fn(function () {
        if (showing === token) { showing = null; lastShowEnd = now(); }
      });
      return true;
    }
    function par(n, done) { var k = 0; return function () { if (++k >= n) done(); }; }

    /* ---------------- small effects ---------------- */
    function ring(x, y, color, size) {
      var el = mk('pcg-ring', '', '--c:' + (color || '#7df9ff'));
      var t = 'translate(' + x + 'px,' + y + 'px)';
      fxAnim(el, [{ transform: t + ' scale(.2)', opacity: 0.9 }, { transform: t + ' scale(' + (size || 3.2) + ')', opacity: 0 }],
        { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)' }, function () { kill(el); });
    }

    // metallic sparks / light streaks flying out from a point
    function streaks(x, y, n, color, spread) {
      if (fx.querySelectorAll('.pcg-streak').length > 40) return;
      for (var i = 0; i < n; i++) {
        var el = mk('pcg-streak', '', '--c:' + (color || pick(['#ffd86b', '#ffffff', '#7df9ff', '#ff4fd8'])));
        var a = rand(0, 6.283), d = rand(30, spread || 90);
        var dx = Math.cos(a) * d, dy = Math.sin(a) * d + rand(0, 24);
        var rot = Math.atan2(dy, dx) * 57.2958 + 90;
        fxAnim(el, [
          { transform: 'translate(' + x + 'px,' + y + 'px) rotate(' + rot + 'deg) scaleY(.4)', opacity: 1 },
          { transform: 'translate(' + (x + dx * 0.7) + 'px,' + (y + dy * 0.7) + 'px) rotate(' + rot + 'deg) scaleY(1.4)', opacity: 1, offset: 0.5 },
          { transform: 'translate(' + (x + dx) + 'px,' + (y + dy + 18) + 'px) rotate(' + rot + 'deg) scaleY(.2)', opacity: 0 }
        ], { duration: rand(420, 760), easing: 'cubic-bezier(.2,.7,.3,1)' }, (function (n) { return function () { kill(n); }; })(el));
      }
    }

    // original comic-style starburst (no lettering from any publisher)
    function burstSvg(word, seed) {
      var pts = [], n = 14, i, a, r;
      for (i = 0; i < n * 2; i++) {
        a = (i / (n * 2)) * 6.2832;
        r = (i % 2 ? 30 : 54) * (0.86 + 0.28 * Math.abs(Math.sin(seed + i * 2.3)));
        pts.push((75 + Math.cos(a) * r * 1.25).toFixed(1) + ',' + (65 + Math.sin(a) * r).toFixed(1));
      }
      var p = pts.join(' ');
      return '<svg class="pcg-burst" viewBox="0 0 150 130" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<polygon points="' + p + '" transform="translate(4 5)" fill="#8b5cf6"/>' +
        '<polygon points="' + p + '" fill="#ffd23f" stroke="#ff4fd8" stroke-width="3" stroke-linejoin="round"/>' +
        (word ? '<text x="75" y="76" text-anchor="middle" font-family="Impact,Arial Black,sans-serif" font-weight="900" font-size="' + (word.length > 5 ? 21 : 28) +
          '" fill="#1b1040" stroke="#ffffff" stroke-width="2.4" paint-order="stroke" transform="rotate(-6 75 65)">' + word + '</text>' : '') +
        '</svg>';
    }

    function impact(x, y, word) {
      if (!canShow()) return;
      if (fx.querySelectorAll('.pcg-burst').length > 2) return;
      var el = mk('pcg-actor', burstSvg(state.muted ? '' : (word || pick(COMIC_WORDS)), rand(0, 9)));
      var t = 'translate(' + x + 'px,' + y + 'px)';
      fxAnim(el, [
        { transform: t + ' scale(.2) rotate(-14deg)', opacity: 0 },
        { transform: t + ' scale(1.18) rotate(4deg)', opacity: 1, offset: 0.16 },
        { transform: t + ' scale(1) rotate(-3deg)', opacity: 1, offset: 0.32 },
        { transform: t + ' scale(1.04) rotate(-3deg)', opacity: 1, offset: 0.75 },
        { transform: t + ' scale(1.3) rotate(-3deg)', opacity: 0 }
      ], { duration: 950, easing: 'ease-out' }, function () { kill(el); });
      streaks(x, y, 7, null, 80);
    }

    // glass title card announcing a section
    function titleCard(sec) {
      if (state.muted) return;
      var idx = sections.indexOf(sec) + 1;
      var el = mk('pcg-card', '<b></b><span></span><i></i>');
      $('b', el).textContent = (idx < 10 ? '0' : '') + idx;
      $('span', el).textContent = LABEL[sec.key] || sec.key;
      fxAnim(el, [
        { transform: 'translateY(-14px)', opacity: 0 },
        { transform: 'translateY(0)', opacity: 1, offset: 0.16 },
        { transform: 'translateY(0)', opacity: 1, offset: 0.8 },
        { transform: 'translateY(-8px)', opacity: 0 }
      ], { duration: 2000, easing: 'ease-out' }, function () { kill(el); });
      fxAnim($('i', el), [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)', offset: 0.4 }, { transform: 'scaleX(1)' }],
        { duration: 2000, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }

    // cinematic light-sweep transition (soft, translucent, never covers content for long)
    function wipe() {
      var W = vw();
      var el = mk('pcg-wipe', '<i></i>');
      fxAnim(el, [
        { transform: 'translateX(-50vw)', opacity: 0 },
        { transform: 'translateX(' + (W * 0.3) + 'px)', opacity: 1, offset: 0.25 },
        { transform: 'translateX(' + (W + 80) + 'px)', opacity: 0.8 }
      ], { duration: 1000, easing: 'cubic-bezier(.55,0,.25,1)' }, function () { kill(el); });
    }

    /* ---------------- path flight (heroes) ---------------- */
    // wp: [{t (ms), x, y, r (deg), s}]. One WAAPI animation drives position + heading + size, so it
    // stays on the compositor. `auto` derives the heading from the path itself.
    function buildTrack(wp, auto) {
      var SEG = 12, n = wp.length, S = [], i, j;
      function cr(p0, p1, p2, p3, t) {
        var t2 = t * t, t3 = t2 * t;
        return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
      }
      for (i = 0; i < n - 1; i++) {
        var a = wp[Math.max(0, i - 1)], b = wp[i], c = wp[i + 1], d = wp[Math.min(n - 1, i + 2)];
        for (j = 0; j < SEG; j++) {
          var u = j / SEG, e = u * u * (3 - 2 * u);
          S.push({
            t: lerp(b.t, c.t, u), x: cr(a.x, b.x, c.x, d.x, u), y: cr(a.y, b.y, c.y, d.y, u),
            r: lerp(b.r || 0, c.r || 0, e), s: lerp(b.s == null ? 1 : b.s, c.s == null ? 1 : c.s, e)
          });
        }
      }
      var last = wp[n - 1];
      S.push({ t: last.t, x: last.x, y: last.y, r: last.r || 0, s: last.s == null ? 1 : last.s });

      var dur = last.t, kf = [], tk = [], prevR = null, prevH = 90;
      S.forEach(function (p, k) {
        var q = S[Math.min(k + 1, S.length - 1)], o = S[Math.max(k - 1, 0)];
        var dx = q.x - o.x, dy = q.y - o.y, dt = Math.max(q.t - o.t, 1);
        var sp = Math.sqrt(dx * dx + dy * dy) / dt;           // px per ms
        var r = p.r;
        if (auto) {
          var h = (Math.abs(dx) + Math.abs(dy) > 0.5) ? Math.atan2(dy, dx) * 57.2958 + 90 : prevH;
          if (prevR != null) { while (h - prevR > 180) h -= 360; while (h - prevR < -180) h += 360; }
          r = h; prevH = h; prevR = h;
        }
        var off = clamp(p.t / dur, 0, 1);
        kf.push({ transform: 'translate3d(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px,0) rotate(' + r.toFixed(1) + 'deg) scale(' + p.s.toFixed(3) + ')', offset: off });
        var kk = clamp((sp - 0.22) / 0.9, 0, 1);
        tk.push({ transform: 'scaleY(' + (0.15 + 0.85 * kk).toFixed(2) + ')', opacity: +kk.toFixed(2), offset: off });
      });
      kf[0].offset = 0; kf[kf.length - 1].offset = 1; tk[0].offset = 0; tk[tk.length - 1].offset = 1;
      return { kf: kf, tk: tk, dur: dur };
    }

    function heroActor(kind, art, anchor) {
      var html = (kind === 'nova' ? '<i class="pcg-htrail"></i>' : '') + '<div class="pcg-hart">' + art + '</div>';
      return mk('pcg-actor pcg-hero pcg-h-' + kind + ' ' + (anchor === 'h' ? 'pcg-ac-h' : 'pcg-ac-c'), html);
    }

    function flyActor(el, wp, auto, done) {
      var tr = buildTrack(wp, auto);
      fxAnim(el, tr.kf, { duration: tr.dur, easing: 'linear', fill: 'forwards' }, done);
      var trail = $('.pcg-htrail', el);
      if (trail) fxAnim(trail, tr.tk, { duration: tr.dur, easing: 'linear', fill: 'forwards' });
    }

    /* ---------------- Nova: flyover ---------------- */
    function doFly(dir, done) {
      var W = vw(), H = vh();
      var el = heroActor('nova', ART.nova, 'c');
      var y0 = H * rand(0.14, 0.3);
      var sx = dir > 0 ? -150 : W + 150, ex = dir > 0 ? W + 150 : -150;
      var dur = clamp((W + 300) / 0.72, 1900, 3200);
      flyActor(el, [
        { t: 0, x: sx, y: y0 + 34, s: 0.9 },
        { t: dur * 0.34, x: lerp(sx, ex, 0.34), y: y0 - 26, s: 1 },
        { t: dur * 0.68, x: lerp(sx, ex, 0.68), y: y0 + 28, s: 1 },
        { t: dur, x: ex, y: y0 - 20, s: 0.95 }
      ], true, function () { kill(el); done(); });
      [0.3, 0.62].forEach(function (f) {
        later(function () {
          if (!el.parentNode) return;
          var r = el.getBoundingClientRect();
          streaks(r.left + r.width / 2, r.top + r.height / 2, 5, '#7df9ff', 70);
        }, dur * f);
      });
    }

    /* ---------------- Nova: hover, takeoff, loop and landing ---------------- */
    function doTakeoff(done) {
      var D = slotInfo('nova');
      if (!D) { done(); return; }
      var W = vw(), H = vh();
      var left = state.side === 'left';
      var el = heroActor('nova', ART.nova, 'c');
      var s0 = D.h / (el.offsetHeight || 134);
      var X = function (f) { return left ? W * (1 - f) : W * f; };
      var R = function (r) { return left ? -r : r; };
      chars.nova.el.classList.add('is-away');
      flyActor(el, [
        { t: 0,    x: D.x,     y: D.y,      r: 0,        s: s0 },
        { t: 650,  x: D.x,     y: D.y - 44, r: 0,        s: s0 * 1.05 },
        { t: 1000, x: D.x,     y: D.y - 52, r: 0,        s: s0 * 1.05 },
        { t: 1650, x: X(0.66), y: H * 0.52, r: R(-38),   s: 1 },
        { t: 2300, x: X(0.30), y: H * 0.26, r: R(-78),   s: 1 },
        { t: 2800, x: X(-0.08), y: H * 0.30, r: R(-92),  s: 1 },
        { t: 3200, x: X(-0.15), y: H * 0.40, r: R(-180), s: 1 },
        { t: 3550, x: X(-0.13), y: H * 0.44, r: R(-268), s: 1 },
        { t: 4250, x: X(0.40), y: H * 0.40, r: R(-272),  s: 1 },
        { t: 4900, x: X(0.78), y: H * 0.60, r: R(-312),  s: 1 },
        { t: 5450, x: D.x,     y: D.y - 54, r: R(-360),  s: s0 },
        { t: 5900, x: D.x,     y: D.y,      r: R(-360),  s: s0 }
      ], false, function () {
        kill(el);
        chars.nova.el.classList.remove('is-away');
        ring(D.x, D.bottom - 4, '#7df9ff', 3);
        streaks(D.x, D.bottom - 8, 8, '#7df9ff', 70);
        sparkleAt('nova', 10);
        perform('nova', 'crouch');
        done();
      });
      later(function () {                         // launch shockwave
        ring(D.x, D.bottom - 4, '#7df9ff', 3.6);
        streaks(D.x, D.bottom - 8, 12, '#7df9ff', 120);
      }, 950);
    }

    /* ---------------- Weaver: web-swing ---------------- */
    // Pendulum arcs across the screen, anchored above the viewport. With o.land the last arc ends at the dock
    // and Weaver drops in with a flip.
    function doSwing(o, done) {
      var W = vw(), H = vh();
      var dir = o.dir;
      var land = o.land ? slotInfo('weaver') : null;
      if (o.land && !land) { done(); return; }
      var L = Math.min(H * 0.58, W * 1.05, 520);
      var ph = 50 * Math.PI / 180;
      var step = 2 * L * Math.sin(ph);
      var ay = -0.12 * H;
      var T = 700 + L * 0.7;
      var arcs, x0;
      if (land) {
        var tx = dir > 0 ? land.x : W - land.x;
        arcs = Math.max(1, Math.ceil((tx + 130) / step));
        x0 = tx - arcs * step;
      } else {
        arcs = Math.max(1, Math.ceil((W + 260) / step));
        x0 = -130 - (arcs * step - (W + 260)) / 2;
      }
      var total = arcs * T;

      var holder = doc.createElement('div');
      holder.innerHTML = '<svg class="pcg-rope" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<path fill="none" stroke="#8b5cf6" stroke-opacity=".35" stroke-width="5" stroke-linecap="round"/>' +
        '<path fill="none" stroke="#f1ecff" stroke-width="1.7" stroke-linecap="round"/></svg>';
      var rope = track(holder.firstChild);
      var p1 = rope.childNodes[0], p2 = rope.childNodes[1];
      var el = heroActor('weaver', ART.weaverSwing, 'h');
      if (dir < 0) el.classList.add('pcg-flip');

      var t0 = now(), rot = 0;
      function frame() {
        rafId = 0;
        var e = now() - t0;
        if (e >= total) { finish(); return; }
        var idx = Math.min(arcs - 1, Math.floor(e / T));
        var u = (e - idx * T) / T;
        var phi = -ph + 2 * ph * (0.5 - 0.5 * Math.cos(Math.PI * u));
        var ax = x0 + idx * step + L * Math.sin(ph);
        var px = ax + L * Math.sin(phi), py = ay + L * Math.cos(phi);
        var X = dir > 0 ? px : W - px, AX = dir > 0 ? ax : W - ax;
        rot += ((-(phi * 57.2958) * 0.8 * dir) - rot) * 0.22;
        el.style.transform = 'translate3d(' + X.toFixed(1) + 'px,' + py.toFixed(1) + 'px,0) rotate(' + rot.toFixed(1) + 'deg)';
        var d = 'M' + AX.toFixed(1) + ' ' + ay.toFixed(1) + 'L' + X.toFixed(1) + ' ' + py.toFixed(1);
        p1.setAttribute('d', d); p2.setAttribute('d', d);
        rope.style.opacity = Math.min(1, u * 9).toFixed(2);
        rafId = requestAnimationFrame(frame);
      }
      function finish() {
        var endU = x0 + arcs * step;
        var lastX = dir > 0 ? endU : W - endU;
        var lastY = ay + L * Math.cos(ph);
        kill(rope); kill(el);
        if (!land) { done(); return; }
        var lander = heroActor('weaver', ART.weaverDock, 'c');
        var s0 = land.h / (lander.offsetHeight || 134);
        var sy = lastY + 70;
        fxAnim(lander, [
          { transform: 'translate3d(' + lastX + 'px,' + sy + 'px,0) rotate(0deg) scale(1)' },
          { transform: 'translate3d(' + lerp(lastX, land.x, 0.6) + 'px,' + (lerp(sy, land.y, 0.5) - 40) + 'px,0) rotate(' + (dir * 200) + 'deg) scale(1)', offset: 0.55 },
          { transform: 'translate3d(' + land.x + 'px,' + land.y + 'px,0) rotate(' + (dir * 360) + 'deg) scale(' + s0 + ')' }
        ], { duration: 780, easing: 'cubic-bezier(.3,.1,.3,1)', fill: 'forwards' }, function () {
          kill(lander);
          chars.weaver.el.classList.remove('is-away');
          ring(land.x, land.bottom - 6, '#ff4fd8', 2.6);
          streaks(land.x, land.bottom - 8, 8, '#ff9bea', 70);
          sparkleAt('weaver', 8);
          perform('weaver', 'crouch');
          done();
        });
      }
      frame();
    }

    /* ---------------- lightning ---------------- */
    function doLightning(done) {
      var W = vw(), H = vh();
      var flash = mk('pcg-flash');
      // one soft decaying flash (never a strobe)
      fxAnim(flash, [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 0.3, offset: 0.35 }, { opacity: 0 }],
        { duration: 1000, easing: 'ease-out' }, function () { kill(flash); });
      var x = rand(W * 0.12, W * 0.88), segs = 9, endY = H * rand(0.32, 0.52), pts = [[x, -10]], i;
      for (i = 1; i <= segs; i++) { x += rand(-36, 36); pts.push([x, -10 + (endY + 10) * i / segs]); }
      var d = 'M' + pts.map(function (p) { return p[0].toFixed(0) + ' ' + p[1].toFixed(0); }).join('L');
      var bx = pts[4][0], by = pts[4][1];
      var d2 = 'M' + bx.toFixed(0) + ' ' + by.toFixed(0) + 'L' + (bx + rand(-70, 70)).toFixed(0) + ' ' + (by + rand(50, 90)).toFixed(0) +
        'L' + (bx + rand(-90, 90)).toFixed(0) + ' ' + (by + rand(110, 150)).toFixed(0);
      var holder = doc.createElement('div');
      holder.innerHTML = '<svg class="pcg-bolt" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="none" stroke-linejoin="round" stroke-linecap="round">' +
        '<path d="' + d + '" stroke="#8b5cf6" stroke-opacity=".35" stroke-width="9"/><path d="' + d + '" stroke="#ffffff" stroke-width="2.2"/>' +
        '<path d="' + d2 + '" stroke="#8b5cf6" stroke-opacity=".3" stroke-width="6"/><path d="' + d2 + '" stroke="#e8e0ff" stroke-width="1.4"/></svg>';
      var bolt = track(holder.firstChild);
      fxAnim(bolt, [{ opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 0.85, offset: 0.3 }, { opacity: 0 }],
        { duration: 560, easing: 'ease-out' }, function () { kill(bolt); });
      var tipX = pts[segs][0];
      later(function () { ring(tipX, endY, '#a78bfa', 3); streaks(tipX, endY, 12, '#c9b8ff', 120); }, 90);
      later(done, 1050);
    }

    /* ---------------- celebration (fireworks + flyover + web-swing) ---------------- */
    function doCelebrate(word, done) {
      var W = vw(), H = vh();
      var dir = Math.random() < 0.5 ? 1 : -1;
      var fin = par(3, done);
      wipe();
      doFly(dir, fin);
      doSwing({ dir: -dir }, fin);
      for (var i = 0; i < 5; i++) {
        (function (k) {
          later(function () {
            var x = rand(W * 0.15, W * 0.85), y = rand(H * 0.14, H * 0.5), c = pick(SPARK_COLORS);
            ring(x, y, c, 3.2);
            streaks(x, y, 12, c, 130);
            sparkle(x, y, 8, 110);
          }, 350 + k * 300);
        })(i);
      }
      later(function () { impact(W / 2, H * 0.3, word || 'WOW!'); }, 500);
      later(fin, 2600);
    }

    /* ---------------- first-visit arrival: both heroes fly / swing in ---------------- */
    function doArrive(done) {
      var left = state.side === 'left', W = vw(), H = vh();
      var dir = left ? -1 : 1;
      var N = slotInfo('nova'), WV = slotInfo('weaver');
      var list = [];
      if (N) list.push('nova');
      if (WV) list.push('weaver');
      if (!list.length) { done(); return; }
      var fin = par(list.length, done);
      list.forEach(function (id) { chars[id].el.classList.add('is-away'); });
      wipe();
      if (N) {
        var el = heroActor('nova', ART.nova, 'c');
        var s0 = N.h / (el.offsetHeight || 134);
        var X = function (f) { return left ? W * (1 - f) : W * f; };
        var R = function (r) { return left ? -r : r; };
        flyActor(el, [
          { t: 0,    x: X(-0.1), y: H * 0.08, r: R(115), s: 1 },
          { t: 1000, x: X(0.38), y: H * 0.24, r: R(112), s: 1 },
          { t: 1900, x: X(0.8),  y: H * 0.52, r: R(100), s: 1 },
          { t: 2600, x: N.x,     y: N.y - 60, r: R(20),  s: s0 },
          { t: 3150, x: N.x,     y: N.y,      r: 0,      s: s0 }
        ], false, function () {
          kill(el);
          chars.nova.el.classList.remove('is-away');
          ring(N.x, N.bottom - 4, '#7df9ff', 3);
          sparkleAt('nova', 12);
          fin();
        });
      }
      if (WV) later(function () { doSwing({ dir: dir, land: true }, fin); }, 450);
      later(restoreChars, 9000);                       // safety net: never leave a guide invisible
    }


    /* ================================================================== */
    /* Hero features: team-up, repulsor blast, web-shot, targeting scan    */
    /* ================================================================== */

    // Nova flies one way while Weaver swings the other; they "meet" in a comic burst
    function doDuo(dir, done) {
      var W = vw(), H = vh();
      var fin = par(2, done);
      doFly(dir, fin);
      doSwing({ dir: -dir }, fin);
      later(function () {
        impact(W / 2, H * 0.3, 'TEAM-UP!');
        ring(W / 2, H * 0.3, '#ff4fd8', 3.2);
        streaks(W / 2, H * 0.3, 10, null, 120);
      }, 1300);
    }

    // a point on a docked hero's art (art is 100x160, bottom-centred inside its box)
    function artPoint(id, px, py) {
      var c = chars[id];
      if (!c || !c.el.offsetWidth || c.el.classList.contains('is-away')) return null;
      var r = c.svg.getBoundingClientRect();
      var s = Math.min(r.width / 100, r.height / 160);
      return { x: r.left + (r.width - 100 * s) / 2 + px * s, y: r.bottom - 160 * s + py * s };
    }

    // Nova fires a repulsor beam from the nearest palm to (tx, ty)
    function fireRepulsor(tx, ty) {
      if (!canShow()) return false;
      var from = artPoint('nova', tx < vw() / 2 ? 23 : 77, 100);
      if (!from) return false;
      var dx = tx - from.x, dy = ty - from.y, len = Math.sqrt(dx * dx + dy * dy);
      var ang = Math.atan2(dy, dx) * 57.2958;
      var el = mk('pcg-beam', '', 'width:' + len.toFixed(0) + 'px');
      var t = 'translate(' + from.x.toFixed(1) + 'px,' + from.y.toFixed(1) + 'px) rotate(' + ang.toFixed(1) + 'deg)';
      fxAnim(el, [
        { transform: t + ' scaleX(0)', opacity: 1 },
        { transform: t + ' scaleX(1)', opacity: 1, offset: 0.22 },
        { transform: t + ' scaleX(1) scaleY(.5)', opacity: 0.85, offset: 0.55 },
        { transform: t + ' scaleX(1) scaleY(.2)', opacity: 0 }
      ], { duration: 420, easing: 'ease-out' }, function () { kill(el); });
      ring(from.x, from.y, '#7df9ff', 1.6);
      later(function () { ring(tx, ty, '#7df9ff', 2.4); streaks(tx, ty, 8, '#7df9ff', 70); }, 90);
      perform('nova', 'blast');
      return true;
    }

    // Weaver shoots a web line that snaps onto (tx, ty) and leaves a small web splat
    function webShot(tx, ty) {
      if (!canShow()) return false;
      var w = slotInfo('weaver');
      if (!w) return false;
      var right = tx > w.x;
      var from = artPoint('weaver', right ? 71 : 29, right ? 73 : 77);
      if (!from) return false;
      var mx = (from.x + tx) / 2, my = (from.y + ty) / 2;
      var nx = -(ty - from.y), ny = tx - from.x, nl = Math.sqrt(nx * nx + ny * ny) || 1;
      var cx = mx + nx / nl * 26, cy = my + ny / nl * 26;
      var d = 'M' + from.x.toFixed(1) + ' ' + from.y.toFixed(1) + 'Q' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + tx.toFixed(1) + ' ' + ty.toFixed(1);
      var spokes = '', i, a;
      for (i = 0; i < 6; i++) {
        a = i * 60 * Math.PI / 180;
        spokes += '<line x1="' + tx.toFixed(1) + '" y1="' + ty.toFixed(1) + '" x2="' + (tx + Math.cos(a) * 17).toFixed(1) + '" y2="' + (ty + Math.sin(a) * 17).toFixed(1) + '"/>';
      }
      var ringPts = [];
      for (i = 0; i < 6; i++) { a = (i * 60 + 30) * Math.PI / 180; ringPts.push((tx + Math.cos(a) * 9).toFixed(1) + ',' + (ty + Math.sin(a) * 9).toFixed(1)); }
      var holder = doc.createElement('div');
      holder.innerHTML = '<svg class="pcg-web" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
        '<path class="g" d="' + d + '" pathLength="1" stroke="#8b5cf6" stroke-opacity=".35" stroke-width="5" stroke-dasharray="1" stroke-dashoffset="1"/>' +
        '<path class="c" d="' + d + '" pathLength="1" stroke="#f1ecff" stroke-width="1.6" stroke-dasharray="1" stroke-dashoffset="1"/>' +
        '<g class="s" stroke="#f1ecff" stroke-width="1.3" opacity="0">' + spokes + '<polygon points="' + ringPts.join(' ') + '"/></g></svg>';
      var svg = track(holder.firstChild);
      fxAnim(svg, [{ opacity: 1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: 1150, easing: 'linear' }, function () { kill(svg); });
      ['.g', '.c'].forEach(function (sel) {
        fxAnim($(sel, svg), [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 230, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
      });
      fxAnim($('.s', svg), [{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay: 200, fill: 'forwards' });
      later(function () { ring(tx, ty, '#ff9bea', 1.8); streaks(tx, ty, 5, '#ff9bea', 50); }, 220);
      perform('weaver', 'crouch');
      return true;
    }

    // Nova's targeting HUD locks onto a card: corner brackets plus a sweeping scan line
    function scanCard(card) {
      if (!canShow() || chars.nova.el.classList.contains('is-away')) return false;
      var r = card.getBoundingClientRect();
      if (r.width < 40 || r.height < 30 || r.bottom < 0 || r.top > vh()) return false;
      var el = mk('pcg-scan', '<i></i><i></i><i></i><i></i><b></b>',
        'left:' + r.left.toFixed(0) + 'px;top:' + r.top.toFixed(0) + 'px;width:' + r.width.toFixed(0) + 'px;height:' + r.height.toFixed(0) + 'px');
      fxAnim(el, [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 1100, easing: 'ease-out' }, function () { kill(el); });
      fxAnim($('b', el), [{ transform: 'translateY(0)' }, { transform: 'translateY(' + r.height.toFixed(0) + 'px)' }], { duration: 900, easing: 'ease-in-out' });
      perform('nova', 'scan');
      return true;
    }

    /* ---------------- show starters ---------------- */
    function startFly(dir) { return run('fly', function (done) { doFly(dir, done); }); }
    function startSwing(dir) { return run('swing', function (done) { doSwing({ dir: dir }, done); }); }
    function startLightning() { return run('storm', doLightning); }
    function startTakeoff() { return run('takeoff', doTakeoff); }
    function startCelebrate(word) { return run('celebrate', function (done) { doCelebrate(word, done); }); }
    function startArrive() { return run('arrive', doArrive); }
    function startDuo(dir) { return run('duo', function (done) { doDuo(dir, done); }); }
    function startTeamUp() {
      var dir = Math.random() < 0.5 ? 1 : -1;
      return run('team', function (done) { wipe(); doDuo(dir, done); });
    }
    function startWeaverTrip() {
      if (!slotInfo('weaver')) return false;
      return run('trip', function (done) {
        chars.weaver.el.classList.add('is-away');
        doSwing({ dir: state.side === 'left' ? -1 : 1, land: true }, done);
      });
    }

    // which show introduces which section
    var INTRO = { about: 'swing', skills: 'fly', projects: 'duo', experience: 'swing', contact: 'duo' };
    function introSection(sec) {
      var dir = scrollDir >= 0 ? 1 : -1;
      return run('intro', function (done) {
        wipe();
        titleCard(sec);
        var k = INTRO[sec.key] || 'fly';
        if (k === 'swing') doSwing({ dir: dir }, done);
        else if (k === 'duo') doDuo(dir, done);
        else doFly(dir, done);
      });
    }

    /* ---- guided tour ---- */
    var tour = { on: false, i: 0 };
    var steps = [];

    function scrollToEl(el) {
      var behavior = mqReduce.matches ? 'auto' : 'smooth';
      try { el.scrollIntoView({ behavior: behavior, block: 'start' }); }
      catch (e) { el.scrollIntoView(true); }
    }
    function scrollToY(y) {
      var behavior = mqReduce.matches ? 'auto' : 'smooth';
      try { win.scrollTo({ top: y, behavior: behavior }); } catch (e) { win.scrollTo(0, y); }
    }

    function buildSteps() {
      var s = [];
      s.push({
        kind: 'intro', who: 'nova', act: 'hover',
        text: function () {
          return 'I\u2019m Nova, and this is my partner Weaver. We\u2019ll show you around ' + place +
            ' in about a minute. Use Next or the \u2190 \u2192 keys, and skip any time.';
        }
      });

      var WHO = { about: 'nova', skills: 'weaver', projects: 'weaver', experience: 'nova', contact: 'weaver' };
      var ACT = { about: 'flex', skills: 'flip', projects: 'crouch', experience: 'blast', contact: 'hang' };

      sections.forEach(function (sec) {
        var el = sec.el;
        var text;
        if (sec.key === 'about') {
          text = function () { return 'This is the About section: the story of the person behind everything you\u2019re seeing.'; };
        } else if (sec.key === 'skills') {
          text = function () {
            var n = count(el, ['.skill-cat', '.skill-card', '.skill-group', '.skill-category']);
            var bars = count(el, ['.skill-fill', '.skill-bar']) > 0;
            return 'Skills! ' + (n ? 'I found ' + n + ' skill groups here, each with its own focus.' : 'Everything here is grouped so it\u2019s easy to scan.') +
              (bars ? ' Scroll slowly and watch the bars fill up.' : '');
          };
        } else if (sec.key === 'projects') {
          text = function () {
            var n = count(el, ['.project-card', '.project', '[data-cat]']);
            var filters = count(el, ['.filter-btn', 'button[data-filter]']) > 1;
            return 'Projects! ' + (n ? 'There are ' + n + ' to explore. ' : 'Plenty to explore. ') +
              (filters ? 'Use the filter buttons to narrow them down, and ' : 'Take your time, and ') + 'hover a card for a closer look.';
          };
        } else if (sec.key === 'experience') {
          text = function () {
            var n = count(el, ['.exp-card', '.experience-item', '.experience-card']);
            return 'Experience: ' + (n ? n + ' entries covering' : 'covering') + ' the roles and responsibilities behind those skills.';
          };
        } else {
          text = function () {
            var form = count(el, ['form', '.contact-form']) > 0;
            return 'Last stop: Contact! ' + (form ? 'Use the form or the links here to say hello.' : 'Here are the ways to say hello.');
          };
        }
        s.push({ kind: 'section', key: sec.key, el: el, sec: sec, who: WHO[sec.key], act: ACT[sec.key], text: text });
      });

      s.push({
        kind: 'outro', who: 'nova', act: 'hover',
        text: function () { return 'That\u2019s the tour! Replay it any time with the compass button. Thanks for dropping by.'; }
      });
      return s;
    }

    function updateTourBtn() {
      btnTour.innerHTML = tour.on ? ICON.stop : ICON.tour;
      var label = tour.on ? 'Stop guided tour' : 'Start guided tour';
      btnTour.setAttribute('aria-label', label);
      btnTour.title = label;
    }

    function goStep(i) {
      tour.i = clamp(i, 0, steps.length - 1);
      var s = steps[tour.i];
      var n = steps.length;
      var last = tour.i === n - 1;

      if (s.kind === 'section') scrollToEl(s.el);
      else if (s.kind === 'intro' && win.scrollY > 40) scrollToY(0);

      var actions = [];
      if (tour.i > 0) actions.push({ label: 'Back', onClick: function () { goStep(tour.i - 1); } });
      actions.push({
        label: last ? 'Finish' : 'Next', primary: true, focus: true,
        onClick: function () { if (last) endTour(true); else goStep(tour.i + 1); }
      });
      if (!last) actions.push({ label: 'Skip tour', quiet: true, onClick: function () { endTour(false); } });

      speak({
        who: s.who, kind: 'tour', text: s.text(),
        step: (tour.i + 1) + ' / ' + n, dots: { n: n, i: tour.i }, actions: actions
      });
      perform(s.who, s.act, { happy: true });
      setTimeout(function () { if (tour.on) sparkleAt(s.who, 9); }, 350);

      // cinematic beat for each stop (skipped automatically when effects are off or motion is reduced)
      if (canShow()) {
        stopShow();
        if (s.kind === 'section') introSection(s.sec);
        else if (s.kind === 'intro') { wipe(); startFly(1); }
        else startCelebrate('THE END!');
      }
    }

    function startTour() {
      if (!steps.length || state.hidden) return;
      closeBubble('replace');
      tour.on = true;
      tour.i = 0;
      app.classList.add('is-touring');
      updateTourBtn();
      goStep(0);
    }

    function endTour(done) {
      if (!tour.on) return;
      tour.on = false;
      app.classList.remove('is-touring');
      closeBubble('tour-end');
      updateTourBtn();
      if (done) {
        store.set('tour', '1');
        cheerAll();
        speak({ who: 'weaver', kind: 'quip', ttl: 5200, text: 'Thanks for touring with us! Explore freely. We\u2019ll stay out of your way.' });
      } else {
        emote('nova', '\u2726');
        announce('Tour skipped.');
      }
    }

    /* ---- section awareness: gentle tips + cinematic introductions ---- */
    var TIP_WHO = { about: 'nova', skills: 'weaver', projects: 'weaver', experience: 'nova', contact: 'weaver' };
    var TIP_TEXT = {
      about: function () { return 'Quick intro time. This is where you get to know who built all this.'; },
      skills: function () { return 'Skills ahead! Everything is grouped so it\u2019s easy to scan.'; },
      projects: function (el) {
        var n = count(el, ['.project-card', '.project', '[data-cat]']);
        var filters = count(el, ['.filter-btn', 'button[data-filter]']) > 1;
        return (n ? n + ' projects to explore. ' : 'Projects ahead! ') + (filters ? 'Try the filter buttons to narrow things down.' : 'Take your time.');
      },
      experience: function () { return 'Experience: the roles and responsibilities behind the skills.'; },
      contact: function () { return 'You made it to the end! If you\u2019d like to get in touch, this is the spot.'; }
    };
    var curKey = null;
    var dwellT = 0, introT = 0;
    var tipsShown = {}, introDone = {};
    var tipCount = 0;
    var lastTip = -1e9;
    var lastFast = -1e9;           // last time the visitor scrolled very quickly

    function maybeTip(sec) {
      if (state.muted || state.hidden || tour.on || doc.hidden) return;
      if (tipsShown[sec.key] || tipCount >= 4) return;
      if (now() - lastTip < 14000) return;
      if (curKey !== sec.key) return;
      if (bubbleOpen() && (PRI[bubbleKind()] || 0) >= PRI.tip) return;
      var who = TIP_WHO[sec.key];
      var ok = speak({ who: who, kind: 'tip', auto: true, ttl: 7500, text: TIP_TEXT[sec.key](sec.el) });
      if (ok) {
        tipsShown[sec.key] = true;
        tipCount++;
        lastTip = now();
        perform(who, 'hop', { happy: true });
      }
    }

    function maybeIntro(sec, tries) {
      tries = tries || 0;
      if (introDone[sec.key] || curKey !== sec.key || tour.on || state.hidden) return;
      // still scrolling fast, or another show is running: look again shortly (a few times at most)
      if (showing || !canShow() || now() - lastFast < 900 || now() - lastShowEnd < 4000) {
        if (tries < 8) { clearTimeout(introT); introT = setTimeout(function () { maybeIntro(sec, tries + 1); }, 800); }
        return;
      }
      if (introSection(sec)) introDone[sec.key] = true;
    }

    function onSectionEnter(sec) {
      if (curKey === sec.key) return;
      curKey = sec.key;
      if (bubbleKind() === 'tip') closeBubble('auto');
      clearTimeout(dwellT);
      clearTimeout(introT);
      dwellT = setTimeout(function () { maybeTip(sec); }, 1500);
      introT = setTimeout(function () { maybeIntro(sec); }, 700);
    }

    if ('IntersectionObserver' in win && sections.length) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          for (var i = 0; i < sections.length; i++) {
            if (sections[i].el === e.target) { onSectionEnter(sections[i]); break; }
          }
        });
      }, { rootMargin: '-40% 0px -50% 0px', threshold: 0 });
      sections.forEach(function (s) { io.observe(s.el); });
    }

    /* ---- hide / show / side ---- */
    function setHidden(h) {
      state.hidden = h;
      store.set('hidden', h ? '1' : '0');
      if (h) {
        if (tour.on) { tour.on = false; app.classList.remove('is-touring'); updateTourBtn(); }
        stopShow();
        closeBubble('hide');
        app.classList.add('is-off');
        announce('Guides hidden. Use the sparkle button to bring them back.');
        stopLoops();
      } else {
        app.classList.remove('is-off');
        ORDER.forEach(function (id) { enter(chars[id].el); });
        setTimeout(function () {
          perform('nova', 'hover', { happy: true });
          sparkleAt('nova', 8); sparkleAt('weaver', 8);
        }, 500);
        announce('Guides are back.');
        startLoops();
      }
      btnHide.setAttribute('aria-expanded', h ? 'false' : 'true');
    }

    function setSide(side) {
      state.side = side;
      store.set('side', side);
      app.setAttribute('data-side', side);
      if (bubbleOpen()) setTimeout(function () { placeTail(speakerId); }, 30);
    }

    /* ---- controls ---- */
    btnTour.addEventListener('click', function () { if (tour.on) endTour(false); else startTour(); });
    btnTeam.addEventListener('click', function () {
      if (tour.on) return;
      if (showing) stopShow();
      if (startTeamUp()) {
        emote('nova', '\u2726'); emote('weaver', '\u2726');
        perform('nova', 'flex', { happy: true }); perform('weaver', 'flip', { happy: true });
      } else {
        // effects off or reduced motion: still give a little team moment, without the flybys
        cheerAll();
        perform('nova', 'blast'); perform('weaver', 'hang');
        speak({ who: 'nova', kind: 'quip', ttl: 5200, text: 'The full team-up show needs cinematic effects. Turn them on with the bolt button.' });
      }
    });
    btnMute.addEventListener('click', function () { setMuted(!state.muted, false); });
    btnFx.addEventListener('click', function () { setFx(!state.fx); });
    btnSide.addEventListener('click', function () { stopShow(); setSide(state.side === 'right' ? 'left' : 'right'); });
    btnHide.addEventListener('click', function () { setHidden(true); setTimeout(function () { try { btnLaunch.focus({ preventScroll: true }); } catch (e) {} }, 60); });
    btnLaunch.addEventListener('click', function () { setHidden(false); setTimeout(function () { try { chars.nova.hit.focus({ preventScroll: true }); } catch (e) {} }, 80); });

    /* ---- character interactions ---- */
    var rapidWarned = false;
    ORDER.forEach(function (id) {
      var c = chars[id];
      c.hit.addEventListener('pointerenter', function () {
        c.el.classList.add('is-hover');
        if (canAnimate()) emote(id, pick(['\u2726', '\u2665', '\u266a']));
      });
      c.hit.addEventListener('pointerleave', function () { c.el.classList.remove('is-hover'); });
      c.hit.addEventListener('focus', function () { c.el.classList.add('is-hover'); });
      c.hit.addEventListener('blur', function () { c.el.classList.remove('is-hover'); });
      c.hit.addEventListener('click', function () { react(id); });
    });

    function react(id) {
      var c = chars[id];
      var t = now();
      c.clicks = c.clicks.filter(function (x) { return t - x < 3000; });
      c.clicks.push(t);
      var started = false;

      if (!tour.on) {
        // each hero has a signature move
        if (id === 'nova') started = startTakeoff();              // hover, take off, loop across the screen, land
        else started = startWeaverTrip();                         // swing away and drop back in with a flip
      }
      if (!started) {
        perform(id, pick(CHARS[id].click), { happy: true });
        sparkleAt(id, 9);
      }
      emote(id, pick(['\u2665', '\u2726', '\u266a']));
      if (tour.on || started) return;
      if (c.clicks.length >= 5 && !rapidWarned) {
        rapidWarned = true;
        speak({ who: id, kind: 'quip', ttl: 5200, text: 'Okay, okay, I\u2019m dizzy! If we\u2019re ever in the way, the \u2715 button hides us.' });
        return;
      }
      speak({ who: id, kind: 'quip', ttl: 3800, text: pick(CHARS[id].quips) });
    }

    /* ---- eyes follow the cursor, dock leans toward it ---- */
    var mx = 0, my = 0, lastPointer = 0, gazeRaf = 0;

    function look(c, dx, dy) {
      var m = c.gaze;
      var tx = (dx * m).toFixed(2), ty = (dy * m * 0.8).toFixed(2);
      c.pupils.forEach(function (p) { p.style.transform = 'translate(' + tx + 'px,' + ty + 'px)'; });
    }

    function updateGaze() {
      gazeRaf = 0;
      if (state.hidden) return;
      ORDER.forEach(function (id) {
        var c = chars[id];
        if (!c.el.offsetWidth || !c.pupils.length) return;
        var r = c.svg.getBoundingClientRect();
        var cx = r.left + r.width / 2, cy = r.top + r.height * 0.2;
        look(c, clamp((mx - cx) / 220, -1, 1), clamp((my - cy) / 220, -1, 1));
      });
      var ar = app.getBoundingClientRect();
      app.style.setProperty('--lx', clamp((mx - (ar.left + ar.width / 2)) / 400, -1, 1).toFixed(2));
      app.style.setProperty('--ly', clamp((my - (ar.top + ar.height / 2)) / 400, -1, 1).toFixed(2));
    }

    win.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      mx = e.clientX; my = e.clientY; lastPointer = now();
      if (!gazeRaf) gazeRaf = requestAnimationFrame(updateGaze);
    }, { passive: true });

    /* ---- react to things happening on the page ---- */
    var impactCool = 0, shotCool = 0, scanCool = 0;
    doc.addEventListener('click', function (e) {
      if (state.hidden || !e.target || !e.target.closest) return;
      var t = e.target;
      if (t.closest('.pcg-app')) return;
      var px = e.clientX || win.innerWidth / 2, py = e.clientY || win.innerHeight / 2;
      var shot = canShow() && now() - shotCool > 900;
      if (t.closest('.theme-btn, #themeToggle')) {
        emote('weaver', '\u25d0');
        if (shot) { shotCool = now(); webShot(px, py); } else perform('weaver', 'hop', { happy: true });
      }
      else if (t.closest('.form-submit')) { cheerAll(); startCelebrate('SENT!'); }
      else if (t.closest('.filter-btn')) {
        emote('weaver', '!');
        if (shot) { shotCool = now(); webShot(px, py); } else perform('weaver', 'crouch');
      }
      else if (t.closest('.btn, .project-link, .cert-verify')) {
        emote('nova', '\u2726');
        if (shot) { shotCool = now(); fireRepulsor(px, py); } else perform('nova', 'flex', { happy: true });
        if (canShow() && now() - impactCool > 6000) { impactCool = now(); impact(clamp(px + 70, 80, win.innerWidth - 80), clamp(py - 56, 80, win.innerHeight - 80), 'ZAP!'); }
      }
      else if (t.closest('.nav-links a, .mobile-menu a, .footer-links a')) {
        emote('weaver', '\u266a');
        if (shot) { shotCool = now(); webShot(px, py); } else perform('weaver', 'zip');
      }
    });

    // celebrate project exploration: a cheer after 3 cards, a full show after all of them
    var seenCards = [], cheered = false, celebrated = false;
    function noteCard(card) {
      if (seenCards.indexOf(card) > -1) return;
      seenCards.push(card);
      if (!tour.on && canShow() && now() - scanCool > 1800) { scanCool = now(); scanCard(card); }   // Nova's targeting HUD
      var total = $$('.project-card').length;
      if (!celebrated && total >= 2 && seenCards.length >= Math.min(total, 8)) {
        celebrated = true; cheered = true;
        cheerAll();
        startCelebrate('NICE!');
        speak({ who: 'nova', kind: 'quip', auto: true, ttl: 5200, text: 'You explored the projects. Nice! Contact is just below if something sparked an idea.' });
      } else if (!cheered && seenCards.length >= 3 && total > 3) {
        cheered = true;
        var r = card.getBoundingClientRect();
        impact(mqCompact.matches ? r.left + r.width / 2 : clamp(mx || r.right, 60, win.innerWidth - 60), clamp(my || r.top + 40, 60, win.innerHeight - 60), 'NICE!');
        perform('weaver', 'flip', { happy: true });
        emote('weaver', '\u2665');
      }
    }

    var cardCool = 0;
    doc.addEventListener('pointerover', function (e) {
      if (state.hidden || tour.on || !e.target || !e.target.closest) return;
      var card = e.target.closest('.project-card');
      if (!card) return;
      noteCard(card);
      if (now() - cardCool > 8000) {
        cardCool = now();
        emote('weaver', '!');
        perform('weaver', 'crouch');
      }
    }, { passive: true });
    doc.addEventListener('focusin', function (e) {
      if (state.hidden || !e.target || !e.target.closest) return;
      var card = e.target.closest('.project-card');
      if (card) noteCard(card);
    });

    /* ---- scroll reactions: Nova boosts, very fast scrolls trigger a flyover ---- */
    var lastY = win.scrollY, lastT = now(), boostT = 0, idleScrollT = 0, reachedEnd = false, lastDash = -1e9;
    win.addEventListener('scroll', function () {
      var y = win.scrollY, t = now();
      var v = Math.abs(y - lastY) / Math.max(t - lastT, 1);
      if (y !== lastY) scrollDir = y > lastY ? 1 : -1;
      lastY = y; lastT = t;
      if (state.hidden) return;
      app.classList.add('is-scrolling');
      clearTimeout(idleScrollT);
      idleScrollT = setTimeout(function () { app.classList.remove('is-scrolling'); }, 700);
      if (v > 1.4 && !tour.on && canShow()) {
        lastFast = t;
        chars.nova.el.classList.add('is-boost');
        clearTimeout(boostT);
        boostT = setTimeout(function () {
          chars.nova.el.classList.remove('is-boost');
        }, 700);
        if (v > 2.4 && t - lastDash > 22000 && !showing) {
          lastDash = t;
          startFly(scrollDir);
        }
      }
      if (!reachedEnd && y + win.innerHeight >= doc.documentElement.scrollHeight - 60) {
        reachedEnd = true;
        if (canAnimate()) { if (!startCelebrate('YOU MADE IT!')) cheerAll(); }
      }
    }, { passive: true });

    /* ---- keyboard: Esc closes, arrows drive the tour ---- */
    function inField(t) {
      return t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
    }
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (tour.on) { endTour(false); return; }
        if (showing) { stopShow(); return; }
        if (bubbleOpen()) closeBubble('dismiss-soft');
        return;
      }
      if (!tour.on || e.altKey || e.ctrlKey || e.metaKey || inField(e.target)) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (tour.i === steps.length - 1) endTour(true); else goStep(tour.i + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (tour.i > 0) goStep(tour.i - 1);
      }
    });

    /* ---- idle life: wandering, gaze drift, little performances, occasional cinematic moments ---- */
    var wanderT = 0, gazeT = 0, idleT = 0, ambientT = 0, ambientCount = 0;

    function wander() {
      clearTimeout(wanderT);
      if (!canAnimate()) return;
      wanderT = setTimeout(function () {
        if (canAnimate() && !mqCompact.matches) {
          var c = chars[pick(['nova', 'weaver'])];
          c.el.style.setProperty('--dx', rand(-10, 10).toFixed(1) + 'px');
          c.el.style.setProperty('--dy', rand(-8, 0).toFixed(1) + 'px');
        }
        wander();
      }, rand(2800, 5600));
    }

    function driftGaze() {
      clearTimeout(gazeT);
      if (!canAnimate()) return;
      gazeT = setTimeout(function () {
        if (canAnimate() && now() - lastPointer > 3500) {
          ORDER.forEach(function (id) { look(chars[id], rand(-0.8, 0.8), rand(-0.6, 0.6)); });
        }
        driftGaze();
      }, rand(2200, 4500));
    }

    function idle() {
      clearTimeout(idleT);
      if (!canAnimate()) return;
      idleT = setTimeout(function () {
        if (canAnimate() && !tour.on && !bubbleOpen() && !app.classList.contains('is-scrolling')) {
          var id = pick(ORDER);
          if (chars[id].el.offsetWidth) perform(id, pick(CHARS[id].idle));
        }
        idle();
      }, rand(9000, 17000));
    }

    // rare, brief, never during a tour or while the visitor is scrolling
    function ambient() {
      clearTimeout(ambientT);
      if (!canShow()) return;
      ambientT = setTimeout(function () {
        if (canShow() && !tour.on && !showing && ambientCount < AMBIENT_MAX &&
            !app.classList.contains('is-scrolling') && now() - lastShowEnd > 8000 && now() - lastFast > 2500) {
          ambientCount++;
          var dir = Math.random() < 0.5 ? 1 : -1, r = Math.random();
          if (r < 0.34) startFly(dir);
          else if (r < 0.68) startSwing(dir);
          else if (r < 0.84) startDuo(dir);
          else if (INTENSITY !== 'calm') startLightning();
          else startFly(dir);
        }
        ambient();
      }, rand(16000, 32000) * PACE);
    }

    function startLoops() { wander(); driftGaze(); idle(); ambient(); }
    function stopLoops() { clearTimeout(wanderT); clearTimeout(gazeT); clearTimeout(idleT); clearTimeout(ambientT); }

    doc.addEventListener('visibilitychange', function () {
      if (doc.hidden) { stopLoops(); stopShow(); } else if (!state.hidden) startLoops();
    });
    onMQ(mqReduce, function () { if (mqReduce.matches) { stopLoops(); stopShow(); } else if (!state.hidden) startLoops(); });
    onMQ(mqCompact, applyCompact);
    win.addEventListener('resize', function () { if (bubbleOpen()) placeTail(speakerId); });

    /* ---- go ---- */
    steps = buildSteps();
    if (!sections.length) { btnTour.hidden = true; }
    setActive('nova');
    applyCompact();
    updateTourBtn();
    syncMuteBtn();
    syncFxBtn();
    btnHide.setAttribute('aria-expanded', state.hidden ? 'false' : 'true');

    function whenShowEnds(cb) {
      var tries = 0;
      (function poll() {
        if (!showing || ++tries > 40) cb(); else setTimeout(poll, 300);
      })();
    }

    function greet() {
      if (state.hidden || tour.on || win.scrollY > 500) return;
      store.set('seen', '1');
      var actions = [];
      if (sections.length) {
        actions.push({ label: 'Start the tour', primary: true, focus: false, onClick: function () { startTour(); } });
        actions.push({ label: 'Maybe later', quiet: true, onClick: function () { closeBubble('dismiss-soft'); emote('nova', '\u2726'); } });
      }
      speak({
        who: 'nova', kind: 'greet', auto: true, ttl: sections.length ? 14000 : 7000, actions: actions,
        text: 'Hi there! I\u2019m Nova, and this is Weaver. Welcome to ' + place + (sections.length ? ' \u2014 want a quick guided tour?' : '!')
      });
      perform('nova', 'hover', { happy: true });
      sparkleAt('nova', 8);
    }

    if (state.hidden) {
      app.classList.add('is-off');
    } else {
      startLoops();
      var seen = store.get('seen') === '1';
      if (!seen) {
        // First visit: the crew arrives (fly-in, web-swing, drive-in), then a polite hello with a clear way to decline.
        setTimeout(function () {
          if (state.hidden || tour.on || win.scrollY > 500) return;
          if (startArrive()) whenShowEnds(function () { setTimeout(greet, 400); });
          else greet();
        }, 1200);
      } else {
        // Returning visitor: just a friendly hover, no talking.
        setTimeout(function () { if (!state.hidden && canAnimate()) perform('nova', 'hover', { happy: true }); }, 1400);
      }
    }
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
