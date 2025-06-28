/**
 * @file Mock AST Generator for Tests
 * @description Provides utilities to generate mock ASTs for scope definitions in tests
 */

/**
 * Generates a simple mock AST for testing purposes
 *
 * @param {string} expr - The scope expression
 * @returns {object} A mock AST object
 */
export function generateMockAst(expr) {
  // Create a simple mock AST structure that matches what the parser would generate
  return {
    type: 'Source',
    kind: 'mock',
    expression: expr,
    // Add a mock timestamp to make each AST unique if needed
    _mock: true,
    _timestamp: Date.now(),
  };
}

/**
 * Converts a scope definition without AST to one with a mock AST
 *
 * @param {object} scopeDef - Scope definition with at least an expr property
 * @returns {object} Scope definition with added ast property
 */
export function addMockAst(scopeDef) {
  if (!scopeDef.expr) {
    throw new Error('Scope definition must have an expr property');
  }

  return {
    ...scopeDef,
    ast: scopeDef.ast || generateMockAst(scopeDef.expr),
  };
}

/**
 * Converts multiple scope definitions to include mock ASTs
 *
 * @param {object} scopes - Object with scope names as keys and definitions as values
 * @returns {object} Updated scopes with ASTs
 */
export function addMockAstsToScopes(scopes) {
  const updated = {};
  for (const [name, def] of Object.entries(scopes)) {
    updated[name] = addMockAst(def);
  }
  return updated;
}
