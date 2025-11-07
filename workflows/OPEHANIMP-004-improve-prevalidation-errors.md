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
```

### 2. Enhanced Validation Function

**File**: `src/utils/preValidationUtils.js`

**IMPORTANT**: This file is imported by `schemaValidationUtils.js` which runs in browser contexts. We CANNOT use Node.js `fs` or `path` modules here. The enhanced validation must work without file system access.

Update the validation logic to provide comprehensive error messages without file system checks:

```javascript
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
 * Validates operation type against whitelist
 *
 * Performs validation:
 * 1. Checks if type is in KNOWN_OPERATION_TYPES whitelist
 * 2. Provides detailed error messages with actionable guidance
 *
 * Note: This function runs in both Node.js and browser contexts,
 * so it cannot perform file system checks. The error message includes
 * guidance for all potential missing registrations based on the whitelist check.
 *
 * @param {string} operationType - The operation type to validate
 * @param {ILogger} logger - Logger instance
 * @throws {OperationValidationError} If operation is not in whitelist
 */
export function validateOperationType(operationType, logger) {
  // Check whitelist
  if (!KNOWN_OPERATION_TYPES.includes(operationType)) {
    // Assume all registration types might be missing since we can't check file system
    const missingRegistrations = ['whitelist', 'schema', 'reference'];

    const error = new OperationValidationError(operationType, missingRegistrations);
    logger.error('Operation validation failed', {
      operationType,
      missingRegistrations,
      errorMessage: error.message,
    });
    throw error;
  }

  // Validation passed
  logger.debug('Operation type validation passed', { operationType });
}
```

### 3. Alternative Approach: Enhanced Validation Script

Since `preValidationUtils.js` cannot use Node.js file system APIs, create a separate validation script for comprehensive pre-flight checks:

**File**: `scripts/validateOperationRegistrations.js`

```javascript
#!/usr/bin/env node

/**
 * @file Validates that all operations are properly registered across the codebase
 * @description Checks schema files, schema references, and whitelist consistency
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Read KNOWN_OPERATION_TYPES from preValidationUtils.js
const preValidationUtilsPath = path.join(projectRoot, 'src/utils/preValidationUtils.js');
const preValidationContent = fs.readFileSync(preValidationUtilsPath, 'utf8');
const knownOpsMatch = preValidationContent.match(/const KNOWN_OPERATION_TYPES = \[([\s\S]*?)\];/);
const knownOperations = knownOpsMatch[1]
  .split('\n')
  .map(line => line.trim())
  .filter(line => line.startsWith("'"))
  .map(line => line.replace(/^'|',?$/g, ''));

console.log(`Found ${knownOperations.length} operations in KNOWN_OPERATION_TYPES\n`);

// Check each operation
let hasErrors = false;

for (const operationType of knownOperations) {
  const schemaFileName = operationType.toLowerCase().split('_').map((word, idx) =>
    idx === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join('') + '.schema.json';

  const schemaPath = path.join(projectRoot, 'data/schemas/operations', schemaFileName);

  // Check 1: Schema file exists
  if (!fs.existsSync(schemaPath)) {
    console.error(`❌ ${operationType}: Schema file missing`);
    console.error(`   Expected: data/schemas/operations/${schemaFileName}\n`);
    hasErrors = true;
    continue;
  }

  // Check 2: Schema referenced in operation.schema.json
  const operationSchemaPath = path.join(projectRoot, 'data/schemas/operation.schema.json');
  const operationSchemaContent = fs.readFileSync(operationSchemaPath, 'utf8');

  if (!operationSchemaContent.includes(`./operations/${schemaFileName}`)) {
    console.error(`❌ ${operationType}: Not referenced in operation.schema.json`);
    console.error(`   Add: { "$ref": "./operations/${schemaFileName}" } to anyOf array\n`);
    hasErrors = true;
  } else {
    console.log(`✅ ${operationType}: All registrations valid`);
  }
}

if (hasErrors) {
  console.error('\n❌ Operation registration validation FAILED');
  process.exit(1);
} else {
  console.log('\n✅ All operations properly registered');
  process.exit(0);
}
```

### 4. Update package.json

Add the new validation script:

```json
{
  "scripts": {
    "validate:operations": "node scripts/validateOperationRegistrations.js"
  }
}
```

### 5. Update Error Import in Consumers

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
- [ ] `validateOperationType` throws `OperationValidationError` with actionable guidance
- [ ] Separate validation script created for comprehensive file system checks
- [ ] Error messages use emojis and formatting for readability
- [ ] All existing callers handle the new error type
- [ ] Tests are added for error formatting
- [ ] Error messages are tested with actual invalid operations
- [ ] Browser compatibility maintained (no Node.js modules in preValidationUtils.js)

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

  it('should include guidance for all potential issues', () => {
    try {
      validateOperationType('MISSING_OP', mockLogger);
      fail('Should have thrown');
    } catch (error) {
      expect(error.message).toMatch(/SCHEMA FILE NOT FOUND/);
      expect(error.message).toMatch(/SCHEMA NOT REFERENCED/);
      expect(error.message).toMatch(/NOT IN PRE-VALIDATION WHITELIST/);
    }
  });

  it('should pass validation for fully registered operation', () => {
    expect(() => {
      validateOperationType('ADD_COMPONENT', mockLogger);
    }).not.toThrow();
  });

  it('should provide correct verification commands', () => {
    try {
      validateOperationType('BAD_OP', mockLogger);
      fail('Should have thrown');
    } catch (error) {
      expect(error.message).toMatch(/npm run validate/);
      expect(error.message).toMatch(/npm run validate:strict/);
      expect(error.message).toMatch(/npm run test:unit/);
    }
  });
});
```

### Integration Test

**File**: `tests/integration/validation/operationValidationError.test.js`

Create a test that triggers the error in a real scenario and verifies the output.

## Implementation Notes

- **CRITICAL**: `preValidationUtils.js` is used in browser contexts and CANNOT use Node.js `fs` or `path` modules
- Separate the comprehensive validation into a Node.js script (`validateOperationRegistrations.js`)
- Keep error messages under 80 columns where possible for readability
- Use emoji formatting for better visual parsing
- Reference correct schema structure (`anyOf` not `oneOf`)
- Point to correct file paths (`data/schemas/operation.schema.json`)
- Use actual available npm commands (`npm run validate`, `npm run validate:strict`)

## Time Estimate

5-6 hours (including script creation and testing)

## Related Tickets

- OPEHANIMP-001: Update CLAUDE.md with enhanced checklist (already completed)
- OPEHANIMP-005: Enhance error messages in operation registry

## Success Metrics

- Debugging time reduced from 1-2 hours to <15 minutes
- Developers can fix errors without consulting documentation
- Zero support requests about "Unknown operation type" errors
- Browser compatibility maintained (no broken imports)
