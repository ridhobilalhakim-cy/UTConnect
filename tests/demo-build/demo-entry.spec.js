import { test, expect } from '@playwright/test';

test('dedicated Demo Mode build exposes simulation entry, bot roster, and scenario chooser', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#demoStartBtn')).toBeVisible();
  await expect(page.locator('#demoEntryPanel')).toBeVisible();
  await expect(page.locator('#demoScenario')).toHaveValue('all');
  await expect(page.locator('#demoScenario option')).toHaveCount(4);
  await expect(page.locator('#demoEntryPanel')).toContainText('bukan mahasiswa UT sungguhan');
  await expect(page.locator('#demoStartBtn')).toContainText('Akun Simulasi');

  const bots = page.locator('#demoBotRoster .demo-bot-mini');
  await expect(bots).toHaveCount(6);
  await expect(page.locator('#demoBotRoster')).toContainText('Sistem Informasi');
  await expect(page.locator('#demoBotRoster')).toContainText('Manajemen');
  await expect(page.locator('#demoBotRoster')).toContainText('Akuntansi');
  await expect(page.locator('#demoBotRoster')).toContainText('Ilmu Komunikasi');
  await expect(page.locator('#demoBotRoster')).toContainText('Pendidikan Bahasa Inggris');
  await expect(page.locator('#demoBotRoster')).toContainText('Sains Data');
  await expect(page.locator('#demoEntryPanel .demo-feature-list span')).toHaveCount(8);
});

test('demo dashboard markup covers all student-facing pages and notifications', async ({ page }) => {
  await page.goto('/');
  const appHtml = await page.evaluate(async () => (await fetch('/app.html')).text());
  expect(appHtml).toContain('id="demoShowcase"');
  expect((appHtml.match(/class="demo-bot-card"/g) || [])).toHaveLength(6);
  expect((appHtml.match(/data-demo-nav=/g) || [])).toHaveLength(8);
  expect(appHtml).toContain('data-demo-notifications');
  expect(appHtml).toContain('Materi PDF');
  expect(appHtml).toContain('bukti asli dinonaktifkan');
});
