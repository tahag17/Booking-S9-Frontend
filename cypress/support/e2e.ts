// ***********************************************************
// This file is loaded automatically before your test files
//
// You can use this to load custom commands and configure
// global hooks for your test suite
// ***********************************************************

// Import custom authentication commands
import './auth-commands';

// Import testing library commands (if needed)
import '@testing-library/cypress/add-commands';

/**
 * Global before hook - runs once before all tests
 */
before(() => {
  cy.log('🚀 Starting E2E Test Suite');
  cy.clearCookies();
  cy.clearLocalStorage();

  // Verify backend is running before starting tests
  // Note: Backend requires auth for all endpoints, so we just check if it responds
  cy.request({
    url: `${Cypress.env('BACKEND_URL')}/actuator/health`,
    failOnStatusCode: false
  }).then((response) => {
    // Accept 200 (public) or 401 (requires auth) as signs backend is running
    if (response.status !== 200 && response.status !== 401) {
      throw new Error(
        '❌ Backend is not running! Please start the backend at ' +
        Cypress.env('BACKEND_URL') +
        ' before running tests.'
      );
    }
    if (response.status === 401) {
      cy.log('✅ Backend is running (health endpoint requires auth)');
    } else {
      cy.log('✅ Backend is running and healthy');
    }
  });
});

/**
 * Global beforeEach hook - runs before each test
 * Sets up network interceptors for common API calls
 */
beforeEach(() => {
  // Intercept authentication endpoints for debugging
  cy.intercept('GET', '**/api/auth/get-authenticated-user*').as('getAuthenticatedUser');
  cy.intercept('POST', '**/api/auth/logout').as('logout');
  cy.intercept('GET', '**/api/landlord-listings/**').as('getLandlordListings');
});

/**
 * Global afterEach hook - runs after each test
 * Captures screenshots on test failure
 */
afterEach(function() {
  // this.currentTest is available in the afterEach hook
  if (this.currentTest && this.currentTest.state === 'failed') {
    const testTitle = this.currentTest.title;
    cy.screenshot(`FAILED - ${testTitle}`, {
      capture: 'fullPage',
      overwrite: true
    });
    cy.log(`📸 Screenshot captured for failed test: ${testTitle}`);
  }
});

/**
 * Global configuration
 */

// Prevent uncaught exceptions from failing tests
// (useful for handling OAuth2 redirect issues)
Cypress.on('uncaught:exception', (err, runnable) => {
  // Return false to prevent Cypress from failing the test
  // Only for specific errors we want to ignore
  if (err.message.includes('ResizeObserver loop')) {
    return false;
  }
  // Let other errors fail the test
  return true;
});
