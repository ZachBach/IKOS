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
//   2. the source <helmet> (external Google-Fonts <link>s) is swapped for the
//      bundle's <helmet> (injected @font-face rules pointing at the font uuids).
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

// the font <helmet> injected by the bundler (contains @font-face → font uuids)
const helmetRe = /<helmet>[\s\S]*?<\/helmet>/;
const injectedHelmet = (oldTemplate.match(helmetRe) || [])[0];
if (!injectedHelmet) die('could not find <helmet> block in the bundled template');
if (!helmetRe.test(dc)) die('could not find <helmet> block in the source ' + DC);

const supportTag = '<script src="./support.js"></script>';
if (!dc.includes(supportTag)) die('source ' + DC + ' does not reference ' + supportTag);

// --- transform source → template ---
const newTemplate = dc
  .replace(supportTag, '<script src="' + supportUuid + '"></script>')
  .replace(helmetRe, () => injectedHelmet);

// --- refresh support.js in the manifest (gzip → base64) so runtime edits ship ---
manifest[supportUuid] = { ...manifest[supportUuid], compressed: true, data: zlib.gzipSync(support).toString('base64') };

// Embed as JSON inside <script> tags. The parser must not see a literal "</",
// so escape every "</" as "</" (JSON.parse restores it) — exactly the
// scheme the original bundle uses.
const embed = (obj) => JSON.stringify(obj).replace(/<\//g, '<\\u002F');

let out = html
  .replace(/(<script type="__bundler\/template">)[\s\S]*?(<\/script>)/, (_m, a, b) => a + embed(newTemplate) + b)
  .replace(/(<script type="__bundler\/manifest">)[\s\S]*?(<\/script>)/, (_m, a, b) => a + '\n' + embed(manifest) + '\n' + b);

fs.writeFileSync(OUT, out);

// --- self-check: the bundle we just wrote must round-trip ---
const check = fs.readFileSync(OUT, 'utf8');
const rtTpl = JSON.parse(check.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
const rtMan = JSON.parse(check.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
zlib.gunzipSync(Buffer.from(rtMan[supportUuid].data, 'base64')); // throws if corrupt
if (!rtTpl.includes('flyToOrbit') && dc.includes('flyToOrbit')) die('template round-trip lost content');

console.log('✓ built ' + OUT);
console.log('  template: ' + newTemplate.length.toLocaleString() + ' chars  ·  assets: ' + Object.keys(manifest).length + '  ·  support.js: ' + support.length.toLocaleString() + ' bytes');
