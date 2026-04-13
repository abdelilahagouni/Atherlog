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
    // Check if model training section exists
    await expect(page.locator('h3:text("Model Training Laboratory")')).toBeVisible();
    
    // Select model type (Text input in new UI)
    const modelInput = page.locator('input#hf-model-name');
    await expect(modelInput).toBeVisible();
    await expect(modelInput).toHaveValue('distilbert-base-uncased');
    
    // Select dataset
    await page.selectOption('select#hf-dataset-name', 'imdb');
  });

  test('should display model playground', async ({ page }) => {
    await expect(page.locator('text=Model Playground')).toBeVisible();
    await expect(page.locator('textarea#predict-input')).toBeVisible();
  });

  test('should test classification', async ({ page }) => {
    // Type in playground
    await page.fill('textarea#predict-input', 'Database connection failed due to timeout');
    
    // Click predict
    await page.click('button:text("Analyze Text")');
    
    // Check result
    await expect(page.locator('#predict-result')).toBeVisible();
    await expect(page.locator('#predict-result')).toContainText('NEGATIVE'); // Error log should be negative sentiment/anomaly.
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
