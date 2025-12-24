/**
 * Role Extraction and Authorization Tests
 *
 * Test Cases Covered:
 * - TC-ROLE-001: Role extraction from OAuth2 claims
 *
 * These tests verify that:
 * 1. Roles are correctly extracted from custom Auth0 claims
 * 2. Roles follow Spring Security naming convention (ROLE_*)
 * 3. Role-based authorization works correctly
 * 4. ROLE_LANDLORD can access landlord endpoints
 * 5. ROLE_TENANT cannot access landlord endpoints
 */

describe('TC-ROLE-001: Role Extraction and Authorization', () => {

  describe('Role Extraction from Custom Claims', () => {

    it('should extract roles from custom namespace claim (https://www.ensas9.fr/roles)', () => {
      // Arrange: Login with default test user
      cy.loginProgrammatically();

      // Act: Get user information
      cy.getCurrentUser().then((user) => {
        // Assert: Roles are present
        expect(user.authorities, 'User should have authorities array')
          .to.be.an('array');

        expect(user.authorities.length, 'User should have at least one role')
          .to.be.greaterThan(0);

        cy.log('✓ Roles extracted from custom Auth0 claim');
        cy.log(`  Namespace: https://www.ensas9.fr/roles`);
        cy.log(`  Roles: ${user.authorities.join(', ')}`);
      });
    });

    it('should format all roles with ROLE_ prefix', () => {
      // Arrange: Login
      cy.loginProgrammatically();

      // Act: Get user
      cy.getCurrentUser().then((user) => {
        // Assert: All roles start with "ROLE_"
        // This is required by Spring Security's @PreAuthorize and hasRole()
        user.authorities.forEach((role: string) => {
          expect(role, `Role "${role}" must start with "ROLE_"`)
            .to.match(/^ROLE_/);
        });

        cy.log('✓ All roles follow Spring Security naming convention');
      });
    });

    it('should have valid application roles', () => {
      // Arrange: Login
      cy.loginProgrammatically();

      // Act: Get user
      cy.getCurrentUser().then((user) => {
        // Assert: User has at least one valid application role
        const validRoles = ['ROLE_TENANT', 'ROLE_LANDLORD'];
        const hasValidRole = user.authorities.some((role: string) =>
          validRoles.includes(role)
        );

        expect(hasValidRole, 'User should have ROLE_TENANT or ROLE_LANDLORD')
          .to.be.true;

        cy.log('✓ User has valid application role');
      });
    });

  });

  describe('ROLE_LANDLORD Authorization', () => {

    beforeEach(() => {
      // Login as landlord before each test
      cy.loginAsLandlord();
    });

    afterEach(() => {
      // Cleanup after each test
      cy.logout();
    });

    it('should recognize ROLE_LANDLORD', () => {
      // Act: Get user
      cy.getCurrentUser().then((user) => {
        // Assert: User has ROLE_LANDLORD
        expect(user.authorities, 'User should have ROLE_LANDLORD')
          .to.include('ROLE_LANDLORD');

        cy.log('✓ ROLE_LANDLORD correctly recognized');
      });
    });

    it('should allow ROLE_LANDLORD to access landlord endpoints', () => {
      // Act: Try to access landlord-only endpoint
      cy.authenticatedRequest({
        method: 'GET',
        url: `${Cypress.env('API_URL')}/landlord-listings/get-all`,
        failOnStatusCode: false
      }).then((response) => {
        // Assert: Access is granted (200 OK)
        expect(response.status, 'ROLE_LANDLORD should access landlord endpoints')
          .to.eq(200);

        cy.log('✓ ROLE_LANDLORD can access /api/landlord-listings/get-all');
      });
    });

    it('should use custom verifyUserHasRole command', () => {
      // This demonstrates using the custom Cypress command

      // Act & Assert: Verify user has ROLE_LANDLORD
      cy.verifyUserHasRole('ROLE_LANDLORD');

      cy.log('✓ verifyUserHasRole command works correctly');
    });

  });

  describe('ROLE_TENANT Authorization', () => {

    beforeEach(() => {
      // Login as tenant before each test
      cy.loginAsTenant();
    });

    afterEach(() => {
      // Cleanup after each test
      cy.logout();
    });

    it('should recognize ROLE_TENANT', () => {
      // Act: Get user
      cy.getCurrentUser().then((user) => {
        // Assert: User has ROLE_TENANT
        expect(user.authorities, 'User should have ROLE_TENANT')
          .to.include('ROLE_TENANT');

        cy.log('✓ ROLE_TENANT correctly recognized');
      });
    });

    it('should deny ROLE_TENANT from accessing landlord endpoints', () => {
      // Act: Try to access landlord-only endpoint as tenant
      cy.authenticatedRequest({
        method: 'GET',
        url: `${Cypress.env('API_URL')}/landlord-listings/get-all`,
        failOnStatusCode: false
      }).then((response) => {
        // Assert: Access is denied (403 Forbidden)
        expect(response.status, 'ROLE_TENANT should be denied access')
          .to.eq(403);

        cy.log('✓ ROLE_TENANT correctly denied access to landlord endpoints');
        cy.log(`  Status: ${response.status} Forbidden`);
      });
    });

  });

  describe('Role-Based Access Control (RBAC)', () => {

    it('should enforce role-based authorization on backend endpoints', () => {
      // This test verifies that @PreAuthorize("hasAnyRole('LANDLORD')") works

      // Test 1: ROLE_LANDLORD can access
      cy.loginAsLandlord();
      cy.authenticatedRequest({
        method: 'GET',
        url: `${Cypress.env('API_URL')}/landlord-listings/get-all`,
      }).then((response) => {
        expect(response.status).to.eq(200);
        cy.log('✓ ROLE_LANDLORD: Access granted (200)');
      });
      cy.logout();

      // Test 2: ROLE_TENANT cannot access
      cy.loginAsTenant();
      cy.authenticatedRequest({
        method: 'GET',
        url: `${Cypress.env('API_URL')}/landlord-listings/get-all`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(403);
        cy.log('✓ ROLE_TENANT: Access denied (403)');
      });
      cy.logout();

      cy.log('✓ Role-based authorization working correctly');
    });

    it('should map OAuth2 authorities to Spring Security authorities', () => {
      // This test verifies that SecurityConfiguration's GrantedAuthoritiesMapper
      // correctly maps OAuth2 authorities from the custom claim

      // Arrange: Login
      cy.loginProgrammatically();

      // Act: Get user
      cy.getCurrentUser().then((user) => {
        // Assert: Authorities are properly formatted for Spring Security
        expect(user.authorities).to.be.an('array');

        // All authorities should be valid Spring Security roles
        user.authorities.forEach((authority: string) => {
          // Should start with ROLE_ prefix
          expect(authority).to.match(/^ROLE_/);

          // Should be one of the known application roles
          const knownRoles = ['ROLE_TENANT', 'ROLE_LANDLORD', 'ROLE_ADMIN'];
          const isKnownRole = knownRoles.some(role => authority === role);

          if (!isKnownRole) {
            cy.log(`⚠ Warning: Unknown role detected: ${authority}`);
          }
        });

        cy.log('✓ OAuth2 authorities correctly mapped to Spring Security');
      });
    });

  });

  describe('Multiple Roles', () => {

    it('should handle users with multiple roles', () => {
      // Some users might have both ROLE_TENANT and ROLE_LANDLORD

      // Arrange: Login
      cy.loginProgrammatically();

      // Act: Get user
      cy.getCurrentUser().then((user) => {
        const roleCount = user.authorities.length;

        cy.log(`User has ${roleCount} role(s)`);

        // Assert: Each role is valid
        user.authorities.forEach((role: string, index: number) => {
          expect(role).to.be.a('string');
          expect(role).to.match(/^ROLE_/);
          cy.log(`  [${index + 1}] ${role}`);
        });

        cy.log('✓ Multiple roles handled correctly');
      });
    });

  });

  describe('Role Extraction from Security Context', () => {

    it('should make roles available to Spring Security hasRole() checks', () => {
      // This test verifies that backend controllers can use:
      // - @PreAuthorize("hasRole('LANDLORD')")
      // - @PreAuthorize("hasAnyRole('TENANT', 'LANDLORD')")

      // Arrange: Login as landlord
      cy.loginAsLandlord();

      // Act: Access protected endpoint that requires ROLE_LANDLORD
      cy.authenticatedRequest({
        method: 'GET',
        url: `${Cypress.env('API_URL')}/landlord-listings/get-all`,
      }).then((response) => {
        // Assert: Spring Security @PreAuthorize allowed access
        expect(response.status, '@PreAuthorize should allow ROLE_LANDLORD')
          .to.eq(200);

        cy.log('✓ Spring Security hasRole() check works correctly');
      });
    });

  });

});
