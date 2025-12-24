/**
 * Logout Functionality Tests
 *
 * Test Cases Covered:
 * - TC-LOGOUT-001: Successful logout
 * - TC-LOGOUT-002: Access denied after logout
 *
 * These tests verify that:
 * 1. Users can successfully logout via the backend API
 * 2. Auth0 logout URL is returned for complete logout
 * 3. Session is invalidated after logout
 * 4. Access to protected endpoints is denied after logout
 */

describe('Logout Functionality', () => {

  /**
   * Setup: Login before each test
   */
  beforeEach(() => {
    cy.loginProgrammatically();
    cy.visit('/');
  });

  describe('TC-LOGOUT-001: Successful Logout', () => {

    it('should logout user successfully via API', () => {
      // Arrange: User is authenticated
      cy.verifyAuthentication();

      // Act: Call logout endpoint
      cy.request({
        method: 'POST',
        url: `${Cypress.env('API_URL')}/auth/logout`,
        body: {}
      }).then((response) => {
        // Assert: Logout request succeeds
        expect(response.status, 'Logout should return 200 OK').to.eq(200);

        // Assert: Response contains Auth0 logout URL
        expect(response.body, 'Response should contain logoutUrl')
          .to.have.property('logoutUrl');

        expect(response.body.logoutUrl, 'Logout URL should contain v2/logout')
          .to.include('v2/logout');

        expect(response.body.logoutUrl, 'Logout URL should be for Auth0')
          .to.include('auth0.com');

        cy.log('✓ Logout successful');
        cy.log(`✓ Auth0 logout URL: ${response.body.logoutUrl}`);
      });
    });

    it('should return Auth0 logout URL with correct parameters', () => {
      // Act: Logout
      cy.request({
        method: 'POST',
        url: `${Cypress.env('API_URL')}/auth/logout`,
        body: {}
      }).then((response) => {
        const logoutUrl = response.body.logoutUrl;

        // Assert: URL structure is correct
        // Format: {issuerUri}v2/logout?client_id={clientId}&returnTo={originUrl}
        expect(logoutUrl).to.include('v2/logout');
        expect(logoutUrl).to.include('client_id=');
        expect(logoutUrl).to.include('returnTo=');

        cy.log('✓ Auth0 logout URL properly formatted');
        cy.log(`  ${logoutUrl}`);
      });
    });

    it('should clear session on logout', () => {
      // Arrange: Verify user is authenticated
      cy.verifyAuthentication();

      // Act: Logout using custom command (clears session + cookies)
      cy.logout();

      // Assert: Authenticated endpoint now returns error
      cy.request({
        method: 'GET',
        url: `${Cypress.env('API_URL')}/auth/get-authenticated-user?forceResync=true`,
        failOnStatusCode: false
      }).then((response) => {
        // Backend should return 500 when OAuth2User is null (session invalidated)
        expect(response.status, 'Should return error after logout').to.eq(500);

        cy.log('✓ Session cleared successfully');
      });
    });

    it('should clear authentication tokens from session storage', () => {
      // Act: Logout
      cy.logout();

      // Assert: No tokens in session storage
      cy.window().then((window) => {
        const accessToken = window.sessionStorage.getItem('access_token');
        const idToken = window.sessionStorage.getItem('id_token');

        expect(accessToken, 'Access token should be cleared').to.be.null;
        expect(idToken, 'ID token should be cleared').to.be.null;

        cy.log('✓ Authentication tokens cleared from session storage');
      });
    });

    it('should clear cookies on logout', () => {
      // Act: Logout
      cy.logout();

      // Assert: Cookies are cleared
      cy.getCookies().then((cookies) => {
        // Filter for auth-related cookies
        const authCookies = cookies.filter(cookie =>
          cookie.name.includes('SESSION') ||
          cookie.name.includes('JSESSIONID') ||
          cookie.name.includes('auth')
        );

        // All auth cookies should be cleared
        expect(authCookies.length, 'Auth cookies should be cleared').to.eq(0);

        cy.log('✓ Cookies cleared');
      });
    });

    it('should invalidate backend session', () => {
      // This test verifies that HttpServletRequest.getSession().invalidate()
      // is called in the logout endpoint

      // Arrange: Verify authenticated
      cy.verifyAuthentication();

      // Act: Logout
      cy.request({
        method: 'POST',
        url: `${Cypress.env('API_URL')}/auth/logout`,
        body: {}
      }).then((response) => {
        expect(response.status).to.eq(200);

        // Assert: Subsequent requests fail due to invalidated session
        cy.request({
          method: 'GET',
          url: `${Cypress.env('API_URL')}/auth/get-authenticated-user?forceResync=true`,
          failOnStatusCode: false
        }).then((authResponse) => {
          expect(authResponse.status).to.eq(500);
          cy.log('✓ Backend session invalidated');
        });
      });
    });

  });

  describe('TC-LOGOUT-002: Access Denied After Logout', () => {

    it('should return error when calling authenticated endpoint after logout', () => {
      // Arrange: Verify authenticated
      cy.verifyAuthentication();

      // Act: Logout
      cy.logout();

      // Act: Try to call authenticated endpoint
      cy.request({
        method: 'GET',
        url: `${Cypress.env('API_URL')}/auth/get-authenticated-user?forceResync=true`,
        failOnStatusCode: false
      }).then((response) => {
        // Assert: Request is rejected
        expect(response.status, 'Should return error status').to.eq(500);

        cy.log('✓ Authenticated endpoint denied after logout');
        cy.log(`  Status: ${response.status}`);
      });
    });

    it('should deny access to protected endpoints after logout', () => {
      // Arrange: Login as landlord and verify access
      cy.loginAsLandlord();

      cy.request({
        method: 'GET',
        url: `${Cypress.env('API_URL')}/landlord-listings/get-all`
      }).then((response) => {
        expect(response.status, 'Should have access when authenticated').to.eq(200);
        cy.log('✓ Access granted when authenticated');
      });

      // Act: Logout
      cy.logout();

      // Act: Try to access protected endpoint after logout
      cy.request({
        method: 'GET',
        url: `${Cypress.env('API_URL')}/landlord-listings/get-all`,
        failOnStatusCode: false
      }).then((response) => {
        // Assert: Access is denied
        expect(response.status, 'Should deny access after logout')
          .to.be.oneOf([401, 403, 500]);

        cy.log('✓ Protected endpoint denied after logout');
        cy.log(`  Status: ${response.status}`);
      });
    });

    it('should require re-authentication to access protected resources', () => {
      // This test verifies the complete logout → re-auth flow

      // Arrange: Login and access protected resource
      cy.loginAsLandlord();
      cy.request({
        method: 'GET',
        url: `${Cypress.env('API_URL')}/landlord-listings/get-all`
      }).then((response) => {
        expect(response.status).to.eq(200);
        cy.log('✓ Step 1: Initial access granted');
      });

      // Act: Logout
      cy.logout();
      cy.request({
        method: 'GET',
        url: `${Cypress.env('API_URL')}/landlord-listings/get-all`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([401, 403, 500]);
        cy.log('✓ Step 2: Access denied after logout');
      });

      // Act: Re-authenticate
      cy.loginAsLandlord();
      cy.request({
        method: 'GET',
        url: `${Cypress.env('API_URL')}/landlord-listings/get-all`
      }).then((response) => {
        expect(response.status).to.eq(200);
        cy.log('✓ Step 3: Access granted after re-authentication');
      });

      cy.log('✓ Complete logout → re-auth flow works correctly');
    });

    it('should not allow session reuse after logout', () => {
      // This test verifies that old session tokens cannot be reused

      // Arrange: Get authenticated
      cy.verifyAuthentication();

      // Act: Capture session data
      cy.window().then((window) => {
        const oldAccessToken = window.sessionStorage.getItem('access_token');

        // Act: Logout
        cy.logout();

        // Act: Try to restore old session data (simulate session hijacking)
        if (oldAccessToken) {
          window.sessionStorage.setItem('access_token', oldAccessToken);
        }

        // Assert: Backend still rejects request (session is invalidated server-side)
        cy.request({
          method: 'GET',
          url: `${Cypress.env('API_URL')}/auth/get-authenticated-user?forceResync=true`,
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status, 'Old session should not work').to.eq(500);
          cy.log('✓ Old session tokens cannot be reused');
        });
      });
    });

  });

  describe('Logout Edge Cases', () => {

    it('should handle logout when already logged out', () => {
      // Arrange: Logout first
      cy.logout();

      // Act: Try to logout again
      cy.request({
        method: 'POST',
        url: `${Cypress.env('API_URL')}/auth/logout`,
        body: {},
        failOnStatusCode: false
      }).then((response) => {
        // Assert: Should handle gracefully (may return 200 or error)
        cy.log(`Logout status when already logged out: ${response.status}`);

        // Either succeeds or fails gracefully
        expect([200, 401, 403, 500]).to.include(response.status);

        cy.log('✓ Double logout handled gracefully');
      });
    });

    it('should clear all user state on logout', () => {
      // Arrange: Login
      cy.loginProgrammatically();
      cy.visit('/');

      // Act: Logout and clear everything
      cy.logout();

      // Assert: All storage is cleared
      cy.window().then((window) => {
        // Session storage
        expect(window.sessionStorage.length, 'Session storage should be empty')
          .to.eq(0);

        // Local storage
        expect(window.localStorage.length, 'Local storage should be empty')
          .to.eq(0);

        cy.log('✓ All user state cleared');
      });
    });

  });

});
