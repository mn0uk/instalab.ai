const { test, expect } = require("@playwright/test");
const path = require("path");

const fileUrl = "file:///" + path.resolve(__dirname, "index.html").replace(/\\/g, "/");

test("static prototype: hypothesis → QC → planning → review", async ({ page }) => {
  await page.goto(fileUrl);
  await expect(page.locator("#view-input")).toBeVisible();

  await page.locator(".ex-card").first().click();
  await page.getByText("GENERATE PLAN").click();
  await expect(page.locator("#view-qc")).toBeVisible({ timeout: 8000 });

  await page.locator("#qc-edit-btn").click();
  await page
    .locator("#qc-hyp-edit")
    .fill("Updated hypothesis with passage 10-20 and DMSO 5% comparator.");
  await page.getByText("SAVE CHANGES").click();
  await expect(page.locator("#qc-hyp-text")).toContainText("passage 10-20");

  await page.getByRole("button", { name: /CONTINUE TO EXPERIMENT PLANNING/i }).click();
  await expect(page.locator("#view-audit")).toBeVisible({ timeout: 8000 });

  // init() replaces #view-audit with the planning workbench; footer is "GO TO SUMMARY", not "PROCEED TO REVIEW".
  const goSummary = page.locator("#view-audit").getByRole("button", { name: /GO TO SUMMARY/i });
  await goSummary.scrollIntoViewIfNeeded();
  await goSummary.click();
  await expect(page.locator("#view-review")).toBeVisible({ timeout: 8000 });
  // init() replaces #view-review via renderSummaryPage(); CTA is SAVE SUMMARY (not static REGENERATE).
  await expect(page.getByRole("button", { name: /SAVE SUMMARY/i })).toBeVisible();
});
