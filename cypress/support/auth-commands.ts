/**
 * Custom Cypress commands for OAuth2 authentication
 *
 * These commands enable programmatic authentication without
 * going through the OAuth2 UI redirect flow.
 */

// Token cache to prevent Auth0 rate limiting
const tokenCache: { [key: string]: { access_token: string; id_token: string; expires_at: number } } = {};

/**
 * Helper function to get Authorization headers
 * Retrieves the access token from sessionStorage and formats it for API requests
 */
function getAuthHeaders(): Cypress.Chainable<{ Authorization: string }> {
  return cy.window().then((window) => {
    const accessToken = window.sessionStorage.getItem('access_token');
    if (!accessToken) {
      throw new Error('No access token found in sessionStorage. Did you forget to call cy.loginProgrammatically()?');
    }
    return {
      Authorization: `Bearer ${accessToken}`
    };
  });
}

/**
 * Login programmatically using Auth0 Resource Owner Password Grant
 *
 * This bypasses the OAuth2 redirect flow for automated testing.
 * Implements token caching to prevent Auth0 rate limiting.
 *
 * @param username - Optional username (defaults to TEST_TENANT_USERNAME from env)
 * @param password - Optional password (defaults to TEST_TENANT_PASSWORD from env)
 *
 * @example
 * cy.loginProgrammatically()
 * cy.loginProgrammatically('user@test.com', 'password123')
 */
Cypress.Commands.add('loginProgrammatically', (username?: string, password?: string) => {
  const user = username || Cypress.env('TEST_TENANT_USERNAME');
  const pass = password || Cypress.env('TEST_TENANT_PASSWORD');

  const cacheKey = `${user}:${pass}`;
  const now = Date.now();

  // Check if we have a valid cached token (expires in 1 hour, use 55 min for safety)
  if (tokenCache[cacheKey] && tokenCache[cacheKey].expires_at > now) {
    cy.log('✓ Using cached authentication token');
    return cy.window().then((window) => {
      window.sessionStorage.setItem('access_token', tokenCache[cacheKey].access_token);
      window.sessionStorage.setItem('id_token', tokenCache[cacheKey].id_token);
    });
  }

  cy.log('Authenticating programmatically...');

  // Call Auth0 token endpoint directly (Resource Owner Password Grant)
  return cy.request({
    method: 'POST',
    url: `https://${Cypress.env('AUTH0_DOMAIN')}/oauth/token`,
    body: {
      grant_type: 'http://auth0.com/oauth/grant-type/password-realm',
      username: user,
      password: pass,
      client_id: Cypress.env('AUTH0_CLIENT_ID'),
      client_secret: Cypress.env('AUTH0_CLIENT_SECRET'),
      audience: Cypress.env('AUTH0_AUDIENCE'),
      scope: 'openid profile email',
      realm: 'Username-Password-Authentication'
    },
    failOnStatusCode: false
  }).then((response) => {
    // Log response for debugging
    cy.log(`Auth0 Response Status: ${response.status}`);

    if (response.status !== 200) {
      const errorMsg = response.body?.error_description || response.body?.error || 'Unknown error';
      cy.log(`Auth0 Error: ${errorMsg}`);
      cy.log(`Full Response: ${JSON.stringify(response.body, null, 2)}`);
      throw new Error(`Authentication failed (${response.status}): ${errorMsg}`);
    }

    cy.log('✓ Auth0 authentication successful');

    const { access_token, id_token } = response.body;

    // Cache token for 55 minutes (Auth0 tokens typically expire in 1 hour)
    tokenCache[cacheKey] = {
      access_token,
      id_token,
      expires_at: now + (55 * 60 * 1000)
    };

    // Store tokens in session storage (matches your AuthService implementation)
    cy.window().then((window) => {
      window.sessionStorage.setItem('access_token', access_token);
      window.sessionStorage.setItem('id_token', id_token);
    });

    cy.log('✓ Authentication successful');
  });
});

/**
 * Login as landlord (user with ROLE_LANDLORD)
 *
 * @example
 * cy.loginAsLandlord()
 */
Cypress.Commands.add('loginAsLandlord', () => {
  cy.loginProgrammatically(
    Cypress.env('TEST_LANDLORD_USERNAME'),
    Cypress.env('TEST_LANDLORD_PASSWORD')
  );
});

/**
 * Login as tenant (user with ROLE_TENANT)
 *
 * @example
 * cy.loginAsTenant()
 */
Cypress.Commands.add('loginAsTenant', () => {
  cy.loginProgrammatically(
    Cypress.env('TEST_TENANT_USERNAME'),
    Cypress.env('TEST_TENANT_PASSWORD')
  );
});

/**
 * Verify user is authenticated by calling backend
 *
 * @example
 * cy.verifyAuthentication()
 */
Cypress.Commands.add('verifyAuthentication', () => {
  getAuthHeaders().then((headers) => {
    cy.request({
      method: 'GET',
      url: `${Cypress.env('API_URL')}/auth/get-authenticated-user?forceResync=true`,
      headers,
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property('email');
    });
  });
});

/**
 * Logout current user
 *
 * @example
 * cy.logout()
 */
Cypress.Commands.add('logout', () => {
  cy.log('Logging out...');

  // Try to get auth headers, but don't fail if they don't exist (user might already be logged out)
  cy.window().then((window) => {
    const accessToken = window.sessionStorage.getItem('access_token');
    const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

    cy.request({
      method: 'POST',
      url: `${Cypress.env('API_URL')}/auth/logout`,
      headers,
      body: {},
      failOnStatusCode: false
    }).then((response) => {
      if (response.status === 200) {
        cy.log('✓ Logout successful');
      }

      // Clear all authentication data
      cy.window().then((window) => {
        window.sessionStorage.clear();
        window.localStorage.clear();
      });
      cy.clearCookies();
    });
  });
});

/**
 * Get current authenticated user info
 *
 * @example
 * cy.getCurrentUser().then((user) => {
 *   expect(user.email).to.equal('test@example.com');
 * });
 */
Cypress.Commands.add('getCurrentUser', () => {
  return getAuthHeaders().then((headers) => {
    return cy.request({
      method: 'GET',
      url: `${Cypress.env('API_URL')}/auth/get-authenticated-user?forceResync=true`,
      headers,
      failOnStatusCode: false
    }).then((response) => {
      if (response.status === 200) {
        return response.body;
      }
      return null;
    });
  });
});

/**
 * Verify user has specific role
 *
 * @param role - Role to verify (e.g., 'ROLE_LANDLORD')
 *
 * @example
 * cy.verifyUserHasRole('ROLE_LANDLORD')
 */
Cypress.Commands.add('verifyUserHasRole', (role: string) => {
  cy.getCurrentUser().then((user: any) => {
    expect(user).to.not.be.null;
    expect(user.authorities).to.include(role);
  });
});

/**
 * Make an authenticated API request with Authorization header
 * This is a wrapper around cy.request() that automatically includes the JWT token
 *
 * @param options - Cypress request options
 *
 * @example
 * cy.authenticatedRequest({ method: 'GET', url: '/api/protected-endpoint' })
 */
Cypress.Commands.add('authenticatedRequest', (options: Partial<Cypress.RequestOptions>) => {
  return getAuthHeaders().then((authHeaders) => {
    const mergedHeaders = { ...options.headers, ...authHeaders };
    return cy.request({ ...options, headers: mergedHeaders });
  });
});
