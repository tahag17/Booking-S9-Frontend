/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    /**
     * Login programmatically using Auth0 Resource Owner Password Grant
     * @param username - Optional username (defaults to TEST_TENANT_USERNAME)
     * @param password - Optional password (defaults to TEST_TENANT_PASSWORD)
     * @example cy.loginProgrammatically('user@test.com', 'password')
     */
    loginProgrammatically(username?: string, password?: string): Chainable<void>;

    /**
     * Login as a landlord user with ROLE_LANDLORD
     * @example cy.loginAsLandlord()
     */
    loginAsLandlord(): Chainable<void>;

    /**
     * Login as a tenant user with ROLE_TENANT
     * @example cy.loginAsTenant()
     */
    loginAsTenant(): Chainable<void>;

    /**
     * Verify user is authenticated by calling backend
     * @example cy.verifyAuthentication()
     */
    verifyAuthentication(): Chainable<void>;

    /**
     * Logout current user and clear session
     * @example cy.logout()
     */
    logout(): Chainable<void>;

    /**
     * Get current authenticated user information
     * @example cy.getCurrentUser().then((user) => expect(user.email).to.exist)
     */
    getCurrentUser(): Chainable<any>;

    /**
     * Verify user has specific role
     * @param role - Role to verify (e.g., 'ROLE_LANDLORD')
     * @example cy.verifyUserHasRole('ROLE_LANDLORD')
     */
    verifyUserHasRole(role: string): Chainable<void>;

    /**
     * Make an authenticated API request with Authorization header
     * This automatically includes the JWT token from sessionStorage
     * @param options - Cypress request options
     * @example cy.authenticatedRequest({ method: 'GET', url: '/api/protected-endpoint' })
     */
    authenticatedRequest(options: Partial<Cypress.RequestOptions>): Chainable<Cypress.Response<any>>;
  }
}
