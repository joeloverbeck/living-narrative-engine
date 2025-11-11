# ENTLIFWOR-003: Implement Batch Schema Registration

**Priority**: HIGH
**Estimated Impact**: 10-15% performance improvement (0.8-1 second saved)
**Estimated Effort**: 1 hour
**Risk Level**: Very Low
**Depends On**: None (can be implemented independently)

## Problem Statement

The EntityWorkflowTestBed currently registers 8 component schemas individually using sequential `addSchema()` calls in the `registerTestComponentSchemas()` method. Each call involves:
- Schema validation
- Schema compilation
- Registry updates
- Potential async overhead

**Current Pattern** (`entityWorkflowTestBed.js:90-261`):
```javascript
async registerTestComponentSchemas() {
  // Register core:position schema
  await this.validator.addSchema({ /* schema */ }, 'core:position');

  // Register core:name schema
  await this.validator.addSchema({ /* schema */ }, 'core:name');

  // Register core:description schema
  await this.validator.addSchema({ /* schema */ }, 'core:description');

  // ... 5 more individual calls
}
```

**Impact**: 8 schemas × ~10ms overhead × 12 tests = ~960ms wasted

## Solution

Implement batch schema registration that processes all schemas in a single operation, reducing overhead and improving efficiency.

**Target Pattern**:
```javascript
async registerTestComponentSchemas() {
  const schemas = {
    'core:position': { /* schema */ },
    'core:name': { /* schema */ },
    'core:description': { /* schema */ },
    // ... all schemas
  };

  await this.validator.addSchemas(schemas); // Single batch call
}
```

## Implementation Steps

### Step 1: Check if Validator Supports Batch Registration

**File**: Search for existing batch registration support

First, verify if the schema validator already has batch registration:

```bash
grep -r "addSchemas" src/validation/
```

If it doesn't exist, we'll need to check the validator implementation:

```bash
grep -r "class.*SchemaValidator\|export.*SchemaValidator" src/validation/
```

### Step 2A: If Batch Method Exists - Use It Directly

**File**: `tests/e2e/entities/common/entityWorkflowTestBed.js:90-261`

Simply refactor `registerTestComponentSchemas()`:

```javascript
/**
 * Register required component schemas for testing.
 * Uses batch registration for better performance.
 */
async registerTestComponentSchemas() {
  const schemas = {
    'core:position': {
      type: 'object',
      properties: {
        locationId: { type: 'string' },
      },
      required: ['locationId'],
      additionalProperties: false,
    },

    'core:name': {
      type: 'object',
      properties: {
        text: { type: 'string' },
      },
      required: ['text'],
      additionalProperties: false,
    },

    'core:description': {
      type: 'object',
      properties: {
        text: { type: 'string' },
      },
      required: ['text'],
      additionalProperties: false,
    },

    'core:stats': {
      type: 'object',
      properties: {
        health: { type: 'number', minimum: 0, default: 100 },
        maxHealth: { type: 'number', minimum: 1, default: 100 },
        mana: { type: 'number', minimum: 0, default: 0 },
        maxMana: { type: 'number', minimum: 0, default: 0 },
        level: { type: 'number', minimum: 1, default: 1 },
        strength: { type: 'number', minimum: 1, default: 10 },
        agility: { type: 'number', minimum: 1, default: 10 },
        intelligence: { type: 'number', minimum: 1, default: 10 },
        wisdom: { type: 'number', minimum: 1, default: 10 },
        dexterity: { type: 'number', minimum: 1, default: 10 },
        stealth: { type: 'number', minimum: 1, default: 10 },
      },
      required: ['health', 'maxHealth'],
      additionalProperties: false,
    },

    'core:inventory': {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'string' }, default: [] },
        maxSize: { type: 'number', minimum: 0, default: 20 },
        capacity: { type: 'number', minimum: 0, default: 20 },
      },
      required: ['items'],
      additionalProperties: false,
    },

    'core:actor': {
      type: 'object',
      properties: {
        name: { type: 'string', default: '' },
        conscious: { type: 'boolean', default: true },
        trader: { type: 'boolean', default: false },
        isPlayer: { type: 'boolean', default: false },
      },
      additionalProperties: false,
    },

    'core:item': {
      type: 'object',
      properties: {
        name: { type: 'string', default: '' },
        value: { type: 'number', minimum: 0, default: 0 },
        type: { type: 'string', default: '' },
        weight: { type: 'number', minimum: 0, default: 0 },
        throwable: { type: 'boolean', default: false },
        enchantable: { type: 'boolean', default: false },
        catalyst: { type: 'boolean', default: false },
        explosive: { type: 'boolean', default: false },
        equippable: { type: 'boolean', default: false },
        slot: { type: 'string', default: '' },
      },
      additionalProperties: false,
    },
  };

  // Batch registration (if supported)
  await this.validator.addSchemas(schemas);

  this.logger.debug(`Registered ${Object.keys(schemas).length} test component schemas in batch`);
}
```

### Step 2B: If Batch Method Doesn't Exist - Create Wrapper

**File**: `tests/e2e/entities/common/entityWorkflowTestBed.js:90-261`

Create a local batch registration helper:

```javascript
/**
 * Register required component schemas for testing.
 * Uses local batch registration for better performance.
 */
async registerTestComponentSchemas() {
  const schemas = {
    // ... all schema definitions (same as Step 2A)
  };

  // Local batch registration helper
  await this._batchRegisterSchemas(schemas);

  this.logger.debug(`Registered ${Object.keys(schemas).length} test component schemas`);
}

/**
 * Helper to register multiple schemas efficiently.
 *
 * @param {Object} schemas - Map of schema IDs to schema definitions
 * @returns {Promise<void>}
 * @private
 */
async _batchRegisterSchemas(schemas) {
  // Check if validator supports native batch registration
  if (typeof this.validator.addSchemas === 'function') {
    await this.validator.addSchemas(schemas);
    return;
  }

  // Fallback: Register sequentially but with better error handling
  const schemaIds = Object.keys(schemas);

  // Use Promise.all for parallel registration if validator supports it
  // (most validators can handle parallel calls safely)
  try {
    await Promise.all(
      schemaIds.map(schemaId =>
        this.validator.addSchema(schemas[schemaId], schemaId)
      )
    );
  } catch (error) {
    this.logger.error('Failed to register schemas in batch:', error);

    // Fallback to sequential registration with detailed error reporting
    for (const schemaId of schemaIds) {
      try {
        await this.validator.addSchema(schemas[schemaId], schemaId);
      } catch (schemaError) {
        this.logger.error(`Failed to register schema ${schemaId}:`, schemaError);
        throw schemaError;
      }
    }
  }
}
```

### Step 3: Extract Schema Definitions for Reusability

**File**: `tests/e2e/entities/common/testSchemas.js` (NEW)

Create a shared schema definitions file:

```javascript
/**
 * @file testSchemas.js
 * @description Shared schema definitions for E2E tests
 *
 * These schemas are commonly used across entity workflow tests.
 * Centralized definition improves maintainability and consistency.
 */

/**
 * Standard test component schemas used across E2E tests
 * @type {Object<string, object>}
 */
export const TEST_COMPONENT_SCHEMAS = {
  'core:position': {
    type: 'object',
    properties: {
      locationId: { type: 'string' },
    },
    required: ['locationId'],
    additionalProperties: false,
  },

  'core:name': {
    type: 'object',
    properties: {
      text: { type: 'string' },
    },
    required: ['text'],
    additionalProperties: false,
  },

  'core:description': {
    type: 'object',
    properties: {
      text: { type: 'string' },
    },
    required: ['text'],
    additionalProperties: false,
  },

  'core:stats': {
    type: 'object',
    properties: {
      health: { type: 'number', minimum: 0, default: 100 },
      maxHealth: { type: 'number', minimum: 1, default: 100 },
      mana: { type: 'number', minimum: 0, default: 0 },
      maxMana: { type: 'number', minimum: 0, default: 0 },
      level: { type: 'number', minimum: 1, default: 1 },
      strength: { type: 'number', minimum: 1, default: 10 },
      agility: { type: 'number', minimum: 1, default: 10 },
      intelligence: { type: 'number', minimum: 1, default: 10 },
      wisdom: { type: 'number', minimum: 1, default: 10 },
      dexterity: { type: 'number', minimum: 1, default: 10 },
      stealth: { type: 'number', minimum: 1, default: 10 },
    },
    required: ['health', 'maxHealth'],
    additionalProperties: false,
  },

  'core:inventory': {
    type: 'object',
    properties: {
      items: { type: 'array', items: { type: 'string' }, default: [] },
      maxSize: { type: 'number', minimum: 0, default: 20 },
      capacity: { type: 'number', minimum: 0, default: 20 },
    },
    required: ['items'],
    additionalProperties: false,
  },

  'core:actor': {
    type: 'object',
    properties: {
      name: { type: 'string', default: '' },
      conscious: { type: 'boolean', default: true },
      trader: { type: 'boolean', default: false },
      isPlayer: { type: 'boolean', default: false },
    },
    additionalProperties: false,
  },

  'core:item': {
    type: 'object',
    properties: {
      name: { type: 'string', default: '' },
      value: { type: 'number', minimum: 0, default: 0 },
      type: { type: 'string', default: '' },
      weight: { type: 'number', minimum: 0, default: 0 },
      throwable: { type: 'boolean', default: false },
      enchantable: { type: 'boolean', default: false },
      catalyst: { type: 'boolean', default: false },
      explosive: { type: 'boolean', default: false },
      equippable: { type: 'boolean', default: false },
      slot: { type: 'string', default: '' },
    },
    additionalProperties: false,
  },
};

/**
 * Get a subset of test schemas by ID
 *
 * @param {string[]} schemaIds - Schema IDs to retrieve
 * @returns {Object<string, object>} Subset of schemas
 */
export function getTestSchemas(schemaIds) {
  const result = {};

  for (const schemaId of schemaIds) {
    if (TEST_COMPONENT_SCHEMAS[schemaId]) {
      result[schemaId] = TEST_COMPONENT_SCHEMAS[schemaId];
    } else {
      throw new Error(`Test schema not found: ${schemaId}`);
    }
  }

  return result;
}
```

Then update the test bed:

```javascript
import { TEST_COMPONENT_SCHEMAS } from './testSchemas.js';

async registerTestComponentSchemas() {
  await this._batchRegisterSchemas(TEST_COMPONENT_SCHEMAS);
  this.logger.debug(`Registered ${Object.keys(TEST_COMPONENT_SCHEMAS).length} test component schemas`);
}
```

## Validation Criteria

### Performance Requirements

- [ ] Schema registration completes in ≤100ms (down from ~800ms)
- [ ] Overall test suite is 0.8-1 second faster
- [ ] No increase in memory usage

### Functional Requirements

- [ ] All 8 schemas register successfully
- [ ] All existing tests pass without modification
- [ ] Schema validation works correctly for all tests
- [ ] Error handling remains robust

### Code Quality Requirements

- [ ] Schema definitions are centralized (DRY principle)
- [ ] Clear error messages if schema registration fails
- [ ] Backward compatible with existing code
- [ ] Follows project coding standards

## Testing Instructions

1. **Run the full test suite**:
   ```bash
   NODE_ENV=test npx jest tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js --no-coverage
   ```

2. **Verify all schemas are registered** by checking test output:
   - Should see: "Registered 8 test component schemas" (or similar)
   - No schema-related errors

3. **Test schema validation** works correctly:
   ```bash
   NODE_ENV=test npx jest tests/e2e/entities/EntityLifecycleWorkflow.e2e.test.js -t "should handle entity creation with basic validation"
   ```

4. **Verify error handling** (optional - manually break a schema):
   - Temporarily remove a required field from a schema
   - Verify clear error message
   - Restore schema

## Performance Measurement

Add temporary timing to measure improvement:

```javascript
async registerTestComponentSchemas() {
  const startTime = performance.now();

  await this._batchRegisterSchemas(TEST_COMPONENT_SCHEMAS);

  const endTime = performance.now();
  this.logger.info(`Schema registration took ${(endTime - startTime).toFixed(2)}ms`);
}
```

Expected results:
- **Before**: ~80-100ms for 8 sequential `addSchema()` calls
- **After**: ~10-20ms for single batch operation
- **Savings**: ~60-80ms per initialization × 12 tests = ~720-960ms

## Rollback Plan

If issues arise:
1. Revert to sequential `addSchema()` calls
2. Keep `TEST_COMPONENT_SCHEMAS` export for reusability
3. Investigate validator compatibility issues
4. Document any validator limitations discovered

## Success Metrics

- **Performance**: 0.8-1 second faster test execution
- **Code Quality**: Schemas centralized and reusable
- **Reliability**: 100% test pass rate

## Dependencies

None. Can be implemented independently.

## Follow-up Work

- Apply pattern to other test beds that register schemas
- Consider creating a `TestSchemaRegistry` utility class
- Document pattern in `docs/testing/e2e-optimization-patterns.md`

## References

- Test bed: `tests/e2e/entities/common/entityWorkflowTestBed.js:90-261`
- Schema validator: `src/validation/ajvSchemaValidator.js`
- Related pattern: Batch operations throughout codebase
