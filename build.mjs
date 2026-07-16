#!/usr/bin/env node
// build.mjs — regenerate the deployable bundle (index.html) from source.
//
// Source of truth:
//   • "Iterative Knowledge OS.dc.html"  — the Design Component (all state + renderers)
//   • support.js                        — the DC runtime
//
// index.html is a self-contained bundle: a JSON template + a manifest of
// gzip+base64 assets (support.js + 55 self-hosted woff2 fonts), unpacked to
// blob URLs by the loader at runtime. This script reproduces the two transforms
// the original bundler applied to the source, WITHOUT re-fetching fonts:
//
//   1. <script src="./support.js"> → <script src="{support-uuid}">
//   2. the source <helmet> keeps its current styles while its external
//      Google-Fonts links are replaced by the bundle's @font-face rules.
//
// It also re-gzips the current support.js into the manifest so runtime edits ship.
//
// Fonts are treated as frozen. If you add/remove a font family in the source,
// this incremental rebuild can't self-host the new file — re-run the full DC
// bundler for that. For everything else (component logic, renderers, styles),
// `node build.mjs` is all you need before `vercel deploy`.

import fs from 'fs';
import zlib from 'zlib';

const DC = 'Iterative Knowledge OS.dc.html';
const SUPPORT = 'support.js';
const OUT = 'index.html';

const die = (msg) => { console.error('✗ ' + msg); process.exit(1); };

const dc = fs.readFileSync(DC, 'utf8');
const support = fs.readFileSync(SUPPORT);
const html = fs.readFileSync(OUT, 'utf8');

// --- pull the current template + manifest out of the existing bundle ---
const tplTag = html.match(/(<script type="__bundler\/template">)([\s\S]*?)(<\/script>)/);
const manTag = html.match(/(<script type="__bundler\/manifest">)([\s\S]*?)(<\/script>)/);
if (!tplTag) die('no __bundler/template tag in ' + OUT);
if (!manTag) die('no __bundler/manifest tag in ' + OUT);

const oldTemplate = JSON.parse(tplTag[2]);
const manifest = JSON.parse(manTag[2]);

// support.js is the only text/javascript asset in the manifest
const supportUuid = Object.keys(manifest).find((k) => manifest[k].mime === 'text/javascript');
if (!supportUuid) die('could not find the support.js asset (text/javascript) in the manifest');

// The old bundled helmet contains frozen self-hosted font faces plus an old
// source stylesheet. Keep only the font faces so new source CSS ships.
const helmetRe = /<helmet>[\s\S]*?<\/helmet>/;
const injectedHelmet = (oldTemplate.match(helmetRe) || [])[0];
if (!injectedHelmet) die('could not find <helmet> block in the bundled template');
if (!helmetRe.test(dc)) die('could not find <helmet> block in the source ' + DC);
const sourceHelmet = dc.match(helmetRe)[0];
const fontFaceStyles = (injectedHelmet.match(/<style>[\s\S]*?<\/style>/g) || []).filter(style => style.includes('@font-face')).join('\n');
if (!fontFaceStyles) die('could not find bundled @font-face rules in the existing helmet');
const newHelmet = sourceHelmet
  .replace(/<link[^>]+href=["'][^"']*fonts\.(?:googleapis|gstatic)\.com[^"']*["'][^>]*>\s*/g, '')
  .replace('</helmet>', fontFaceStyles + '</helmet>');

const supportTag = '<script src="./support.js"></script>';
if (!dc.includes(supportTag)) die('source ' + DC + ' does not reference ' + supportTag);

// --- transform source → template ---
const newTemplate = dc
  .replace(supportTag, '<script src="' + supportUuid + '"></script>')
  .replace(helmetRe, () => newHelmet);

// --- refresh support.js in the manifest (gzip → base64) so runtime edits ship ---
manifest[supportUuid] = { ...manifest[supportUuid], compressed: true, data: zlib.gzipSync(support).toString('base64') };

// Embed as JSON inside <script> tags. The parser must not see a literal "</",
// so escape every "</" as "</" (JSON.parse restores it) — exactly the
// scheme the original bundle uses.
const embed = (obj) => JSON.stringify(obj).replace(/<\//g, '<\\u002F');

let out = html
  .replace(/(<script type="__bundler\/template">)[\s\S]*?(<\/script>)/, (_m, a, b) => a + embed(newTemplate) + b)
  .replace(/(<script type="__bundler\/manifest">)[\s\S]*?(<\/script>)/, (_m, a, b) => a + '\n' + embed(manifest) + '\n' + b);

// --- ensure the PWA wiring in the shell (idempotent; the shell persists across builds) ---
// manifest + icons + SW registration make the deploy installable (manifest.webmanifest,
// sw.js, icons/ live at the repo root — regenerate icons with scripts/make-icons.mjs).
if (!out.includes('rel="manifest"')) {
  const pwaHead = [
    '  <meta name="theme-color" content="#0c0f14">',
    '  <link rel="manifest" href="/manifest.webmanifest">',
    '  <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png">',
    '  <link rel="apple-touch-icon" href="/icons/icon-180.png">',
    '  <meta name="apple-mobile-web-app-capable" content="yes">',
    '  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
    '  <meta name="apple-mobile-web-app-title" content="IKOS">',
    "  <script>if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost')) addEventListener('load', ()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));</script>",
  ].join('\n');
  const headEnd = out.indexOf('</head>'); // first literal </head> is the shell's — the embedded JSON escapes every "</"
  if (headEnd === -1) die('no </head> in ' + OUT + ' shell');
  out = out.slice(0, headEnd) + pwaHead + '\n' + out.slice(headEnd);
}

fs.writeFileSync(OUT, out);

// --- self-check: the bundle we just wrote must round-trip ---
const check = fs.readFileSync(OUT, 'utf8');
const rtTpl = JSON.parse(check.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
const rtMan = JSON.parse(check.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
zlib.gunzipSync(Buffer.from(rtMan[supportUuid].data, 'base64')); // throws if corrupt
if (!rtTpl.includes('flyToOrbit') && dc.includes('flyToOrbit')) die('template round-trip lost content');

console.log('✓ built ' + OUT);
console.log('  template: ' + newTemplate.length.toLocaleString() + ' chars  ·  assets: ' + Object.keys(manifest).length + '  ·  support.js: ' + support.length.toLocaleString() + ' bytes');
