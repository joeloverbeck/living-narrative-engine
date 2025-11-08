# OPEHANIMP-010: Refactor Pre-validation for Comprehensive Error Checking

**Priority**: Medium
**Effort**: Medium
**Phase**: 2 (Week 3-4)
**Dependencies**: OPEHANIMP-004, OPEHANIMP-008
**Status**: ⚠️ BLOCKED - Requires architectural decision on browser/Node.js context

## Objective

Refactor the pre-validation system to perform comprehensive checks beyond just the whitelist, providing detailed diagnostic information about what registrations are missing and actionable guidance for fixing them.

## Background

Current pre-validation only checks if an operation type is in `KNOWN_OPERATION_TYPES`. This ticket extends pre-validation to check all registration points and provide comprehensive diagnostics, similar to the build-time validation but at runtime with operation-specific context.

## ⚠️ CRITICAL BLOCKER

**Issue**: The current `preValidationUtils.js` explicitly states at lines 93-95:
```javascript
// Note: This function runs in both Node.js and browser contexts,
// so it cannot perform file system checks.
```

**Impact**: The proposed refactor assumes file system access via Node.js `fs` module to check:
- Schema file existence
- Schema references in operation.schema.json
- Token definitions in tokens-core.js

**Decision Required**:
- Option A: Split validation into browser-safe and Node.js-only versions
- Option B: Keep pre-validation browser-safe and rely on build-time validation (OPEHANIMP-008)
- Option C: Move comprehensive checks to a separate build-time/test-time tool

**Recommended**: Option B - Keep pre-validation lightweight and browser-safe, use build-time validation for comprehensive checks.

Until this architectural decision is made, this workflow is **ON HOLD**.

## Requirements

### 1. Enhanced Pre-validation Function (IF IMPLEMENTED)

**File**: `src/utils/preValidationUtils.js`

⚠️ **NOTE**: This implementation assumes Node.js-only context. See blocker section above.

**Current Reality**:
- File runs in both browser and Node.js contexts
- Cannot use `fs` module for file system checks
- Current implementation only validates against `KNOWN_OPERATION_TYPES` whitelist

**Proposed Enhancement** (requires architectural decision):

```javascript
// ⚠️ WARNING: This will break browser compatibility
import fs from 'fs';
import path from 'path';
import OperationValidationError from '../errors/operationValidationError.js';

/**
 * CRITICAL: Pre-validation whitelist for operation types
 * [... existing documentation ...]
 *
 * NOTE: Current production version includes SEQUENCE (added in recent implementation)
 */
const KNOWN_OPERATION_TYPES = [
  // ... existing types including SEQUENCE at line 83
];

/**
 * Comprehensive operation validation result
 *
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Overall validation status
 * @property {Object} checks - Individual check results
 * @property {boolean} checks.inWhitelist - Type in KNOWN_OPERATION_TYPES
 * @property {boolean} checks.schemaExists - Schema file exists
 * @property {boolean} checks.schemaReferenced - Schema in operation.schema.json
 * @property {boolean} checks.tokenDefined - DI token defined
 * @property {boolean} checks.handlerRegistered - Handler registered in DI
 * @property {boolean} checks.operationMapped - Operation mapped in registry
 * @property {string[]} missingRegistrations - List of missing registration types
 * @property {string} operationType - The operation type validated
 */

/**
 * Performs comprehensive validation of an operation type
 *
 * Checks all registration points and returns detailed results
 *
 * @param {string} operationType - The operation type to validate
 * @param {ILogger} logger - Logger instance
 * @param {Object} options - Validation options
 * @param {boolean} [options.throwOnError=true] - Throw error if validation fails
 * @param {boolean} [options.checkHandlerRegistration=false] - Check DI registration (requires container)
 * @param {Object} [options.container=null] - DI container for registration checks
 * @returns {ValidationResult} Detailed validation result
 * @throws {OperationValidationError} If validation fails and throwOnError is true
 */
export function validateOperationType(operationType, logger, options = {}) {
  const {
    throwOnError = true,
    checkHandlerRegistration = false,
    container = null,
  } = options;

  const checks = {
    inWhitelist: false,
    schemaExists: false,
    schemaReferenced: false,
    tokenDefined: false,
    handlerRegistered: false,
    operationMapped: false,
  };

  const missingRegistrations = [];

  // Check 1: Whitelist
  checks.inWhitelist = KNOWN_OPERATION_TYPES.includes(operationType);
  if (!checks.inWhitelist) {
    missingRegistrations.push('whitelist');
  }

  // Check 2: Schema file exists
  const schemaFileName = toSchemaFileName(operationType);
  const schemaPath = path.join(process.cwd(), 'data/schemas/operations', schemaFileName);

  try {
    checks.schemaExists = fs.existsSync(schemaPath);
    if (!checks.schemaExists) {
      missingRegistrations.push('schema');
    }
  } catch (error) {
    logger.warn('Could not check schema file existence', { error: error.message });
  }

  // Check 3: Schema referenced in operation.schema.json
  try {
    // ✅ CORRECTED: Actual path is data/schemas/operation.schema.json (no "operations" subdirectory)
    const operationSchemaPath = path.join(process.cwd(), 'data/schemas/operation.schema.json');
    const operationSchema = JSON.parse(fs.readFileSync(operationSchemaPath, 'utf8'));

    // ✅ CORRECTED: Schema uses "anyOf" not "oneOf" (see operation.schema.json line 37)
    // Must check within $defs.Operation.anyOf array
    checks.schemaReferenced = operationSchema.$defs?.Operation?.anyOf?.some(ref =>
      ref.$ref?.includes(schemaFileName)
    ) || false;

    if (!checks.schemaReferenced) {
      missingRegistrations.push('reference');
    }
  } catch (error) {
    logger.warn('Could not check schema reference', { error: error.message });
  }

  // Check 4: Token defined
  try {
    const tokensPath = path.join(process.cwd(), 'src/dependencyInjection/tokens/tokens-core.js');
    const tokensContent = fs.readFileSync(tokensPath, 'utf8');
    const tokenName = toTokenName(operationType);

    checks.tokenDefined = new RegExp(`${tokenName}:\\s*['"]${tokenName}['"]`).test(tokensContent);

    if (!checks.tokenDefined) {
      missingRegistrations.push('token');
    }
  } catch (error) {
    logger.warn('Could not check token definition', { error: error.message });
  }

  // Check 5: Handler registered (if container provided)
  if (checkHandlerRegistration && container) {
    try {
      const tokenName = toTokenName(operationType);
      // Attempt to resolve - will throw if not registered
      container.resolve(tokenName);
      checks.handlerRegistered = true;
    } catch (error) {
      checks.handlerRegistered = false;
      missingRegistrations.push('handler');
    }
  }

  // Check 6: Operation mapped (can only check at runtime with registry instance)
  // This check is deferred to the operation registry itself

  // Determine overall validity
  const isValid = missingRegistrations.length === 0;

  const result = {
    isValid,
    checks,
    missingRegistrations,
    operationType,
  };

  // Log results
  if (isValid) {
    logger.debug('Operation validation passed', { operationType, checks });
  } else {
    logger.warn('Operation validation failed', {
      operationType,
      checks,
      missingRegistrations,
    });
  }

  // Throw error if requested
  if (!isValid && throwOnError) {
    const error = new OperationValidationError(operationType, missingRegistrations);
    logger.error('Operation validation error', {
      operationType,
      errorMessage: error.message,
    });
    throw error;
  }

  return result;
}

/**
 * Validates multiple operation types in batch
 *
 * @param {string[]} operationTypes - Array of operation types
 * @param {ILogger} logger - Logger instance
 * @param {Object} options - Validation options
 * @returns {Object} Batch validation results
 */
export function validateOperationTypes(operationTypes, logger, options = {}) {
  const results = {
    allValid: true,
    operations: {},
    summary: {
      total: operationTypes.length,
      valid: 0,
      invalid: 0,
    },
  };

  for (const operationType of operationTypes) {
    const result = validateOperationType(operationType, logger, {
      ...options,
      throwOnError: false,
    });

    results.operations[operationType] = result;

    if (result.isValid) {
      results.summary.valid++;
    } else {
      results.summary.invalid++;
      results.allValid = false;
    }
  }

  return results;
}

/**
 * Helper: Convert operation type to schema file name
 */
function toSchemaFileName(operationType) {
  return operationType.toLowerCase().split('_').map((word, idx) =>
    idx === 0 ? word : word.charAt(0) + word.slice(1)
  ).join('') + '.schema.json';
}

/**
 * Helper: Convert operation type to token name
 *
 * ✅ CORRECTED: Operation handlers DO NOT use "I" prefix
 * See tokens-core.js lines 14-20 for naming convention
 * Example: ADD_COMPONENT -> AddComponentHandler (not IAddComponentHandler)
 */
function toTokenName(operationType) {
  // NO "I" prefix for operation handlers
  return operationType.split('_').map(word =>
    word.charAt(0) + word.slice(1).toLowerCase()
  ).join('') + 'Handler';
}

/**
 * Export for testing and external use
 */
export {
  KNOWN_OPERATION_TYPES,
  toSchemaFileName,
  toTokenName,
};
```

### 2. Update OperationValidationError (IF NEEDED)

**File**: `src/errors/operationValidationError.js`

**Current Status**:
- File already exists with inline schema file naming logic (lines 69-71, 81-83)
- Currently handles 'whitelist', 'schema', and 'reference' missing registration types
- Token naming logic not currently included

**Note**: The current implementation already includes helper logic inline. Adding separate helper functions would duplicate code. Consider refactoring existing inline logic into helpers only if comprehensive validation is implemented.

**Proposed Enhancement** (if comprehensive validation is implemented):

```javascript
/**
 * Formats validation error with specific guidance for each missing registration
 */
function formatValidationError(operationType, missingRegistrations) {
  const lines = [
    `❌ Operation validation failed for: "${operationType}"`,
    '',
    '📋 Missing registrations detected:',
  ];

  if (missingRegistrations.includes('whitelist')) {
    lines.push('');
    lines.push('  ⚠️  NOT IN PRE-VALIDATION WHITELIST');
    lines.push('  File: src/utils/preValidationUtils.js');
    lines.push('  Location: KNOWN_OPERATION_TYPES array');
    lines.push('  Action: Add to array (keep alphabetically sorted)');
    lines.push(`  Code to add: '${operationType}',`);
  }

  if (missingRegistrations.includes('schema')) {
    const schemaFileName = toSchemaFileName(operationType);
    lines.push('');
    lines.push('  ⚠️  SCHEMA FILE NOT FOUND');
    lines.push(`  Expected: data/schemas/operations/${schemaFileName}`);
    lines.push('  Action: Create schema file following the pattern:');
    lines.push('  - Extend base-operation.schema.json');
    lines.push(`  - Define type constant: "${operationType}"`);
    lines.push('  - Define operation parameters');
    lines.push('');
    lines.push('  💡 Quick create: npm run create-operation ' + operationType.toLowerCase().replace(/_/g, '_'));
  }

  if (missingRegistrations.includes('reference')) {
    const schemaFileName = toSchemaFileName(operationType);
    lines.push('');
    lines.push('  ⚠️  SCHEMA NOT REFERENCED IN operation.schema.json');
    // ✅ CORRECTED: Actual path (no "operations" subdirectory)
    lines.push('  File: data/schemas/operation.schema.json');
    // ✅ CORRECTED: Uses "anyOf" not "oneOf", within $defs.Operation
    lines.push('  Location: $defs.Operation.anyOf array');
    lines.push('  Action: Add $ref entry (keep alphabetically sorted)');
    lines.push(`  Code to add: { "$ref": "./operations/${schemaFileName}" },`);
  }

  if (missingRegistrations.includes('token')) {
    const tokenName = toTokenName(operationType);
    lines.push('');
    lines.push('  ⚠️  TOKEN NOT DEFINED');
    lines.push('  File: src/dependencyInjection/tokens/tokens-core.js');
    lines.push('  Location: tokens object');
    lines.push('  Action: Add token definition (keep alphabetically sorted)');
    lines.push(`  Code to add: ${tokenName}: '${tokenName}',`);
  }

  if (missingRegistrations.includes('handler')) {
    const tokenName = toTokenName(operationType);
    // ✅ CORRECTED: No "I" prefix to remove since operation handlers don't use it
    const handlerClassName = tokenName; // Same as token name
    lines.push('');
    lines.push('  ⚠️  HANDLER NOT REGISTERED');
    lines.push('  File: src/dependencyInjection/registrations/operationHandlerRegistrations.js');
    lines.push('  Action: Register handler with container');
    lines.push(`  Code to add: container.register(tokens.${tokenName}, ${handlerClassName});`);
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

// Helper functions (same as in preValidationUtils)
function toSchemaFileName(operationType) {
  return operationType.toLowerCase().split('_').map((word, idx) =>
    idx === 0 ? word : word.charAt(0) + word.slice(1)
  ).join('') + '.schema.json';
}

// ✅ CORRECTED: NO "I" prefix for operation handlers
function toTokenName(operationType) {
  return operationType.split('_').map(word =>
    word.charAt(0) + word.slice(1).toLowerCase()
  ).join('') + 'Handler';
}
```

### 3. Integration with Mod Loading

**Current Status**: ✅ Already Integrated

The pre-validation system is already integrated into the validation flow via `schemaValidationUtils.js` at line 87:

```javascript
// src/utils/schemaValidationUtils.js line 85-120
// Perform pre-validation checks to catch common issues before running full AJV validation
if (!skipPreValidation) {
  const preValidationResult = performPreValidation(data, schemaId, filePath);

  if (!preValidationResult.isValid) {
    // Pre-validation failed - provide specific, actionable error
    const fileName = filePath ? filePath.split('/').pop() : 'unknown file';
    const preValidationError = formatPreValidationError(
      preValidationResult,
      fileName,
      schemaId
    );
    // ... error handling
  }
}
```

This is called during mod loading whenever schema validation occurs, providing early error detection before AJV validation runs.

**Proposed Enhancement** (if comprehensive validation is implemented):

```javascript
// In mod loading code
import { validateOperationType } from '../utils/preValidationUtils.js';

function validateRuleOperations(rule, logger) {
  for (const operation of rule.operations) {
    // Run comprehensive validation
    const result = validateOperationType(operation.type, logger, {
      throwOnError: false, // Don't throw immediately
      checkHandlerRegistration: false, // Skip DI check during loading
    });

    if (!result.isValid) {
      // Log detailed validation results
      logger.error('Operation validation failed in rule', {
        ruleId: rule.id,
        operationType: operation.type,
        checks: result.checks,
        missingRegistrations: result.missingRegistrations,
      });

      // Throw with detailed error
      throw new OperationValidationError(
        operation.type,
        result.missingRegistrations
      );
    }
  }
}
```

## Acceptance Criteria

- [ ] `validateOperationType` performs 6 comprehensive checks
- [ ] Returns detailed `ValidationResult` object
- [ ] Supports batch validation with `validateOperationTypes`
- [ ] Options allow controlling behavior (throw/no-throw, what to check)
- [ ] Error messages include all missing registrations
- [ ] Integration with mod loading provides early detailed errors
- [ ] Tests cover all check scenarios
- [ ] Performance impact is minimal (<100ms per validation)

## Testing

### Unit Tests

**File**: `tests/unit/utils/preValidationUtils.comprehensive.test.js`

```javascript
describe('validateOperationType - Comprehensive Checks', () => {
  it('should pass all checks for fully registered operation', () => {
    const result = validateOperationType('ADD_COMPONENT', mockLogger, {
      throwOnError: false,
    });

    expect(result.isValid).toBe(true);
    expect(result.checks.inWhitelist).toBe(true);
    expect(result.checks.schemaExists).toBe(true);
    expect(result.checks.schemaReferenced).toBe(true);
    expect(result.checks.tokenDefined).toBe(true);
    expect(result.missingRegistrations).toHaveLength(0);
  });

  it('should detect missing whitelist entry', () => {
    const result = validateOperationType('NEW_OPERATION', mockLogger, {
      throwOnError: false,
    });

    expect(result.isValid).toBe(false);
    expect(result.checks.inWhitelist).toBe(false);
    expect(result.missingRegistrations).toContain('whitelist');
  });

  it('should detect missing schema file', () => {
    // Mock file system to return false for schema
    const result = validateOperationType('MISSING_SCHEMA', mockLogger, {
      throwOnError: false,
    });

    expect(result.checks.schemaExists).toBe(false);
    expect(result.missingRegistrations).toContain('schema');
  });

  it('should validate multiple operations in batch', () => {
    const results = validateOperationTypes(
      ['ADD_COMPONENT', 'NEW_OPERATION'],
      mockLogger
    );

    expect(results.summary.total).toBe(2);
    expect(results.summary.valid).toBe(1);
    expect(results.summary.invalid).toBe(1);
    expect(results.allValid).toBe(false);
  });
});
```

## Implementation Notes

- Cache file reads to improve performance
- Handle file system errors gracefully
- Keep validation fast (<100ms)
- Make checks modular for extensibility
- Document each check clearly

## Time Estimate

6-8 hours (including testing)

## Related Tickets

- OPEHANIMP-004: Improve error messages in preValidationUtils (extends this work)
- OPEHANIMP-008: Build-time validation (similar checks)

## Success Metrics

- Comprehensive validation catches all registration issues
- Error messages guide to specific fixes
- Performance impact <100ms per validation
- Integration with mod loading improves error messages

---

## ✅ Corrections Applied to This Workflow (2025-11-08)

This workflow has been updated to correct the following discrepancies with the actual production code:

### Critical Issues Fixed:

1. **❌ BLOCKER - File System Access**
   - **Original Assumption**: Can use Node.js `fs` module
   - **Reality**: Code runs in both browser and Node.js contexts, cannot use file system
   - **Action**: Added blocker section, marked workflow as ON HOLD
   - **Reference**: `preValidationUtils.js` lines 93-95

2. **Token Naming Convention**
   - **Original**: Used "I" prefix like `IAddComponentHandler`
   - **Corrected**: NO "I" prefix - should be `AddComponentHandler`
   - **Reference**: `tokens-core.js` lines 14-20

### Path and Structure Fixes:

3. **Schema File Path**
   - **Original**: `data/schemas/operations/operation.schema.json`
   - **Corrected**: `data/schemas/operation.schema.json` (no "operations" subdirectory)
   - **Reference**: Actual file location

4. **Schema Structure**
   - **Original**: Checked `oneOf` array
   - **Corrected**: Uses `anyOf` within `$defs.Operation.anyOf`
   - **Reference**: `operation.schema.json` line 37

### Implementation Status Updates:

5. **Integration Already Exists**
   - **Status**: Pre-validation already integrated via `schemaValidationUtils.js` line 87
   - **Action**: Added "Current Status" section noting existing integration
   - **Reference**: `schemaValidationUtils.js` lines 85-120

6. **OperationValidationError Status**
   - **Status**: File exists with inline schema naming logic (lines 69-71, 81-83)
   - **Action**: Added note about avoiding code duplication
   - **Reference**: `operationValidationError.js`

7. **Missing Operation Type**
   - **Note**: Current production includes `SEQUENCE` operation (line 83 in `KNOWN_OPERATION_TYPES`)
   - **Action**: Added note in code comments
   - **Reference**: `preValidationUtils.js` line 83

### Code Example Corrections:

All code examples in this workflow have been updated with:
- ✅ markers indicating corrected code
- Inline comments explaining the corrections
- References to actual file locations and line numbers

### Recommendation:

This workflow should remain **ON HOLD** until an architectural decision is made about browser/Node.js context separation. Consider implementing Option B (keep pre-validation browser-safe, use build-time validation for comprehensive checks via OPEHANIMP-008).
