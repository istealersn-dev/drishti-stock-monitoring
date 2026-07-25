/**
 * HTTP 401 Unauthorized. Shared so the broker-auth detection in the agent
 * graph and the health API's error-code tagging agree on one definition
 * rather than each redeclaring the literal.
 */
export const HTTP_UNAUTHORIZED = 401;
