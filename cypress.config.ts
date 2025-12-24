import { defineConfig } from 'cypress';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.cypress
dotenv.config({ path: path.resolve(__dirname, '.env.cypress') });

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4200',

    viewportWidth: 1280,
    viewportHeight: 720,

    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 30000,

    video: true,
    screenshotOnRunFailure: true,

    env: {
      AUTH0_DOMAIN: process.env['AUTH0_DOMAIN'] ?? 'dev-40qvupc4jvfi22h7.us.auth0.com',
      AUTH0_CLIENT_ID: process.env['AUTH0_CLIENT_ID'],
      AUTH0_CLIENT_SECRET: process.env['AUTH0_CLIENT_SECRET'],
      AUTH0_AUDIENCE: process.env['AUTH0_AUDIENCE'],
      TEST_TENANT_USERNAME: process.env['TEST_TENANT_USERNAME'] ?? 'test-tenant@example.com',
      TEST_TENANT_PASSWORD: process.env['TEST_TENANT_PASSWORD'],
      TEST_LANDLORD_USERNAME: process.env['TEST_LANDLORD_USERNAME'] ?? 'test-landlord@example.com',
      TEST_LANDLORD_PASSWORD: process.env['TEST_LANDLORD_PASSWORD'],
      BACKEND_URL: process.env['BACKEND_URL'] ?? 'http://localhost:8080',
      API_URL: process.env['API_URL'] ?? 'http://localhost:4200/api'
    },    

    setupNodeEvents(on, config) {
      on('task', {
        log(message) {
          console.log(message);
          return null;
        }
      });
      return config;
    },

    // CRITICAL: Required for OAuth2 redirects to Auth0/Google
    chromeWebSecurity: false,
    experimentalModifyObstructiveThirdPartyCode: true,
  },
});
