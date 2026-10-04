#!/usr/bin/env node
/**
 * archive-era: freeze the site at the repo root into /eras/<id>/ so a design stays
 * browsable after the next redesign replaces it.
 *
 * Usage:
 *   node tools/archive-era.mjs v3 --name "Design system" --from 2026-06 --summary "…"
 *   node tools/archive-era.mjs v3 --force      replace an existing snapshot (keeps its name, summary and dates)
 *   node tools/archive-era.mjs --check v3      verify a snapshot without changing anything
 *   node tools/archive-era.mjs --hub           rebuild /eras/index.html from eras/eras.json
 *
 * Optional: --version v3.2.2 (default: newest entry on the changelog page), --to 2026-10 (default: archive month).
 *
 * A snapshot contains every page (*.html) and everything in assets/ except assets/images/,
 * which all eras share. Root-absolute links are rewritten to stay inside the era
 * (/lab/ → /eras/v3/lab/), and each page gets noindex, an "archive" title suffix and a
 * fixed pill that links to the same page on the current site.
 *
 * Rule this depends on: never move or rename files in assets/images/. Archived eras still point at them.
 */
import { readFile, writeFile, mkdir, readdir, rm, stat, access, copyFile } from 'node:fs/promises';
import { dirname, join, relative, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ERAS_DIR = join(ROOT, 'eras');
const REGISTRY = join(ERAS_DIR, 'eras.json');

// Top-level folders that are never part of a snapshot
const SKIP_DIRS = new Set(['eras', '_concepts', 'tools', 'node_modules']);
// URLs every era shares, so they're never rewritten
const SHARED_PREFIXES = ['/assets/images/', '/eras/'];

const ATTR = /\b(href|src|action|poster|srcset|data-[\w-]+)(\s*=\s*)(["'])(.*?)\3/gi;
const CSS_URL = /url\(\s*(["']?)(.*?)\1\s*\)/g;

// ── CLI ──────────────────────────────────────────────────────────────────────
const flags = {};
const positional = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) { positional.push(argv[i]); continue; }
  const key = argv[i].slice(2);
  const next = argv[i + 1];
  if (next !== undefined && !next.startsWith('--')) { flags[key] = next; i++; }
  else flags[key] = true;
}

// ── Archive ──────────────────────────────────────────────────────────────────
async function archive(id) {
  if (!/^v\d+$/.test(id ?? '')) {
    throw new Error('Give an era id like v3: node tools/archive-era.mjs v3 --name "…" --from 2026-06');
  }
  const target = join(ERAS_DIR, id);
  if (await exists(target)) {
    if (!flags.force) throw new Error(`eras/${id}/ already exists. Re-run with --force to replace it.`);
    await rm(target, { recursive: true });
  }

  const prefix = `/eras/${id}`;
  let pages = 0;
  let assets = 0;
  for (const file of await collect(ROOT)) {
    const rel = relative(ROOT, file);
    const out = join(target, rel);
    await mkdir(dirname(out), { recursive: true });
    const ext = extname(file);
    if (ext === '.html') {
      await writeFile(out, decoratePage(rewriteHtml(await readFile(file, 'utf8'), prefix), id, rel));
      pages++;
    } else if (ext === '.css') {
      await writeFile(out, rewriteCss(await readFile(file, 'utf8'), prefix));
      assets++;
    } else {
      if (ext === '.js') warnOnJsPaths(rel, await readFile(file, 'utf8'));
      await copyFile(file, out);
      assets++;
    }
  }

  const registry = await readRegistry();
  const previous = registry.eras.find(e => e.id === id) ?? {};
  const now = new Date();
  const today = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map(n => String(n).padStart(2, '0')).join('-');
  const entry = {
    id,
    version: flags.version ?? (await latestVersion()) ?? previous.version ?? id,
    name: flags.name ?? previous.name ?? id,
    summary: flags.summary ?? previous.summary ?? '',
    from: flags.from ?? previous.from ?? null,
    to: flags.to ?? today.slice(0, 7),
    archived: today,
    commit: gitHead(),
    path: `/eras/${id}/`,
    pages,
  };
  registry.eras = [entry, ...registry.eras.filter(e => e.id !== id)]
    .sort((a, b) => Number(b.id.slice(1)) - Number(a.id.slice(1)));
  await writeFile(REGISTRY, JSON.stringify(registry, null, 2) + '\n');
  await writeShared();
  await writeHub(registry);

  console.log(`✓ Archived ${pages} pages and ${assets} assets to eras/${id}/ (${entry.version}, commit ${entry.commit ?? 'unknown'})`);
  process.exit(report(await verify(id)) ? 0 : 1);
}

// Pages anywhere + everything in assets/ except the shared images
async function collect(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    const rel = toUrlPath(relative(ROOT, full));
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(rel) || rel === 'assets/images') continue;
      found.push(...await collect(full));
    } else if (rel.startsWith('assets/') || entry.name.endsWith('.html')) {
      found.push(full);
    }
  }
  return found;
}

function rewriteUrl(url, prefix) {
  if (!url.startsWith('/') || url.startsWith('//')) return url;
  if (SHARED_PREFIXES.some(p => url.startsWith(p))) return url;
  return prefix + url;
}

function rewriteHtml(html, prefix) {
  return rewriteCss(html.replace(ATTR, (match, name, eq, quote, value) => {
    const next = name.toLowerCase() === 'srcset'
      ? value.split(',').map(part => part.trim().replace(/^\S+/, u => rewriteUrl(u, prefix))).join(', ')
      : rewriteUrl(value, prefix);
    return `${name}${eq}${quote}${next}${quote}`;
  }), prefix);
}

function rewriteCss(css, prefix) {
  return css.replace(CSS_URL, (match, quote, url) => `url(${quote}${rewriteUrl(url, prefix)}${quote})`);
}

function decoratePage(html, id, rel) {
  const pagePath = '/' + toUrlPath(rel).replace(/index\.html$/, '');
  const fallback = `/eras/?from=${id}&amp;missing=${encodeURIComponent(pagePath)}`;
  const head =
    '  <meta name="robots" content="noindex">\n' +
    '  <link rel="stylesheet" href="/eras/era.css">\n' +
    '  <script src="/eras/era-switch.js" defer></script>\n';
  const pill =
    `\n  <nav class="era-pill" aria-label="Site version">` +
    `<span class="era-pill__tag">Archive · ${id}</span>` +
    `<a class="era-pill__link" href="${pagePath}" data-era-switch data-fallback="${fallback}">Current site →</a>` +
    `<a class="era-pill__all" href="/eras/">All versions</a></nav>\n`;
  return html
    .replace(/<\/title>/i, ` · ${id} archive</title>`)
    .replace(/<\/head>/i, `${head}</head>`)
    .replace(/<body[^>]*>/i, match => match + pill);
}

function warnOnJsPaths(rel, js) {
  if (/(["'`])\/(?!\/)[\w-]/.test(js)) {
    console.warn(`! ${rel} has a root-absolute path in a JS string. Check it still points inside the era.`);
  }
}

// ── Shared files (owned by this tool, rewritten on every run) ────────────────
async function writeShared() {
  await writeFile(join(ERAS_DIR, 'era.css'), ERA_CSS);
  await writeFile(join(ERAS_DIR, 'era-switch.js'), ERA_SWITCH_JS);
}

const ERA_CSS = `/* Generated by tools/archive-era.mjs. Neutral so it sits on top of any era's design. */
.era-pill {
  position: fixed;
  left: 16px;
  bottom: 16px;
  z-index: 2147483000;
  display: flex;
  align-items: center;
  gap: 2px;
  max-width: calc(100vw - 32px);
  padding: 5px;
  border-radius: 999px;
  background: #151515;
  color: #fff;
  font: 500 13px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, .55);
}
.era-pill__tag {
  padding: 9px 10px 9px 12px;
  font: 500 11px/1 ui-monospace, Menlo, monospace;
  letter-spacing: .06em;
  text-transform: uppercase;
  white-space: nowrap;
  opacity: .7;
}
.era-pill a { padding: 9px 13px; border-radius: 999px; color: #fff !important; text-decoration: none; white-space: nowrap; }
.era-pill a:hover { background: rgba(255, 255, 255, .14); }
.era-pill a.era-pill__link { background: #fff; color: #151515 !important; font-weight: 600; }
.era-pill a.era-pill__link:hover { background: #e6e6e6; }
.era-pill a:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
@media (max-width: 420px) { .era-pill { left: 12px; bottom: 12px; } .era-pill__all { display: none; } }
@media print { .era-pill { display: none; } }
`;

const ERA_SWITCH_JS = `// Generated by tools/archive-era.mjs.
// Links with data-era-switch go to the same page in another version of the site.
// If that page doesn't exist there, they land on data-fallback (the eras hub) instead.
document.addEventListener('click', function (event) {
  var link = event.target.closest('a[data-era-switch]');
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  var target = link.href;
  var fallback = link.getAttribute('data-fallback') || '/eras/';
  fetch(target, { method: 'HEAD' })
    .then(function (res) { location.href = res.ok ? target : fallback; })
    .catch(function () { location.href = target; });
});
`;

async function writeHub(registry) {
  const items = registry.eras.map(era => `
      <li><a href="${esc(era.path)}">
        <span class="ver">${esc(era.version)}</span>
        <span class="name">${esc(era.name)}</span>
        <span class="go">Visit →</span>
        <span class="meta">${esc([formatMonth(era.from), formatMonth(era.to)].filter(Boolean).join(' – '))}${era.summary ? ` · ${esc(era.summary)}` : ''}</span>
      </a></li>`).join('');

  await mkdir(ERAS_DIR, { recursive: true });
  await writeFile(join(ERAS_DIR, 'index.html'), `<!DOCTYPE html>
<!-- Generated by tools/archive-era.mjs from eras/eras.json. Edit the registry, then run: node tools/archive-era.mjs --hub -->
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>Every version · shawncastillo.com</title>
  <style>
    :root { --bg: #f6f4f0; --card: #fff; --text: #1b1b1a; --muted: #67665f; --line: rgba(0, 0, 0, .1); }
    @media (prefers-color-scheme: dark) {
      :root { --bg: #131313; --card: #1d1d1c; --text: #f1efe9; --muted: #a09e96; --line: rgba(255, 255, 255, .12); }
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
    main { max-width: 760px; margin: 0 auto; padding: 72px 16px 96px; }
    .tag { font: 500 11px/1 ui-monospace, Menlo, monospace; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
    h1 { margin: 14px 0 12px; font-size: clamp(34px, 6vw, 52px); line-height: 1.02; letter-spacing: -.03em; }
    .lede { margin: 0; max-width: 52ch; color: var(--muted); }
    .notice { display: none; margin: 28px 0 0; padding: 14px 18px; border: 1px solid var(--line); border-radius: 14px; background: var(--card); }
    .notice.on { display: block; }
    ol { display: grid; gap: 12px; margin: 40px 0 0; padding: 0; list-style: none; }
    li a {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: baseline;
      gap: 6px 18px;
      padding: 20px 22px;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: var(--card);
      color: inherit;
      text-decoration: none;
      transition: transform .2s;
    }
    li a:hover { transform: translateY(-2px); }
    li a:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
    .ver { padding: 6px 10px; border: 1px solid var(--line); border-radius: 999px; font: 600 12px/1 ui-monospace, Menlo, monospace; }
    .name { font-size: 20px; font-weight: 650; letter-spacing: -.01em; }
    .go { color: var(--muted); }
    .meta { grid-column: 2 / 4; color: var(--muted); font-size: 14.5px; }
    footer { margin-top: 40px; color: var(--muted); font-size: 14px; }
    footer a { color: inherit; }
    @media (max-width: 520px) { li a { grid-template-columns: auto 1fr; } .go { display: none; } .meta { grid-column: 1 / 3; } }
    @media (prefers-reduced-motion: reduce) { li a { transition: none; } }
  </style>
</head>
<body>
  <main>
    <span class="tag">shawncastillo.com</span>
    <h1>Every version of this site</h1>
    <p class="lede">Each design gets frozen here when the next one ships, so you can walk through how the site and the work have changed.</p>
    <p class="notice" id="notice" role="status"></p>
    <ol>
      <li><a href="/">
        <span class="ver">Now</span>
        <span class="name">Current site</span>
        <span class="go">Visit →</span>
        <span class="meta">The latest design.</span>
      </a></li>${items}
    </ol>
    <footer>Designs before these weren't archived. <a href="/changelog/">The changelog</a> covers the rest of the story.</footer>
  </main>
  <script>
    // The era switcher lands here when the page someone was on doesn't exist in the version they picked.
    var missing = new URLSearchParams(location.search).get('missing');
    if (missing) {
      var notice = document.getElementById('notice');
      notice.textContent = 'The page you were on (' + missing + ') isn\\u2019t part of that version. Pick a version below.';
      notice.classList.add('on');
    }
  </script>
</body>
</html>
`);
}

// ── Verify ───────────────────────────────────────────────────────────────────
async function verify(id) {
  const base = join(ERAS_DIR, id);
  if (!await exists(base)) throw new Error(`eras/${id}/ doesn't exist yet.`);
  const prefix = `/eras/${id}/`;
  const result = { id, pages: 0, refs: 0, broken: [], inherited: [], escapes: [], undecorated: [] };

  for (const file of await walk(base)) {
    const ext = extname(file);
    if (ext !== '.html' && ext !== '.css') continue;
    const rel = toUrlPath(relative(base, file));
    let text = await readFile(file, 'utf8');
    if (ext === '.html') {
      result.pages++;
      if (!text.includes('<nav class="era-pill"') || !text.includes('<meta name="robots" content="noindex">')) {
        result.undecorated.push(rel);
      }
      // The pill links to the live site on purpose; the switcher handles missing pages there
      text = text.replace(/<nav class="era-pill"[\s\S]*?<\/nav>/, '');
    }
    for (const url of localRefs(text)) {
      result.refs++;
      if (!url.startsWith(prefix) && !SHARED_PREFIXES.some(p => url.startsWith(p))) {
        result.escapes.push(`${rel} → ${url}`);
        continue;
      }
      if (await resolves(url)) continue;
      // Missing in the snapshot: our bug if the live site has it, inherited if the live site is broken too
      const original = url.startsWith(prefix) ? url.slice(prefix.length - 1) : url;
      (await resolves(original) ? result.broken : result.inherited).push(`${rel} → ${url}`);
    }
  }
  return result;
}

function localRefs(text) {
  const urls = [];
  for (const [, name, , , value] of text.matchAll(ATTR)) {
    const values = name.toLowerCase() === 'srcset' ? value.split(',').map(p => p.trim().split(/\s+/)[0]) : [value];
    urls.push(...values);
  }
  for (const [, , url] of text.matchAll(CSS_URL)) urls.push(url);
  return urls
    .filter(u => u.startsWith('/') && !u.startsWith('//'))
    .map(u => u.split(/[?#]/)[0]);
}

async function resolves(url) {
  let path = url;
  try { path = decodeURIComponent(url); } catch { /* keep the raw path */ }
  const full = join(ROOT, path);
  try {
    if ((await stat(full)).isDirectory()) await access(join(full, 'index.html'));
    return true;
  } catch {
    return false;
  }
}

function report(r) {
  const list = (items, limit = 12) => {
    items.slice(0, limit).forEach(i => console.log(`    ${i}`));
    if (items.length > limit) console.log(`    …and ${items.length - limit} more`);
  };
  console.log(`  Checked ${r.refs} links across ${r.pages} pages in eras/${r.id}/`);
  if (r.undecorated.length) { console.log(`✗ ${r.undecorated.length} page(s) missing the archive pill or noindex:`); list(r.undecorated); }
  if (r.escapes.length) { console.log(`✗ ${r.escapes.length} link(s) leave the era:`); list(r.escapes); }
  if (r.broken.length) { console.log(`✗ ${r.broken.length} link(s) broken by the snapshot:`); list(r.broken); }
  if (r.inherited.length) {
    console.log(`! ${r.inherited.length} link(s) already broken on the live site (copied as-is):`);
    list(r.inherited);
  }
  const ok = !r.undecorated.length && !r.escapes.length && !r.broken.length;
  console.log(ok ? '✓ Snapshot is self-contained' : '✗ Snapshot has problems');
  return ok;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
async function readRegistry() {
  try { return JSON.parse(await readFile(REGISTRY, 'utf8')); }
  catch { return { eras: [] }; }
}

async function latestVersion() {
  try {
    const html = await readFile(join(ROOT, 'changelog', 'index.html'), 'utf8');
    return html.match(/class="changelog-version">\s*([^<\s]+)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

function gitHead() {
  try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
  catch { return null; }
}

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

function toUrlPath(path) {
  return path.split(sep).join('/');
}

function formatMonth(value) {
  if (!value) return '';
  const [year, month] = value.split('-').map(Number);
  if (!month) return String(year);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

// ── Run (last, so every constant above is initialized) ───────────────────────
try {
  if (flags.hub) {
    await writeHub(await readRegistry());
    console.log('✓ Rebuilt eras/index.html');
  } else if (flags.check) {
    process.exit(report(await verify(flags.check)) ? 0 : 1);
  } else {
    await archive(positional[0]);
  }
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exit(1);
}
