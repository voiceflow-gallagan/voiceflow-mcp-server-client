// @ts-check
const { defineConfig } = require('@playwright/test')

module.exports = defineConfig({
  use: {
    // Use the system Chrome installation
    channel: 'chrome',
    // Specify the path to Chrome
    executablePath: '/usr/bin/google-chrome',
    // Run in headless mode
    headless: true,
  },
})
