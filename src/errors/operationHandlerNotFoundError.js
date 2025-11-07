/**
 * @file Custom error for operation handler not found
 * @see ../logic/operationInterpreter.js
 */

/**
 * Error thrown when an operation handler is not registered
 *
 * Provides detailed, actionable error messages with:
 * - Diagnostic checklist of registration state
 * - List of currently registered operations
 * - Specific file paths to update
 * - Code snippets to add
 * - Verification commands
 *
 * @augments Error
 */
class OperationHandlerNotFoundError extends Error {
  /**
   * Creates a new OperationHandlerNotFoundError instance with detailed,
   * actionable error messages
   *
   * @param {string} operationType - The operation type that has no handler
   * @param {string[]} registeredOperations - List of all registered operation types
   * @param {object} diagnostics - Diagnostic information about registration state
   * @param {boolean|null} diagnostics.schemaExists - Whether schema file exists
   * @param {boolean|null} diagnostics.schemaReferenced - Whether schema is referenced
   * @param {boolean} diagnostics.inWhitelist - Whether type is in KNOWN_OPERATION_TYPES
   * @param {boolean|null} diagnostics.tokenDefined - Whether DI token is defined
   * @param {boolean} diagnostics.handlerRegistered - Whether handler is registered
   */
  constructor(operationType, registeredOperations, diagnostics) {
    const message = formatHandlerNotFoundError(
      operationType,
      registeredOperations,
      diagnostics
    );
    super(message);
    this.name = 'OperationHandlerNotFoundError';
    this.operationType = operationType;
    this.registeredOperations = registeredOperations;
    this.diagnostics = diagnostics;
  }
}

/**
 * Formats detailed error message for missing handler
 *
 * @param {string} operationType - The operation type that has no handler
 * @param {string[]} registeredOperations - List of all registered operation types
 * @param {object} diagnostics - Diagnostic information about registration state
 * @returns {string} Formatted error message
 */
function formatHandlerNotFoundError(
  operationType,
  registeredOperations,
  diagnostics
) {
  const lines = [
    `❌ No handler registered for operation type: "${operationType}"`,
    '',
    'The operation type exists in the schema but is not mapped to a handler.',
    '',
    '📋 Required registrations checklist:',
    '',
  ];

  // Show diagnostic checks
  lines.push(
    `  ${diagnostics.schemaExists === null ? '?' : diagnostics.schemaExists ? '✓' : '✗'} Schema file exists`
  );
  lines.push(
    `  ${diagnostics.schemaReferenced === null ? '?' : diagnostics.schemaReferenced ? '✓' : '✗'} Schema referenced in operation.schema.json`
  );
  lines.push(
    `  ${diagnostics.inWhitelist ? '✓' : '✗'} Type in KNOWN_OPERATION_TYPES whitelist`
  );
  lines.push(
    `  ${diagnostics.tokenDefined === null ? '?' : diagnostics.tokenDefined ? '✓' : '✗'} Token defined`
  );
  lines.push(
    `  ${diagnostics.handlerRegistered ? '✓' : '✗'} Handler registered`
  );
  lines.push(`  ✗ Operation mapped (MISSING - this is the current error)`);
  lines.push('');

  // Provide fix instructions
  lines.push('🔧 To fix this:');
  lines.push('');

  // Convert DRINK_FROM -> DrinkFromHandler (no 'I' prefix for operation handlers)
  const tokenName =
    operationType
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join('') + 'Handler';

  if (!diagnostics.inWhitelist) {
    lines.push('⚠️  CRITICAL: Operation not in whitelist');
    lines.push('   File: src/utils/preValidationUtils.js');
    lines.push('   Add to: KNOWN_OPERATION_TYPES array');
    lines.push(`   Code: '${operationType}',`);
    lines.push('');
  }

  if (!diagnostics.tokenDefined) {
    lines.push('1. Define the token:');
    lines.push('   File: src/dependencyInjection/tokens/tokens-core.js');
    lines.push(`   Add: ${tokenName}: '${tokenName}',`);
    lines.push(
      '   Note: Operation handlers do NOT use "I" prefix (e.g., DrinkFromHandler, not IDrinkFromHandler)'
    );
    lines.push('');
  }

  if (!diagnostics.handlerRegistered) {
    lines.push('2. Register the handler:');
    lines.push(
      '   File: src/dependencyInjection/registrations/operationHandlerRegistrations.js'
    );
    lines.push(`   Add to handlerFactories array:`);
    lines.push(
      `   [tokens.${tokenName}, ${tokenName}, (c, Handler) => new Handler({...})],`
    );
    lines.push('');
  }

  lines.push('3. Map the operation:');
  lines.push(
    '   File: src/dependencyInjection/registrations/interpreterRegistrations.js'
  );
  lines.push(
    `   Add: registry.register('${operationType}', bind(tokens.${tokenName}));`
  );
  lines.push('');

  // Show registered operations
  lines.push(
    `📊 Currently registered operations (${registeredOperations.length} total):`
  );

  if (registeredOperations.length === 0) {
    lines.push('  (none - registry may not be initialized)');
  } else if (registeredOperations.length <= 10) {
    registeredOperations.forEach((op) => lines.push(`  - ${op}`));
  } else {
    registeredOperations.slice(0, 10).forEach((op) => lines.push(`  - ${op}`));
    lines.push(`  ... and ${registeredOperations.length - 10} more`);
    lines.push('');
    lines.push(
      '💡 Tip: Check if your operation type has a typo by comparing to the list above'
    );
  }

  lines.push('');
  lines.push('🔍 Verification:');
  lines.push('  npm run validate  # Check registration completeness');
  lines.push('  npm run test:unit # Run unit tests');
  lines.push('');
  lines.push('📚 Complete guide:');
  lines.push('  CLAUDE.md (search "Adding New Operations - Complete Checklist")');

  return lines.join('\n');
}

export default OperationHandlerNotFoundError;
