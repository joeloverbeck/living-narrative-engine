/**
 * @file Custom error for operation validation failures
 */

import {
  toSchemaFileName,
  toTokenName,
  toHandlerClassName,
} from '../utils/operationNamingUtils.js';

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
  // Use helper functions for naming conventions (avoid duplication)
  const schemaFileName = toSchemaFileName(operationType);
  const tokenName = toTokenName(operationType);
  const handlerClassName = toHandlerClassName(operationType);

  const lines = [
    `❌ Operation validation failed for: "${operationType}"`,
    '',
    '📋 Missing registrations detected:',
  ];

  // Check for whitelist missing
  if (missingRegistrations.includes('whitelist')) {
    lines.push('');
    lines.push('  ⚠️  STEP 7: NOT IN PRE-VALIDATION WHITELIST');
    lines.push('  File: src/utils/preValidationUtils.js');
    lines.push('  Location: KNOWN_OPERATION_TYPES array');
    lines.push('  Action: Add to array (keep alphabetically sorted)');
    lines.push(`  Code to add: '${operationType}',`);
    lines.push('');
    lines.push('  Example:');
    lines.push('  ```javascript');
    lines.push('  const KNOWN_OPERATION_TYPES = [');
    lines.push("    'ADD_COMPONENT',");
    lines.push(`    '${operationType}',  // <-- Add this line`);
    lines.push("    'REMOVE_COMPONENT',");
    lines.push('  ];');
    lines.push('  ```');
  }

  // Check for schema missing
  if (missingRegistrations.includes('schema')) {
    lines.push('');
    lines.push('  ⚠️  STEP 1: SCHEMA FILE NOT FOUND');
    lines.push(`  Expected: data/schemas/operations/${schemaFileName}`);
    lines.push('  Action: Create schema file following the pattern:');
    lines.push('  - Extend base-operation.schema.json with "allOf"');
    lines.push(`  - Define type constant: "${operationType}"`);
    lines.push('  - Define operation parameters');
    lines.push('');
    lines.push('  Example:');
    lines.push('  ```json');
    lines.push('  {');
    lines.push('    "$schema": "http://json-schema.org/draft-07/schema#",');
    lines.push(`    "allOf": [{ "$ref": "../base-operation.schema.json" }],`);
    lines.push('    "properties": {');
    lines.push(`      "type": { "const": "${operationType}" },`);
    lines.push('      "parameters": { ... }');
    lines.push('    }');
    lines.push('  }');
    lines.push('  ```');
  }

  // Check for schema reference missing
  if (missingRegistrations.includes('reference')) {
    lines.push('');
    lines.push('  ⚠️  STEP 2: SCHEMA NOT REFERENCED IN operation.schema.json');
    lines.push('  File: data/schemas/operation.schema.json');
    lines.push('  Location: $defs.Operation.anyOf array');
    lines.push('  Action: Add $ref entry (keep alphabetically sorted)');
    lines.push(`  Code to add: { "$ref": "./operations/${schemaFileName}" },`);
    lines.push('');
    lines.push('  Example:');
    lines.push('  ```json');
    lines.push('  {');
    lines.push('    "$defs": {');
    lines.push('      "Operation": {');
    lines.push('        "anyOf": [');
    lines.push(
      '          { "$ref": "./operations/addComponent.schema.json" },'
    );
    lines.push(
      `          { "$ref": "./operations/${schemaFileName}" },  // <-- Add this`
    );
    lines.push(
      '          { "$ref": "./operations/removeComponent.schema.json" }'
    );
    lines.push('        ]');
    lines.push('      }');
    lines.push('    }');
    lines.push('  }');
    lines.push('  ```');
  }

  // Check for token missing
  if (missingRegistrations.includes('token')) {
    lines.push('');
    lines.push('  ⚠️  STEP 4: DI TOKEN NOT DEFINED');
    lines.push('  File: src/dependencyInjection/tokens/tokens-core.js');
    lines.push('  Location: tokens object');
    lines.push('  Action: Add token definition (keep alphabetically sorted)');
    lines.push(`  Code to add: ${tokenName}: '${tokenName}',`);
    lines.push('');
    lines.push('  NOTE: Operation handlers do NOT use "I" prefix');
    lines.push('');
    lines.push('  Example:');
    lines.push('  ```javascript');
    lines.push('  export const tokens = {');
    lines.push("    AddComponentHandler: 'AddComponentHandler',");
    lines.push(`    ${tokenName}: '${tokenName}',  // <-- Add this`);
    lines.push("    RemoveComponentHandler: 'RemoveComponentHandler',");
    lines.push('  };');
    lines.push('  ```');
  }

  // Check for handler registration missing
  if (missingRegistrations.includes('handler')) {
    lines.push('');
    lines.push('  ⚠️  STEP 5: HANDLER NOT REGISTERED IN DI');
    lines.push(
      '  File: src/dependencyInjection/registrations/operationHandlerRegistrations.js'
    );
    lines.push('  Action: Add handler to handlerFactories array');
    lines.push('');
    lines.push('  Step 1: Import the handler class:');
    lines.push(
      `  import ${handlerClassName} from '../../logic/operationHandlers/${operationType.toLowerCase().split('_').join('')}Handler.js';`
    );
    lines.push('');
    lines.push('  Step 2: Add factory to handlerFactories array:');
    lines.push('  ```javascript');
    lines.push('  {');
    lines.push(`    token: tokens.${tokenName},`);
    lines.push(
      `    factory: ({ logger, eventBus, ... }) => new ${handlerClassName}({`
    );
    lines.push('      logger,');
    lines.push('      eventBus,');
    lines.push('      // ... other dependencies');
    lines.push('    })');
    lines.push('  },');
    lines.push('  ```');
  }

  // Check for operation mapping missing
  if (missingRegistrations.includes('mapping')) {
    lines.push('');
    lines.push('  ⚠️  STEP 6: OPERATION NOT MAPPED IN REGISTRY');
    lines.push(
      '  File: src/dependencyInjection/registrations/interpreterRegistrations.js'
    );
    lines.push('  Location: Registry setup in configureRegistry function');
    lines.push('  Action: Map operation type to handler token');
    lines.push(
      `  Code to add: registry.register('${operationType}', bind(tokens.${tokenName}));`
    );
    lines.push('');
    lines.push('  Example:');
    lines.push('  ```javascript');
    lines.push('  function configureRegistry(registry, container) {');
    lines.push('    const bind = (token) => () => container.resolve(token);');
    lines.push('');
    lines.push(
      "    registry.register('ADD_COMPONENT', bind(tokens.AddComponentHandler));"
    );
    lines.push(
      `    registry.register('${operationType}', bind(tokens.${tokenName}));  // <-- Add`
    );
    lines.push(
      "    registry.register('REMOVE_COMPONENT', bind(tokens.RemoveComponentHandler));"
    );
    lines.push('  }');
    lines.push('  ```');
  }

  lines.push('');
  lines.push('🔧 Verification commands:');
  lines.push('  After fixing, run these commands to verify:');
  lines.push('  1. npm run validate          # Verify schema is valid');
  lines.push(
    '  2. npm run validate:strict   # Strict validation with all checks'
  );
  lines.push('  3. npm run typecheck         # TypeScript type checking');
  lines.push('  4. npm run test:unit         # Run unit tests');
  lines.push('  5. npm run test:integration  # Run integration tests');
  lines.push('');
  lines.push('📚 Complete registration guide:');
  lines.push(
    '  - CLAUDE.md (search "Adding New Operations - Complete Checklist")'
  );
  lines.push('  - Covers all 8 steps with examples and verification');
  lines.push('');
  lines.push(
    '💡 Tip: Follow the 8-step checklist in CLAUDE.md for complete operation setup'
  );
  lines.push(
    '  Missing Step 3 (Create handler)? Check src/logic/operationHandlers/ for examples'
  );

  return lines.join('\n');
}

export default OperationValidationError;
