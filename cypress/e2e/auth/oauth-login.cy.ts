/**
 * OAuth2 Authentication Flow Tests
 *
 * Test Cases Covered:
 * - TC-OAUTH-001: OAuth2 successful login with Google
 * - TC-OAUTH-003: Auto-redirect to frontend after login
 * - TC-OAUTH-004: OAuth2 login cancellation
 */

describe('OAuth2 Authentication Flow', () => {

  beforeEach(() => {
    // Visit home page and clear any existing authentication
    cy.visit('/');
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  describe('TC-OAUTH-001: OAuth2 Successful Login', () => {

    it('should successfully authenticate via programmatic login', () => {
      // Arrange: User is not authenticated

      // Act: Login programmatically (simulates OAuth2 token exchange)
      cy.loginProgrammatically();
      cy.visit('/');

      // Assert: User is authenticated
      cy.verifyAuthentication();

      // Assert: User data is returned from backend
      cy.getCurrentUser().then((user) => {
        expect(user, 'User object should not be null').to.not.be.null;
        expect(user.email, 'User should have email').to.contain('@');
        expect(user.authorities, 'User should have authorities/roles').to.be.an('array');

        cy.log(`✓ User authenticated: ${user.email}`);
        cy.log(`✓ Roles: ${user.authorities.join(', ')}`);
      });
    });

    it('should maintain authentication across page navigation', () => {
      // Arrange: User logs in
      cy.loginProgrammatically();
      cy.visit('/');

      // Act: Navigate to different pages
      cy.visit('/');
      cy.visit('/listing');

      // Assert: User remains authenticated
      cy.verifyAuthentication();
    });

    /**
     * MANUAL TEST NOTE:
     *
     * To manually test the complete OAuth2 flow with UI:
     * 1. Start backend: cd Booking-S9-backend && ./mvnw spring-boot:run
     * 2. Start frontend: cd Booking-S9-Frontend && npm start
     * 3. Open browser: http://localhost:4200
     * 4. Click "Login" button
     * 5. You'll be redirected to Auth0
     * 6. Click "Continue with Google"
     * 7. Enter Google credentials
     * 8. Grant permissions
     *
     * Expected Result:
     * - Redirected back to http://localhost:4200
     * - No error messages displayed
     * - User avatar/profile visible in navbar
     * - User is authenticated
     */
  });

  describe('TC-OAUTH-003: Auto-redirect After Login', () => {

    it('should allow access to protected routes after login', () => {
      // Arrange: Login as landlord
      cy.loginAsLandlord();

      // Act: Try to access protected landlord route
      cy.visit('/landlord/properties', { failOnStatusCode: false });

      // Assert: Should NOT redirect to login page
      cy.url().should('include', '/landlord/properties');

      // Assert: User should still be authenticated
      cy.verifyAuthentication();

      cy.log('✓ Protected route accessible after login');
    });

    it('should not redirect to OAuth when already authenticated', () => {
      // Arrange: User is authenticated
      cy.loginProgrammatically();
      cy.visit('/');

      // Act: Visit the home page
      cy.visit('/');

      // Assert: Should not redirect to /oauth2/authorization
      cy.url().should('not.include', 'oauth2/authorization');
      cy.url().should('not.include', 'auth0.com');

      cy.log('✓ No OAuth redirect when already authenticated');
    });
  });

  describe('TC-OAUTH-004: Login Cancellation', () => {

    it('should handle unauthenticated state correctly', () => {
      // Arrange: User has not logged in
      cy.visit('/');

      // Assert: User should remain unauthenticated
      cy.log('Verifying unauthenticated state...');

      // Assert: Backend returns error for authenticated-only endpoint
      cy.request({
        method: 'GET',
        url: `${Cypress.env('API_URL')}/auth/get-authenticated-user?forceResync=true`,
        failOnStatusCode: false
      }).then((response) => {
        // AuthController returns 500 when OAuth2User is null
        expect(response.status).to.eq(500);

        cy.log('✓ Unauthenticated request correctly rejected');
      });
    });

    it('should not have any tokens in session storage when not authenticated', () => {
      // Arrange: Clear any authentication
      cy.clearCookies();
      cy.clearLocalStorage();
      cy.visit('/');

      // Assert: No authentication tokens present
      cy.window().then((window) => {
        const accessToken = window.sessionStorage.getItem('access_token');
        const idToken = window.sessionStorage.getItem('id_token');

        expect(accessToken, 'Access token should not exist').to.be.null;
        expect(idToken, 'ID token should not exist').to.be.null;

        cy.log('✓ No authentication tokens in session storage');
      });
    });

    it('should deny access to protected endpoints when not authenticated', () => {
      // Arrange: User is not authenticated
      cy.clearCookies();
      cy.clearLocalStorage();

      // Act: Try to access landlord endpoint
      cy.request({
        method: 'GET',
        url: `${Cypress.env('API_URL')}/landlord-listings/get-all`,
        failOnStatusCode: false
      }).then((response) => {
        // Assert: Should return 401, 403, or 500 (unauthorized)
        expect(response.status).to.be.oneOf([401, 403, 500]);

        cy.log(`✓ Protected endpoint denied access (${response.status})`);
      });
    });
  });

});
