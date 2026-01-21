import { test, expect } from '@playwright/test';

test.describe('Log Explorer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'test@demo.com');
    await page.fill('input[type="password"]', 'demo123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.click('a[href="/log-explorer"]');
    await page.waitForURL('/log-explorer');
  });

  test('should load log explorer', async ({ page }) => {
    await expect(page.locator('h2')).toContainText('Log Explorer');
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
  });

  test('should test quick time filters', async ({ page }) => {
    // Test Last 1h filter
    await page.click('button:has-text("Last 1h")');
    await page.waitForTimeout(1000);
    
    // Test Last 24h filter
    await page.click('button:has-text("Last 24h")');
    await page.waitForTimeout(1000);
    
    // Test Last 7d filter
    await page.click('button:has-text("Last 7d")');
    await page.waitForTimeout(1000);
  });

  test('should search logs', async ({ page }) => {
    await page.fill('input[placeholder*="Search"]', 'error');
    await page.press('input[placeholder*="Search"]', 'Enter');
    await page.waitForTimeout(1000);
    
    // Verify search was applied
    const url = page.url();
    expect(url).toContain('query=error');
  });

  test('should export CSV', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Export CSV")');
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toContain('.csv');
  });

  test('should export JSON', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Export JSON")');
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toContain('.json');
  });

  test('should paginate logs', async ({ page }) => {
    // Check if pagination exists
    const nextButton = page.locator('button:has-text("Next")');
    if (await nextButton.isVisible()) {
      const isDisabled = await nextButton.isDisabled();
      if (!isDisabled) {
        await nextButton.click();
        await page.waitForTimeout(500);
      }
    }
  });
});
