import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname, extname } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(process.cwd());
const pages = ['index.html', 'app.html'];
const failures = [];
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

for (const page of pages) {
  const file = join(root, page);
  if (!existsSync(file)) {
    failures.push(`${page}: required HTML entry page is missing`);
    continue;
  }
  const html = readFileSync(file, 'utf8');
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m => m[1]);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length) failures.push(`${page}: duplicate IDs ${[...new Set(duplicateIds)].join(', ')}`);
  if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) failures.push(`${page}: inline script remains; move code into src/ modules`);
  if (!/type=["']module["'][^>]*src=["']\/src\//i.test(html)) failures.push(`${page}: expected a Vite module entry under /src/`);
}

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) return walk(path);
    return /\.(?:js|mjs)$/.test(path) ? [path] : [];
  });
}

function resolveLocalImport(fromFile, specifier) {
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [base, `${base}.js`, `${base}.mjs`, `${base}.json`, `${base}.css`, join(base, 'index.js')];
  return candidates.find(candidate => existsSync(candidate));
}

const sourceFiles = ['src', 'tests'].flatMap(dir => existsSync(join(root, dir)) ? walk(join(root, dir)) : []);
const configFiles = ['vite.config.js', 'playwright.config.js', 'scripts/check-source.mjs'].map(file => join(root, file));
for (const file of [...sourceFiles, ...configFiles]) {
  if (!existsSync(file)) continue;
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) failures.push(`${file}: ${result.stderr || result.stdout}`);

  const source = readFileSync(file, 'utf8');
  const importPattern = /\bfrom\s*["']([^"']+)["']|^\s*import\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/gm;
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1] || match[2] || match[3];
    if (specifier.startsWith('.')) {
      if (!resolveLocalImport(file, specifier)) failures.push(`${file}: unresolved local import "${specifier}"`);
      continue;
    }
    if (specifier.startsWith("node:")) continue;
    const packageName = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
    if (!pkg.dependencies?.[packageName] && !pkg.devDependencies?.[packageName]) {
      failures.push(`${file}: package import "${packageName}" is not declared in package.json`);
    }
  }
}

const clientPath = join(root, 'src/lib/supabase.js');
if (!existsSync(clientPath)) {
  failures.push('src/lib/supabase.js: shared Supabase client module is missing');
} else {
  const client = readFileSync(clientPath, 'utf8');
  if ((client.match(/createClient\(/g) || []).length !== 1) failures.push('src/lib/supabase.js: expected exactly one shared createClient instance');
  if (!client.includes('persistSession: true') || !client.includes('storageKey: AUTH_STORAGE_KEY')) failures.push('Supabase client must persist the shared browser session');
  if (client.includes('service_role') || client.includes('sb_secret_')) failures.push('A server-only Supabase key string appears in browser client config');
}

for (const required of ['@supabase/supabase-js', 'leaflet']) {
  if (!pkg.dependencies?.[required]) failures.push(`package.json: required runtime dependency "${required}" is missing`);
}
if (!pkg.devDependencies?.vite) failures.push('package.json: Vite must be declared in devDependencies');
if (!pkg.devDependencies?.['@playwright/test']) failures.push('package.json: Playwright Test must be declared in devDependencies');
if (!pkg.scripts?.build || !pkg.scripts?.check || !pkg.scripts?.['test:e2e']) failures.push('package.json: build, check, and test:e2e scripts are required');

const authSource = readFileSync(join(root, 'src/auth/main.js'), 'utf8');
const authHtml = readFileSync(join(root, 'index.html'), 'utf8');
for (const [description, condition] of [
  ['password recovery event handling', authSource.includes('PASSWORD_RECOVERY')],
  ['password recovery redirect marker', authSource.includes('mode=recovery')],
  ['password update request', authSource.includes('auth.updateUser({password})')],
  ['password recovery form', authHtml.includes('id="resetPasswordForm"')],
]) {
  if (!condition) failures.push(`Auth recovery: missing ${description}`);
}

if (failures.length) {
  console.error('UT Connect source checks FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`UT Connect source checks passed: ${pages.length} HTML pages, no duplicate IDs or inline JS, local imports resolved, package imports declared, one shared Supabase client, persistent auth session, and ${sourceFiles.length} source/test modules syntax-checked.`);
