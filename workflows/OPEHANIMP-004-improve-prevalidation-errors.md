# OPEHANIMP-004: Implement Improved Error Messages in preValidationUtils.js

**Priority**: High
**Effort**: Medium
**Phase**: 1 (Day 2)
**Dependencies**: None

## Objective

Enhance error messages in `preValidationUtils.js` to provide actionable guidance with specific file paths, code snippets, and verification commands when operation validation fails.

## Background

Current error message: "Unknown operation type: DRINK_FROM"

This provides no guidance on:
- What file to update
- What code to add
- How to verify the fix
- Why this error occurred

Developers waste 1-2 hours debugging because the error doesn't point them to the solution.

## Requirements

### 1. Create Custom Error Class

**File**: `src/errors/operationValidationError.js`

```javascript
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
 * @extends Error
 */
class OperationValidationError extends Error {
  /**
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
      idx === 0 ? word : word.charAt(0) + word.slice(1)
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
      idx === 0 ? word : word.charAt(0) + word.slice(1)
    ).join('') + '.schema.json';
    lines.push('');
    lines.push('  ⚠️  SCHEMA NOT REFERENCED IN operation.schema.json');
    lines.push('  File: data/schemas/operations/operation.schema.json');
    lines.push('  Location: oneOf array');
    lines.push('  Action: Add $ref entry (keep alphabetically sorted)');
    lines.push(`  Code to add: { "$ref": "./${schemaFileName}" },`);
    lines.push('');
    lines.push('  Example:');
    lines.push('  ```json');
    lines.push('  {');
    lines.push('    "oneOf": [');
    lines.push('      { "$ref": "./addComponent.schema.json" },');
    lines.push(`      { "$ref": "./${schemaFileName}" },  // <-- Add this line`);
    lines.push('      { "$ref": "./removeComponent.schema.json" }');
    lines.push('    ]');
    lines.push('  }');
    lines.push('  ```');
  }

  lines.push('');
  lines.push('🔧 Verification commands:');
  lines.push('  After fixing, run these commands to verify:');
  lines.push('  1. npm run validate:schemas     # Verify schema is valid');
  lines.push('  2. npm run validate:operations  # Verify all registrations');
  lines.push('  3. npm run test:unit            # Run unit tests');
  lines.push('');
  lines.push('📚 Complete registration guide:');
  lines.push('  - CLAUDE.md (search "Adding New Operations")');
  lines.push('  - docs/adding-operations.md');
  lines.push('');
  lines.push('💡 Tip: Use `npm run create-operation <name>` to scaffold new operations automatically');

  return lines.join('\n');
}

export default OperationValidationError;
```

### 2. Enhanced Validation Function

**File**: `src/utils/preValidationUtils.js`

Update the validation logic to provide comprehensive checks:

```javascript
import fs from 'fs';
import path from 'path';
import OperationValidationError from '../errors/operationValidationError.js';

/**
 * CRITICAL: Pre-validation whitelist for operation types
 * [... existing documentation from OPEHANIMP-002 ...]
 */
const KNOWN_OPERATION_TYPES = [
  'ADD_COMPONENT',
  'REMOVE_COMPONENT',
  'DRINK_FROM',
  'DRINK_ENTIRELY',
  // ... other operations
];

/**
 * Validates operation type and checks all registration points
 *
 * Performs comprehensive validation:
 * 1. Checks if type is in KNOWN_OPERATION_TYPES whitelist
 * 2. Verifies schema file exists
 * 3. Checks schema is referenced in operation.schema.json
 *
 * @param {string} operationType - The operation type to validate
 * @param {ILogger} logger - Logger instance
 * @throws {OperationValidationError} If any registration is missing
 */
export function validateOperationType(operationType, logger) {
  const missingRegistrations = [];

  // Check 1: Whitelist
  if (!KNOWN_OPERATION_TYPES.includes(operationType)) {
    missingRegistrations.push('whitelist');
  }

  // Check 2: Schema exists
  const schemaFileName = operationType.toLowerCase().split('_').map((word, idx) =>
    idx === 0 ? word : word.charAt(0) + word.slice(1)
  ).join('') + '.schema.json';
  const schemaPath = path.join(process.cwd(), 'data/schemas/operations', schemaFileName);

  if (!fs.existsSync(schemaPath)) {
    missingRegistrations.push('schema');
  }

  // Check 3: Schema referenced in operation.schema.json
  const operationSchemaPath = path.join(process.cwd(), 'data/schemas/operations/operation.schema.json');

  try {
    const operationSchemaContent = fs.readFileSync(operationSchemaPath, 'utf8');
    const operationSchema = JSON.parse(operationSchemaContent);

    const isReferenced = operationSchema.oneOf?.some(ref =>
      ref.$ref?.includes(schemaFileName)
    );

    if (!isReferenced) {
      missingRegistrations.push('reference');
    }
  } catch (error) {
    logger.warn('Could not verify schema reference', { error: error.message });
  }

  // If any checks failed, throw detailed error
  if (missingRegistrations.length > 0) {
    const error = new OperationValidationError(operationType, missingRegistrations);
    logger.error('Operation validation failed', {
      operationType,
      missingRegistrations,
      errorMessage: error.message,
    });
    throw error;
  }

  // All checks passed
  logger.debug('Operation type validation passed', { operationType });
}
```

### 3. Update Error Import in Consumers

Update any files that call `validateOperationType` to handle the new error type:

**Example**: In rule validation code

```javascript
import OperationValidationError from '../errors/operationValidationError.js';

try {
  validateOperationType(operation.type, logger);
} catch (error) {
  if (error instanceof OperationValidationError) {
    // Error message already formatted with guidance
    console.error(error.message);
    throw error;
  }
  // Handle other errors
  throw error;
}
```

## Acceptance Criteria

- [ ] `OperationValidationError` class is created with comprehensive formatting
- [ ] Error messages include:
  - Clear problem identification
  - Specific file paths to update
  - Exact code snippets to add
  - Verification commands
  - Links to documentation
- [ ] `validateOperationType` performs all three checks (whitelist, schema exists, schema referenced)
- [ ] Error messages use emojis and formatting for readability
- [ ] All existing callers handle the new error type
- [ ] Tests are added for error formatting
- [ ] Error messages are tested with actual invalid operations

## Testing

### Unit Tests

**File**: `tests/unit/utils/preValidationUtils.test.js`

```javascript
describe('validateOperationType - Enhanced Error Messages', () => {
  it('should provide detailed error for missing whitelist entry', () => {
    expect(() => {
      validateOperationType('NEW_OPERATION', mockLogger);
    }).toThrow(OperationValidationError);

    expect(() => {
      validateOperationType('NEW_OPERATION', mockLogger);
    }).toThrow(/NOT IN PRE-VALIDATION WHITELIST/);

    expect(() => {
      validateOperationType('NEW_OPERATION', mockLogger);
    }).toThrow(/src\/utils\/preValidationUtils\.js/);
  });

  it('should provide detailed error for missing schema file', () => {
    // Mock KNOWN_OPERATION_TYPES to include operation
    // Mock file system to return false for schema file
    expect(() => {
      validateOperationType('MISSING_SCHEMA', mockLogger);
    }).toThrow(/SCHEMA FILE NOT FOUND/);
  });

  it('should provide detailed error for missing schema reference', () => {
    // Mock all checks to pass except schema reference
    expect(() => {
      validateOperationType('UNREFERENCED', mockLogger);
    }).toThrow(/SCHEMA NOT REFERENCED/);
  });

  it('should pass validation for fully registered operation', () => {
    expect(() => {
      validateOperationType('ADD_COMPONENT', mockLogger);
    }).not.toThrow();
  });
});
```

### Integration Test

Create a test that triggers the error in a real scenario and verifies the output.

## Implementation Notes

- Use Node.js `fs` module for file system checks (already in dependencies)
- Handle file system errors gracefully
- Format error messages for terminal output (emoji support)
- Keep error messages under 80 columns where possible for readability

## Time Estimate

4-5 hours (including testing)

## Related Tickets

- OPEHANIMP-001: Update CLAUDE.md with enhanced checklist
- OPEHANIMP-005: Enhance error messages in operation registry

## Success Metrics

- Debugging time reduced from 1-2 hours to <15 minutes
- Developers can fix errors without consulting documentation
- Zero support requests about "Unknown operation type" errors
