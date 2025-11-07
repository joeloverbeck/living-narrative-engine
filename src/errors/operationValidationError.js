/**
 * @file Custom error for operation validation failures
 */

/**
 * Error thrown when operation validation fails
 *
 * Provides detailed, actionable error messages with:
 * - Specific missing registrations
 * - File paths to update
 * - Code snippets to add
 * - Verification commands
 *
 * @augments Error
 */
class OperationValidationError extends Error {
  /**
   * Creates a new OperationValidationError instance with detailed, actionable error messages
   *
   * @param {string} operationType - The operation type that failed validation
   * @param {string[]} missingRegistrations - Array of missing registration types
   */
  constructor(operationType, missingRegistrations) {
    const message = formatValidationError(operationType, missingRegistrations);
    super(message);
    this.name = 'OperationValidationError';
    this.operationType = operationType;
    this.missingRegistrations = missingRegistrations;
  }
}

/**
 * Formats a detailed error message with actionable guidance
 *
 * @param {string} operationType - Operation type that failed
 * @param {string[]} missingRegistrations - Types of missing registrations
 * @returns {string} Formatted error message
 */
function formatValidationError(operationType, missingRegistrations) {
  const lines = [
    `❌ Operation validation failed for: "${operationType}"`,
    '',
    '📋 Missing registrations detected:',
  ];

  // Check for whitelist missing
  if (missingRegistrations.includes('whitelist')) {
    lines.push('');
    lines.push('  ⚠️  NOT IN PRE-VALIDATION WHITELIST');
    lines.push('  File: src/utils/preValidationUtils.js');
    lines.push('  Location: KNOWN_OPERATION_TYPES array');
    lines.push('  Action: Add to array (keep alphabetically sorted)');
    lines.push(`  Code to add: '${operationType}',`);
    lines.push('');
    lines.push('  Example:');
    lines.push('  ```javascript');
    lines.push('  const KNOWN_OPERATION_TYPES = [');
    lines.push('    \'ADD_COMPONENT\',');
    lines.push(`    '${operationType}',  // <-- Add this line`);
    lines.push('    \'REMOVE_COMPONENT\',');
    lines.push('  ];');
    lines.push('  ```');
  }

  // Check for schema missing
  if (missingRegistrations.includes('schema')) {
    lines.push('');
    lines.push('  ⚠️  SCHEMA FILE NOT FOUND');
    const schemaFileName = operationType.toLowerCase().split('_').map((word, idx) =>
      idx === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join('') + '.schema.json';
    lines.push(`  Expected: data/schemas/operations/${schemaFileName}`);
    lines.push('  Action: Create schema file following the pattern:');
    lines.push('  - Extend base-operation.schema.json');
    lines.push(`  - Define type constant: "${operationType}"`);
    lines.push('  - Define operation parameters');
  }

  // Check for schema reference missing
  if (missingRegistrations.includes('reference')) {
    const schemaFileName = operationType.toLowerCase().split('_').map((word, idx) =>
      idx === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join('') + '.schema.json';
    lines.push('');
    lines.push('  ⚠️  SCHEMA NOT REFERENCED IN operation.schema.json');
    lines.push('  File: data/schemas/operation.schema.json');
    lines.push('  Location: anyOf array within Operation definition');
    lines.push('  Action: Add $ref entry (keep alphabetically sorted)');
    lines.push(`  Code to add: { "$ref": "./operations/${schemaFileName}" },`);
    lines.push('');
    lines.push('  Example:');
    lines.push('  ```json');
    lines.push('  {');
    lines.push('    "anyOf": [');
    lines.push('      { "$ref": "./operations/addComponent.schema.json" },');
    lines.push(`      { "$ref": "./operations/${schemaFileName}" },  // <-- Add this line`);
    lines.push('      { "$ref": "./operations/removeComponent.schema.json" }');
    lines.push('    ]');
    lines.push('  }');
    lines.push('  ```');
  }

  lines.push('');
  lines.push('🔧 Verification commands:');
  lines.push('  After fixing, run these commands to verify:');
  lines.push('  1. npm run validate          # Verify schema is valid');
  lines.push('  2. npm run validate:strict   # Strict validation with all checks');
  lines.push('  3. npm run test:unit         # Run unit tests');
  lines.push('');
  lines.push('📚 Complete registration guide:');
  lines.push('  - CLAUDE.md (search "Adding New Operations - Complete Checklist")');
  lines.push('');
  lines.push('💡 Tip: Follow the 8-step checklist in CLAUDE.md for complete operation setup');

  return lines.join('\n');
}

export default OperationValidationError;
