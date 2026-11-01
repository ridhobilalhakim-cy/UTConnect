import { test, expect } from '@playwright/test';

test('dedicated Demo Mode build exposes simulation entry and scenario chooser', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#demoStartBtn')).toBeVisible();
  await expect(page.locator('#demoEntryPanel')).toBeVisible();
  await expect(page.locator('#demoScenario')).toHaveValue('all');
  await expect(page.locator('#demoScenario option')).toHaveCount(4);
  await expect(page.locator('#demoEntryPanel')).toContainText('bukan mahasiswa UT sungguhan');
  await expect(page.locator('#demoStartBtn')).toContainText('Akun Simulasi');
});
