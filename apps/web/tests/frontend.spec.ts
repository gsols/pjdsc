import { test, expect } from '@playwright/test';

test('homepage and real geographic workspace render', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Anticipate dengue. Prepare with confidence.' })).toBeVisible();
  await page.screenshot({ path: '../../artifacts/frontend/home-desktop.png', fullPage: true });
  await page.getByRole('link', { name: 'Explore the Map', exact: true }).click();
  await expect(page.getByLabel('Selected geography')).toHaveValue('NCR');
  await expect(page.locator('.facility-marker').first()).toBeVisible();
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await page.screenshot({ path: '../../artifacts/frontend/map-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});
