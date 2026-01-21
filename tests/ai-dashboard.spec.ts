import { test, expect } from '@playwright/test';

test.describe('AI Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'test@demo.com');
    await page.fill('input[type="password"]', 'demo123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.click('a[href="/ai-dashboard"]');
    await page.waitForURL('/ai-dashboard');
  });

  test('should load AI dashboard', async ({ page }) => {
    await expect(page.locator('h2')).toContainText('Pro AI Dashboard');
  });

  test('should display model training section', async ({ page }) => {
    await expect(page.locator('text=Model Training Laboratory')).toBeVisible();
    await expect(page.locator('select#model-name')).toBeVisible();
    await expect(page.locator('select#dataset-name')).toBeVisible();
  });

  test('should display model playground', async ({ page }) => {
    await expect(page.locator('text=Model Playground')).toBeVisible();
    await expect(page.locator('textarea#playground-text')).toBeVisible();
  });

  test('should test classification', async ({ page }) => {
    // Enter test text
    await page.fill('textarea#playground-text', 'Database connection failed');
    
    // Click test classification button
    await page.click('button:has-text("Test Classification")');
    
    // Wait for result
    await page.waitForTimeout(2000);
    
    // Check result appears
    const result = page.locator('#playground-result');
    await expect(result).toContainText(/CRITICAL|NORMAL/);
  });

  test('should display Kaggle dataset section', async ({ page }) => {
    await expect(page.locator('text=Kaggle Dataset Training')).toBeVisible();
    await expect(page.locator('input#kaggle-csv-upload')).toBeVisible();
  });

  test.skip('should train Kaggle model', async ({ page }) => {
    // This test is skipped as it requires file upload and takes time
    // Can be enabled for full integration testing
  });
});
