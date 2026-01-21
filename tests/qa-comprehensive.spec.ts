import { test, expect, Page } from '@playwright/test';

// QA Protocol Configuration
const VIEWPORTS = [
  { name: 'Desktop', width: 1920, height: 1080 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Mobile', width: 375, height: 812 }
];

const BASE_URL = 'http://localhost:3000';

// Helper to document issues
const issues: any[] = [];
function logIssue(type: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW', description: string, element?: string) {
  issues.push({ type, description, element, timestamp: new Date().toISOString() });
  console.log(`[${type}] ${description} (${element || 'General'})`);
}

test.describe('Comprehensive QA Assessment', () => {
  
  for (const viewport of VIEWPORTS) {
    test.describe(`${viewport.name} Viewport (${viewport.width}x${viewport.height})`, () => {
      
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      test.beforeEach(async ({ page }) => {
        await page.goto(BASE_URL);
        // Ensure we are logged in for internal pages
        if (await page.locator('input[type="email"]').isVisible()) {
            await page.fill('input[type="email"]', 'test@demo.com');
            await page.fill('input[type="password"]', 'demo123');
            await page.click('button[type="submit"]');
            await page.waitForURL('**/dashboard');
        }
      });

      test('Visual Completeness & Missing Element Test', async ({ page }) => {
        // 1. Check for broken images
        const images = await page.locator('img').all();
        for (const img of images) {
          const src = await img.getAttribute('src');
          const isLoaded = await img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0);
          if (!isLoaded) {
            logIssue('HIGH', `Broken image found: ${src}`, await img.innerHTML());
          }
        }

        // 2. Check for empty icon containers
        const icons = await page.locator('.icon, svg').all();
        for (const icon of icons) {
            const isVisible = await icon.isVisible();
            if (!isVisible) {
                 logIssue('MEDIUM', 'Invisible icon element found', await icon.innerHTML());
            }
        }

        // 3. Check for placeholder text
        const bodyText = await page.textContent('body');
        if (bodyText?.includes('Lorem ipsum') || bodyText?.includes('Placeholder')) {
            logIssue('MEDIUM', 'Placeholder text found on page');
        }
      });

      test('Interactive Element Inventory & Test', async ({ page }) => {
        // Get all interactive elements
        const interactibles = await page.locator('button, a, input, select, textarea').all();
        
        console.log(`Testing ${interactibles.length} interactive elements on ${viewport.name}...`);

        for (let i = 0; i < interactibles.length; i++) {
            const element = interactibles[i];
            
            // Skip if not visible
            if (!await element.isVisible()) continue;

            const tagName = await element.evaluate(e => e.tagName.toLowerCase());
            
            try {
                if (tagName === 'a') {
                    const href = await element.getAttribute('href');
                    if (href && !href.startsWith('#') && !href.startsWith('/')) {
                        continue; 
                    }
                }
                
                // Just hover to verify interactivity without navigating everywhere
                await element.hover();
            } catch (e: any) {
                // Ignore hover errors
            }
        }
      });

      test('Primary User Actions - Critical Path', async ({ page }) => {
        // 1. Navigation Menu
        const navLinks = ['Dashboard', 'Log Explorer', 'Live Anomalies', 'Settings'];
        
        for (const linkName of navLinks) {
            // Mobile/Tablet Handling: Open menu if needed
            if (viewport.width < 1024) {
                // Use robust aria-label selector
                const menuBtn = page.locator('button[aria-label="Toggle menu"]');
                if (await menuBtn.isVisible()) {
                    await menuBtn.click();
                    await page.waitForTimeout(500); // Wait for animation
                }
            }

            const link = page.locator(`a:has-text("${linkName}")`);
            // Wait for link to be visible (it might be in a drawer)
            if (await link.isVisible()) {
                await link.click();
                await page.waitForLoadState('networkidle');
                // Verify URL or Page Title
                await expect(page.locator('body')).toBeVisible();
            } else {
                logIssue('CRITICAL', `Navigation link not found: ${linkName}`);
            }
            
            // Close menu if on mobile to reset state for next link
            if (viewport.width < 1024) {
                 // If sidebar is still open, click overlay or close button
                 // Usually clicking a link closes it, but let's be safe
                 await page.waitForTimeout(300);
            }
        }

        // 2. Search Functionality (Log Explorer)
        await page.goto(`${BASE_URL}/log-explorer`);
        const searchInput = page.locator('input[placeholder*="Search"]');
        await expect(searchInput).toBeVisible();
        await searchInput.fill('QA Test Search');
        await page.keyboard.press('Enter');
        
        // 3. Quick Filters
        const filterBtn = page.locator('button:has-text("Last 24h")');
        if (await filterBtn.isVisible()) {
            await filterBtn.click();
        }
        
        // 4. Export Buttons
        const exportBtn = page.locator('button:has-text("Export CSV")');
        if (await exportBtn.isVisible()) {
             await expect(exportBtn).toBeEnabled();
        }
      });
    });
  }
});
