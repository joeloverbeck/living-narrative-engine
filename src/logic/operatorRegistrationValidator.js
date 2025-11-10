/**
 * @file Operator Registration Validator
 * @description Validates JSON Logic operator registration and whitelist synchronization
 */

/**
 * Validate that all registered operators are in the allowed operations set.
 *
 * @param {Set<string>} registeredOperators - Set of registered operator names
 * @param {Set<string>} allowedOperations - Set of whitelisted operator names
 * @param {object} logger - Logger for diagnostic output
 * @throws {Error} If registered operators are not whitelisted
 */
export function validateOperatorWhitelist(
  registeredOperators,
  allowedOperations,
  logger
) {
  const missingOperators = [];
  const extraOperators = [];

  // Check for operators that are registered but not whitelisted
  for (const operator of registeredOperators) {
    if (!allowedOperations.has(operator)) {
      missingOperators.push(operator);
    }
  }

  // Check for operators that are whitelisted but not registered
  for (const operator of allowedOperations) {
    // Skip standard json-logic-js operators
    if (isStandardOperator(operator)) {
      continue;
    }

    if (!registeredOperators.has(operator)) {
      extraOperators.push(operator);
    }
  }

  // Log warnings for extra operators (not critical)
  if (extraOperators.length > 0) {
    logger.warn(
      'Operators in ALLOWED_OPERATIONS whitelist but not registered',
      {
        operators: extraOperators,
        note: 'These may be legacy operators that were removed. Consider cleaning up the whitelist.',
      }
    );
  }

  // Throw error for missing operators (critical)
  if (missingOperators.length > 0) {
    const message =
      `Custom operators are registered but not in ALLOWED_OPERATIONS whitelist.\n` +
      `\n` +
      `Missing operators: ${missingOperators.join(', ')}\n` +
      `\n` +
      `To fix: Add these operators to ALLOWED_OPERATIONS in JsonLogicEvaluationService:\n` +
      `\n` +
      `const ALLOWED_OPERATIONS = new Set([\n` +
      `  // ... existing operators ...\n` +
      missingOperators.map((op) => `  '${op}',`).join('\n') +
      '\n' +
      `]);\n`;

    logger.error('Operator whitelist validation failed', {
      missingOperators,
      totalRegistered: registeredOperators.size,
      totalAllowed: allowedOperations.size,
    });

    throw new Error(message);
  }
}

/**
 * Check if operator is a standard json-logic-js operator.
 *
 * @param {string} operator - Operator name
 * @returns {boolean} True if standard operator
 */
function isStandardOperator(operator) {
  const standardOperators = new Set([
    // Standard json-logic-js operators
    'var',
    'missing',
    'missing_some',
    'if',
    '==',
    '===',
    '!=',
    '!==',
    '!',
    '!!',
    'or',
    'and',
    '>',
    '>=',
    '<',
    '<=',
    'max',
    'min',
    '+',
    '-',
    '*',
    '/',
    '%',
    'map',
    'filter',
    'reduce',
    'all',
    'none',
    'some',
    'merge',
    'in',
    'cat',
    'substr',
    'log',
    'not',
    'has',
    'toLowerCase',
    'toUpperCase',
  ]);

  return standardOperators.has(operator);
}

/**
 * Generate allowed operations set from registered operators.
 *
 * @param {Set<string>} registeredOperators - Set of registered operator names
 * @param {Array<string>} additionalOperators - Additional standard operators to include
 * @returns {Set<string>} Complete set of allowed operations
 */
export function generateAllowedOperations(
  registeredOperators,
  additionalOperators = []
) {
  const allowed = new Set();

  // Add all registered custom operators
  for (const operator of registeredOperators) {
    allowed.add(operator);
  }

  // Add standard json-logic-js operators
  const standardOps = [
    'var',
    'missing',
    'missing_some',
    'if',
    '==',
    '===',
    '!=',
    '!==',
    '!',
    '!!',
    'or',
    'and',
    '>',
    '>=',
    '<',
    '<=',
    'max',
    'min',
    '+',
    '-',
    '*',
    '/',
    '%',
    'map',
    'filter',
    'reduce',
    'all',
    'none',
    'some',
    'merge',
    'in',
    'cat',
    'substr',
    'log',
    'not',
    'has',
    'toLowerCase',
    'toUpperCase',
  ];

  for (const op of standardOps) {
    allowed.add(op);
  }

  // Add any additional operators
  for (const op of additionalOperators) {
    allowed.add(op);
  }

  return allowed;
}
