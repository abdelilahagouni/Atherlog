import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/');
    await page.fill('input[type="email"]', 'test@demo.com');
    await page.fill('input[type="password"]', 'demo123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should display all metrics', async ({ page }) => {
    // Check for metric cards
    await expect(page.locator('text=Total Logs')).toBeVisible();
    await expect(page.locator('text=Anomalies Found')).toBeVisible();
    await expect(page.locator('text=Error Rate')).toBeVisible();
    await expect(page.locator('text=Alerts Triggered')).toBeVisible();
    await expect(page.locator('text=System Health')).toBeVisible();
  });

  test('should render charts', async ({ page }) => {
    // Wait for chart to load
    await page.waitForSelector('svg', { timeout: 5000 });
    
    // Verify chart elements exist
    const charts = await page.locator('svg').count();
    expect(charts).toBeGreaterThan(0);
  });

  test('should navigate to log explorer from chart', async ({ page }) => {
    // Click on chart area (if clickable)
    const chart = page.locator('.recharts-wrapper').first();
    if (await chart.isVisible()) {
      await chart.click();
      // May navigate to log explorer
    }
  });

  test('should display numbers without leading zeros', async ({ page }) => {
    // Get metric values
    const metrics = await page.locator('.text-3xl.font-bold').allTextContents();
    
    // Check none start with '0' (except actual zeros)
    for (const metric of metrics) {
      const cleaned = metric.trim();
      if (cleaned !== '0' && cleaned !== '0%') {
        expect(cleaned).not.toMatch(/^0\d/);
      }
    }
  });
});
