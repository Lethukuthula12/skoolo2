import { defineConfig } from 'cypress';
import createBundler from '@bahmutov/cypress-esbuild-preprocessor';
import { addCucumberPreprocessorPlugin } from '@badeball/cypress-cucumber-preprocessor';
import { createEsbuildPlugin } from '@badeball/cypress-cucumber-preprocessor/esbuild';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertLocalApi, APP_URLS } from './scripts/local-safety.mjs';

export default defineConfig({
  video: false,
  screenshotOnRunFailure: true,
  screenshotsFolder: 'reports/screenshots',
  downloadsFolder: 'reports/downloads',
  viewportWidth: 1280,
  viewportHeight: 900,
  defaultCommandTimeout: 10000,
  retries: { runMode: 1, openMode: 0 },
  e2e: {
    baseUrl: APP_URLS.portal,
    specPattern: 'features/automated/**/*.feature',
    supportFile: 'support/e2e.ts',
    testIsolation: true,
    async setupNodeEvents(on, config) {
      if (config.baseUrl !== APP_URLS.portal) throw new Error('This suite only runs against the local test portal.');
      const local = JSON.parse(readFileSync(resolve(__dirname, '.local/browser.json'), 'utf8'));
      assertLocalApi(local.apiUrl);
      // Only the public anon key reaches Cypress/browser code. Admin and database keys stay in Node.
      config.env = { ...config.env, local, appUrls: APP_URLS };
      await addCucumberPreprocessorPlugin(on, config);
      on('file:preprocessor', createBundler({ plugins: [createEsbuildPlugin(config)] }));
      return config;
    },
  },
});
