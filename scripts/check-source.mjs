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

const demoClientPath = join(root, 'src/lib/supabase.js');
const demoServicePath = join(root, 'src/services/demo.js');
const demoHtmlPath = join(root, 'index.html');
const demoEdgePath = join(root, 'supabase/functions/demo-mode/index.ts');
const demoMigrationPath = join(root, 'supabase/migrations/20261101110000_utconnect_demo_mode_isolation.sql');

for (const [label, path] of [
  ['Demo Mode browser client', demoClientPath],
  ['Demo Mode client service', demoServicePath],
  ['Demo Mode Edge Function', demoEdgePath],
  ['Demo Mode isolation migration', demoMigrationPath],
]) {
  if (!existsSync(path)) failures.push(`${label}: required source file is missing`);
}

if (existsSync(demoClientPath) && existsSync(demoHtmlPath)) {
  const demoClient = readFileSync(demoClientPath, 'utf8');
  const demoHtml = readFileSync(demoHtmlPath, 'utf8');
  for (const [description, condition] of [
    ['environment flag defaults off', demoClient.includes('VITE_UTCONNECT_DEMO_MODE === "true"')],
    ['demo project reference must match the Supabase URL', demoClient.includes('DEMO_PROJECT_REF !== SUPABASE_PROJECT_REF')],
    ['shared Supabase project is blocked', demoClient.includes('hqyusbyndtlfypdbmatw') && demoClient.includes('lguqtplssimkwwyzmwzz')],
    ['scenario chooser is hidden by default', /id="demoEntryPanel"[^>]*hidden/.test(demoHtml)],
    ['demo entry button is hidden by default', /id="demoStartBtn"[^>]*hidden/.test(demoHtml)],
  ]) {
    if (!condition) failures.push(`Demo Mode guard: missing ${description}`);
  }
}

if (existsSync(demoEdgePath)) {
  const edge = readFileSync(demoEdgePath, 'utf8');
  for (const [description, condition] of [
    ['exact allowed Origin validation', edge.includes('DEMO_ALLOWED_ORIGIN') && edge.includes('origin !== allowedOrigin')],
    ['server-owned visitor role validation', edge.includes('utconnect_demo_role') && edge.includes('role !== "visitor"')],
    ['anonymous bootstrap validation', edge.includes('actor.is_anonymous === true')],
    ['session-scoped seed records', edge.includes('demo_session_id')],
    ['labeled simulated bot responses', edge.includes('[SIMULASI DEMO]')],
    ['server-side reset validation', edge.includes('action === "reset"') && edge.includes('auth.admin.deleteUser')],
    ['server-side active group counts', edge.includes('action === "list_groups"') && edge.includes('active_member_count')],
  ]) {
    if (!condition) failures.push(`Demo Mode Edge Function: missing ${description}`);
  }
  if (/VITE_SUPABASE|window\.localStorage|document\.cookie/.test(edge)) {
    failures.push('Demo Mode Edge Function must not depend on browser-only state or Vite secrets');
  }
}

if (existsSync(demoMigrationPath)) {
  const migration = readFileSync(demoMigrationPath, 'utf8');
  for (const [description, condition] of [
    ['session-scoped RLS guard', migration.includes('demo_scope_guard') && migration.includes('can_access_demo_scope')],
    ['server metadata authority', migration.includes('raw_app_meta_data') && !migration.includes('raw_user_meta_data')],
    ['server-only demo RPC grants', migration.includes('to service_role') && migration.includes('from public, anon, authenticated')],
    ['real student verification status is kept separate', migration.includes("verification_status = 'verified'::public.student_verification_status")],
    ['group capacity is checked on the server', migration.includes('Group is full')],
  ]) {
    if (!condition) failures.push(`Demo Mode migration: missing ${description}`);
  }
}

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
