const { test, expect } = require('@playwright/test');
const path = require('path');

const fileUrl = 'file:///' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');

test('main workflow and sidebar destinations render cleanly', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(fileUrl);
  await expect(page.locator('#view-input')).toBeVisible();
  await page.screenshot({ path: 'screenshots/01-hypothesis.png', fullPage: true });
  await page.locator('#nav-materials').click();
  await expect(page.locator('#view-input')).toBeVisible();
  await page.waitForTimeout(3200);

  await page.locator('.ex-card').first().click();
  await page.getByText('GENERATE PLAN').click();
  await expect(page.locator('#view-qc')).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: 'screenshots/02-literature-qc.png', fullPage: true });

  await page.locator('#qc-edit-btn').click();
  await page.locator('#qc-hyp-edit').fill('Updated hypothesis with passage 10-20 and DMSO 5% comparator.');
  await page.getByText('SAVE CHANGES').click();
  await expect(page.locator('#qc-hyp-text')).toContainText('passage 10-20');

  await page.locator('#rec-apply-0').click();
  await page.getByRole('button', { name: /CONTINUE TO PROTOCOL PREVIEW/ }).click();
  await expect(page.locator('#view-plan')).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: 'screenshots/03-experiment-plan.png', fullPage: true });

  await page.locator('#plan-next-btn').click();
  await expect(page.locator('#view-audit')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#planning-materials')).toBeVisible();
  await page.screenshot({ path: 'screenshots/04-materials.png', fullPage: true });

  await page.locator('#nav-protocols').click();
  await expect(page.locator('#planning-protocol')).toBeVisible();
  await page.locator('#nav-materials').click();
  await expect(page.locator('#planning-materials')).toBeVisible();

  await page.locator('#planning-material-grid input[type="checkbox"]').first().click();
  await page.locator('.planning-tab', { hasText: 'BUDGET' }).click();
  await expect(page.locator('#budget-total')).not.toContainText('2,190');
  await page.screenshot({ path: 'screenshots/05-audit.png', fullPage: true });

  await page.getByRole('button', { name: /PROCEED TO REVIEW/ }).click();
  await expect(page.locator('#view-review')).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(3200);
  await page.screenshot({ path: 'screenshots/06-review.png', fullPage: true });

  await page.locator('#chk0').click();
  await page.getByRole('button', { name: /REGENERATE WITH CORRECTIONS/ }).click();
  await expect(page.locator('#view-review')).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: 'screenshots/07-review-regenerated.png', fullPage: true });
});
