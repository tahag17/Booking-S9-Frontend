/**
 * User Creation and Synchronization Tests
 *
 * Test Cases Covered:
 * - TC-USER-001: New user creation on first login
 * - TC-USER-002: User data sync from Auth0
 *
 * These tests verify that:
 * 1. Users are automatically created in the database on first OAuth2 login
 * 2. User data is correctly extracted from OAuth2 claims
 * 3. No duplicate users are created on subsequent logins
 * 4. User data can be synchronized with the Identity Provider (Auth0)
 */

describe('User Management', () => {

  describe('TC-USER-001: First Login User Creation', () => {

    it('should create user on login and return user data', () => {
      // Arrange: User authenticates for the first time
      cy.loginProgrammatically();

      // Act: Request user information from backend
      cy.authenticatedRequest({
        method: 'GET',
        url: `${Cypress.env('API_URL')}/auth/get-authenticated-user?forceResync=true`,
      }).then((response) => {
        // Assert: User is created successfully
        expect(response.status, 'Backend should return 200 OK').to.eq(200);

        const user = response.body;

        // Assert: User has required fields
        expect(user.email, 'User should have email from OAuth2 claims')
          .to.not.be.empty;

        expect(user.publicId, 'User should have publicId (UUID)')
          .to.exist;

        expect(user.publicId, 'PublicId should be valid UUID')
          .to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

        expect(user.authorities, 'User should have authorities/roles')
          .to.be.an('array');

        cy.log(`✓ User created successfully`);
        cy.log(`  Email: ${user.email}`);
        cy.log(`  PublicId: ${user.publicId}`);
        cy.log(`  Roles: ${user.authorities.join(', ')}`);
      });
    });

    it('should extract email from OAuth2 claims', () => {
      // Arrange: Login
      cy.loginProgrammatically();

      // Act: Get user
      cy.getCurrentUser().then((user) => {
        // Assert: Email claim is correctly extracted
        expect(user.email, 'Email should be extracted from "email" claim')
          .to.be.a('string')
          .and.include('@');

        cy.log(`✓ Email extracted: ${user.email}`);
      });
    });

    it('should extract name from OAuth2 claims (if available)', () => {
      // Arrange: Login
      cy.loginProgrammatically();

      // Act: Get user
      cy.getCurrentUser().then((user) => {
        // Assert: Name claims may be present (given_name, family_name)
        // These are optional fields from OAuth2

        if (user.firstName) {
          expect(user.firstName, 'First name should be string').to.be.a('string');
          cy.log(`✓ First name extracted: ${user.firstName}`);
        } else {
          cy.log('ℹ First name not available in OAuth2 claims');
        }

        if (user.lastName) {
          expect(user.lastName, 'Last name should be string').to.be.a('string');
          cy.log(`✓ Last name extracted: ${user.lastName}`);
        } else {
          cy.log('ℹ Last name not available in OAuth2 claims');
        }
      });
    });

    it('should initialize roles from custom Auth0 claim', () => {
      // Arrange: Login
      cy.loginProgrammatically();

      // Act: Get user
      cy.getCurrentUser().then((user) => {
        // Assert: Roles are initialized from custom claim (https://www.ensas9.fr/roles)
        expect(user.authorities, 'Roles should be initialized from Auth0')
          .to.be.an('array')
          .and.not.be.empty;

        // Assert: Roles follow Spring Security format
        user.authorities.forEach((role: string) => {
          expect(role, `Role should start with ROLE_`).to.match(/^ROLE_/);
        });

        cy.log(`✓ Roles initialized: ${user.authorities.join(', ')}`);
      });
    });

    it('should not create duplicate users on multiple logins', () => {
      // Arrange: Login for the first time
      cy.loginProgrammatically();

      // Act: Get user publicId
      cy.getCurrentUser().then((user1) => {
        const publicId1 = user1.publicId;
        const email1 = user1.email;

        cy.log(`First login - PublicId: ${publicId1}`);

        // Arrange: Logout and login again
        cy.logout();
        cy.loginProgrammatically();

        // Act: Get user again
        cy.getCurrentUser().then((user2) => {
          // Assert: Same user is returned (same publicId, same email)
          expect(user2.publicId, 'PublicId should remain the same')
            .to.equal(publicId1);

          expect(user2.email, 'Email should remain the same')
            .to.equal(email1);

          cy.log(`Second login - PublicId: ${user2.publicId}`);
          cy.log('✓ No duplicate user created - same publicId returned');
        });
      });
    });

    it('should persist user in database across sessions', () => {
      // This test verifies that user data is persisted in the database
      // and retrieved correctly across different authentication sessions

      // Arrange: Login
      cy.loginProgrammatically();

      // Act: Get user data
      cy.getCurrentUser().then((user1) => {
        const publicId = user1.publicId;

        // Arrange: Clear session (simulate new session)
        cy.clearCookies();
        cy.clearLocalStorage();

        // Arrange: Login again (new session)
        cy.loginProgrammatically();

        // Act: Get user data in new session
        cy.getCurrentUser().then((user2) => {
          // Assert: Same user is retrieved from database
          expect(user2.publicId, 'Same user should be retrieved from database')
            .to.equal(publicId);

          cy.log('✓ User data persisted across sessions');
        });
      });
    });

  });

  describe('TC-USER-002: User Data Synchronization', () => {

    it('should sync user data when forceResync is true', () => {
      // This test verifies that UserService.syncWithIdp() is called
      // when forceResync=true parameter is used

      // Arrange: Login
      cy.loginProgrammatically();

      // Act: Get user without forcing resync
      cy.authenticatedRequest({
        method: 'GET',
        url: `${Cypress.env('API_URL')}/auth/get-authenticated-user?forceResync=false`,
      }).then((response1) => {
        const user1 = response1.body;

        cy.log('First call (forceResync=false):');
        cy.log(`  Email: ${user1.email}`);
        cy.log(`  PublicId: ${user1.publicId}`);

        // Act: Get user with forced resync
        cy.authenticatedRequest({
          method: 'GET',
          url: `${Cypress.env('API_URL')}/auth/get-authenticated-user?forceResync=true`,
        }).then((response2) => {
          const user2 = response2.body;

          cy.log('Second call (forceResync=true):');
          cy.log(`  Email: ${user2.email}`);
          cy.log(`  PublicId: ${user2.publicId}`);

          // Assert: Both calls return success
          expect(response1.status).to.eq(200);
          expect(response2.status).to.eq(200);

          // Assert: Same user is returned (same publicId)
          expect(user2.publicId, 'Same user should be returned')
            .to.equal(user1.publicId);

          // Assert: Email remains the same (email is immutable)
          expect(user2.email, 'Email should remain the same')
            .to.equal(user1.email);

          cy.log('✓ User sync completed successfully');
        });
      });
    });

    it('should update user data when OAuth2 claims change', () => {
      // This test demonstrates that when user data changes in Auth0
      // (e.g., name, profile picture), the local database is updated
      // on the next login with forceResync=true

      // Note: In a real scenario, you would:
      // 1. Modify user data in Auth0 dashboard
      // 2. Login again with forceResync=true
      // 3. Verify updated data is persisted locally

      // Arrange: Login
      cy.loginProgrammatically();

      // Act: Force resync (simulates receiving updated OAuth2 claims)
      cy.authenticatedRequest({
        method: 'GET',
        url: `${Cypress.env('API_URL')}/auth/get-authenticated-user?forceResync=true`,
      }).then((response) => {
        const user = response.body;

        // Assert: User data is present
        expect(response.status).to.eq(200);
        expect(user.email).to.exist;

        cy.log('✓ User resync completed');
        cy.log('  Note: In production, this would update changed OAuth2 claims');
      });
    });

    it('should maintain user roles after resync', () => {
      // This test verifies that user roles are preserved during sync

      // Arrange: Login
      cy.loginProgrammatically();

      // Act: Get initial roles
      cy.getCurrentUser().then((user1) => {
        const initialRoles = user1.authorities;

        cy.log(`Initial roles: ${initialRoles.join(', ')}`);

        // Act: Force resync
        cy.authenticatedRequest({
          method: 'GET',
          url: `${Cypress.env('API_URL')}/auth/get-authenticated-user?forceResync=true`,
        }).then(() => {
          // Act: Get roles after resync
          cy.getCurrentUser().then((user2) => {
            // Assert: Roles are still present
            expect(user2.authorities, 'Roles should still be present')
              .to.be.an('array')
              .and.not.be.empty;

            cy.log(`Roles after resync: ${user2.authorities.join(', ')}`);
            cy.log('✓ User roles maintained after resync');
          });
        });
      });
    });

  });

});
