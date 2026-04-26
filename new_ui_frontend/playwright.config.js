// @ts-check
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: ".",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    viewport: { width: 1440, height: 960 },
  },
});
