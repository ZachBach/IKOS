#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

const INDEX = 'index.html';

const html = fs.readFileSync(INDEX, 'utf8');
const templateTag = html.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/);
if (!templateTag) {
  throw new Error(`Missing __bundler/template script in ${INDEX}`);
}

const template = JSON.parse(templateTag[1]);
const scripts = [...template.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
const inline = scripts
  .filter(([, attrs]) => !/\bsrc\s*=/.test(attrs))
  .map(([, , body]) => body.trim())
  .find((body) => body.length > 0);

if (!inline) {
  throw new Error('No inline <script> found in bundled template');
}

const tmpPath = path.join(os.tmpdir(), `ikos-inline-check-${process.pid}.js`);

try {
  fs.writeFileSync(tmpPath, inline, 'utf8');
  execFileSync(process.execPath, ['--check', tmpPath], { stdio: 'inherit' });
} finally {
  if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
}
