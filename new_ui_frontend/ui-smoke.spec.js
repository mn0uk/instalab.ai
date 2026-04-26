const { test, expect } = require('@playwright/test');
const path = require('path');

const fileUrl = 'file:///' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');

test('four step workflow and planning tabs render cleanly', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(fileUrl);

  await expect(page.locator('#view-input')).toBeVisible();
  await expect(page.locator('#stepper')).toContainText('Hypothesis');
  await expect(page.locator('#stepper')).toContainText('Literature Review');
  await expect(page.locator('#stepper')).toContainText('Experiment Planning');
  await expect(page.locator('#stepper')).toContainText('Summary');
  await expect(page.locator('#stepper')).not.toContainText('Protocol Preview');
  await page.screenshot({ path: 'screenshots/01-hypothesis.png', fullPage: true });

  await page.locator('#nav-materials').click();
  await expect(page.locator('#view-input')).toBeVisible();
  await page.waitForTimeout(500);

  await page.locator('.ex-card').first().click();
  await page.getByText('GENERATE PLAN').click();
  await expect(page.locator('#view-qc')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#view-qc')).toContainText('Literature Review');
  await expect(page.locator('#view-qc')).toContainText('HYPOTHESIS VERIFICATION GRAPH');
  await expect(page.locator('#view-qc')).toContainText('Supporting mechanism');
  await expect(page.locator('#view-qc')).toContainText('Contradicting evidence');
  await expect(page.locator('#view-qc')).not.toContainText('Latest');
  await page.screenshot({ path: 'screenshots/02-literature-review.png', fullPage: true });

  await page.locator('#qc-edit-btn').click();
  await page.locator('#qc-hyp-edit').fill('Updated hypothesis with passage 10-20 and DMSO 5% comparator.');
  await page.getByText('SAVE CHANGES').click();
  await expect(page.locator('#qc-hyp-text')).toContainText('passage 10-20');

  await page.getByRole('button', { name: /CONTINUE TO EXPERIMENT PLANNING/ }).click();
  await expect(page.locator('#view-audit')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#planning-protocol')).toBeVisible();
  await expect(page.locator('#planning-materials')).toBeHidden();
  await expect(page.locator('#planning-protocol')).toContainText('via protocols.io');
  await page.locator('#proto-chat-input').fill('increase replicates for power');
  await page.getByRole('button', { name: 'SEND' }).click();
  await expect(page.locator('#proto-chat-msgs')).toContainText('n=6', { timeout: 2000 });
  await page.screenshot({ path: 'screenshots/03-planning-protocol.png', fullPage: true });

  await page.locator('#nav-materials').click();
  await expect(page.locator('#planning-materials')).toBeVisible();
  await expect(page.locator('#planning-materials')).not.toContainText('EUR');
  await page.locator('#planning-material-grid input[type="checkbox"]').first().click();

  await page.locator('#nav-audit').click();
  await expect(page.locator('#planning-budget')).toBeVisible();
  await expect(page.locator('#planning-budget')).toContainText('supplier URL');
  await expect(page.locator('#budget-total')).not.toContainText('2,190');

  await page.locator('#nav-timeline').click();
  await expect(page.locator('#planning-timeline')).toBeVisible();
  await page.screenshot({ path: 'screenshots/04-planning-tabs.png', fullPage: true });

  await page.getByRole('button', { name: /GO TO SUMMARY/ }).click();
  await expect(page.locator('#view-review')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#view-review')).toContainText('Summary');
  await expect(page.getByText('Experiment Decision')).toBeVisible();
  await expect(page.locator('#view-review')).toContainText('Synthesis Conflict List');
  await page.screenshot({ path: 'screenshots/05-summary.png', fullPage: true });
});
