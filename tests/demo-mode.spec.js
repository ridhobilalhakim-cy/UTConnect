import { test, expect } from '@playwright/test';

test('Demo Mode entry stays hidden in the ordinary UTConnect build', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#demoStartBtn')).toBeHidden();
  await expect(page.locator('#demoEntryPanel')).toBeHidden();
});
