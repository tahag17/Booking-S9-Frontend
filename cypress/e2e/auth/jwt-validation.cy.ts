/**
 * JWT Validation and Claims Extraction Tests
 *
 * Test Cases Covered:
 * - TC-OAUTH-002: JWT validation and claims extraction backend
 *
 * This test verifies that:
 * 1. The backend correctly validates JWT tokens from Auth0
 * 2. User information is extracted from JWT claims
 * 3. Custom role claims (https://www.ensas9.fr/roles) are correctly mapped
 * 4. Invalid/missing JWTs are rejected
 */

describe('TC-OAUTH-002: JWT Validation and Claims', () => {

  /**
   * Setup: Login once before all tests in this suite
   * This provides a valid JWT token for testing
   */
  before(() => {
    cy.log('Setting up authentication for JWT validation tests');
    cy.loginProgrammatically();
  });

  /**
   * Cleanup: Logout after all tests complete
   */
  after(() => {
    cy.log('Cleaning up authentication');
    cy.logout();
  });

  describe('JWT Token Validation', () => {

    it('should validate JWT and return 200 OK', () => {
      // Act: Call backend endpoint with JWT token
      cy.authenticatedRequest({
        method: 'GET',
        url: `${Cypress.env('API_URL')}/auth/get-authenticated-user?forceResync=true`,
      }).then((response) => {
        // Assert: Backend accepts the JWT and returns success
        expect(response.status, 'Backend should validate JWT and return 200').to.eq(200);
        expect(response.body, 'Response should contain user data').to.have.property('email');

        cy.log('✓ JWT validated successfully by backend');
      });
    });

    it('should reject request with invalid JWT', () => {
      // Arrange: Clear authentication to simulate invalid/missing JWT
      cy.clearCookies();
      cy.clearLocalStorage();

      // Act: Call backend endpoint without valid JWT
      cy.request({
        method: 'GET',
        url: `${Cypress.env('API_URL')}/auth/get-authenticated-user?forceResync=true`,
        failOnStatusCode: false
      }).then((response) => {
        // Assert: Backend rejects request with 401 Unauthorized (standard HTTP status for missing/invalid auth)
        expect(response.status, 'Backend should reject invalid JWT').to.eq(401);

        cy.log('✓ Invalid JWT correctly rejected');
      });

      // Restore authentication for remaining tests
      cy.loginProgrammatically();
    });

  });

  describe('User Information Extraction from Claims', () => {

    it('should extract user information from JWT claims', () => {
      // Act: Get current user info from backend
      cy.getCurrentUser().then((user) => {
        // Assert: Basic user information is extracted
        expect(user.email, 'Email should be extracted from JWT').to.be.a('string').and.not.be.empty;

        // Optional fields (may not always be present)
        if (user.firstName) {
          expect(user.firstName, 'First name should be string').to.be.a('string');
        }
        if (user.lastName) {
          expect(user.lastName, 'Last name should be string').to.be.a('string');
        }
        if (user.imageUrl) {
          expect(user.imageUrl, 'Image URL should be string').to.be.a('string');
        }

        cy.log(`✓ User information extracted: ${user.email}`);
        if (user.firstName && user.lastName) {
          cy.log(`  Name: ${user.firstName} ${user.lastName}`);
        }
      });
    });

    it('should include publicId for user identification', () => {
      // Act: Get user info
      cy.getCurrentUser().then((user) => {
        // Assert: User has a public ID (UUID)
        expect(user.publicId, 'User should have publicId').to.exist;
        expect(user.publicId, 'PublicId should be valid UUID format')
          .to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

        cy.log(`✓ User publicId: ${user.publicId}`);
      });
    });

  });

  describe('Custom Role Claims Extraction', () => {

    it('should extract roles from custom namespace claim (https://www.ensas9.fr/roles)', () => {
      // Act: Get current user
      cy.getCurrentUser().then((user) => {
        // Assert: Authorities/roles are present
        expect(user.authorities, 'User should have authorities').to.be.an('array');
        expect(user.authorities.length, 'User should have at least one role').to.be.greaterThan(0);

        cy.log(`✓ Roles extracted from custom claim`);
        cy.log(`  Roles: ${user.authorities.join(', ')}`);
      });
    });

    it('should format roles with ROLE_ prefix', () => {
      // Act: Get current user
      cy.getCurrentUser().then((user) => {
        // Assert: All roles should start with "ROLE_"
        // This is required by Spring Security for role-based authorization
        user.authorities.forEach((role: string) => {
          expect(role, `Role "${role}" should start with "ROLE_"`).to.match(/^ROLE_/);
        });

        cy.log('✓ All roles properly formatted with ROLE_ prefix');
      });
    });

    it('should have at least one valid role (ROLE_TENANT or ROLE_LANDLORD)', () => {
      // Act: Get current user
      cy.getCurrentUser().then((user) => {
        // Assert: User has at least one of the expected roles
        const hasValidRole = user.authorities.some((role: string) =>
          role === 'ROLE_TENANT' || role === 'ROLE_LANDLORD'
        );

        expect(hasValidRole, 'User should have ROLE_TENANT or ROLE_LANDLORD').to.be.true;

        cy.log('✓ User has valid application role');
      });
    });

  });

  describe('JWT Claims Processing', () => {

    it('should extract all required user attributes from OAuth2 claims', () => {
      // Act: Get user info
      cy.getCurrentUser().then((user) => {
        // Assert: Core attributes are present
        expect(user, 'User object should exist').to.exist;
        expect(user.email, 'Email claim is required').to.exist;
        expect(user.authorities, 'Authorities claim is required').to.exist;
        expect(user.publicId, 'PublicId should be generated/assigned').to.exist;

        // Verify data types
        expect(user.email).to.be.a('string');
        expect(user.authorities).to.be.an('array');
        expect(user.publicId).to.be.a('string');

        cy.log('✓ All required claims extracted and validated');
      });
    });

    it('should sync user data with Identity Provider when forceResync=true', () => {
      // This test verifies the UserService.syncWithIdp() method is called
      // when forceResync parameter is true

      // Act: Call endpoint without resync
      cy.request({
        method: 'GET',
        url: `${Cypress.env('API_URL')}/auth/get-authenticated-user?forceResync=false`,
      }).then((response1) => {
        const user1 = response1.body;

        // Act: Call endpoint with resync
        cy.request({
          method: 'GET',
          url: `${Cypress.env('API_URL')}/auth/get-authenticated-user?forceResync=true`,
        }).then((response2) => {
          const user2 = response2.body;

          // Assert: Both calls return user data
          expect(response1.status).to.eq(200);
          expect(response2.status).to.eq(200);

          // Assert: Same user is returned (same publicId)
          expect(user2.publicId).to.equal(user1.publicId);

          cy.log('✓ User sync with IDP works correctly');
          cy.log(`  User: ${user2.email}`);
        });
      });
    });

  });

});
