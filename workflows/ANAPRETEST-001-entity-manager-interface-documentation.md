# ANAPRETEST-001: Create Entity Manager Interface Documentation

**Phase:** 1 (Core Infrastructure)
**Priority:** P1 (High)
**Effort:** Medium (2-3 days)
**Impact:** High - Prevents API drift and runtime errors
**Status:** Not Started

## Context

The incompatibility between `SimpleEntityManager` (tests) and `EntityManager` (production) caused runtime errors in anatomy prerequisite tests. The `hasOtherActorsAtLocationOperator` called `getAllEntities()` which doesn't exist in either implementation, requiring a fix to use `getEntities()` instead.

**Root Cause:** No documented minimal interface contract that operators and other consumers can rely on.

**Impact:** API drift between test and production entity managers leads to runtime errors that are difficult to debug and don't surface until integration testing.

**Reference:** Report lines 113-134

## Solution Overview

Create comprehensive IEntityManager interface documentation covering:

1. **Minimal Interface Contract**
   - Document the core methods all entity manager implementations must provide
   - Define method signatures with JSDoc `@interface` annotations
   - Specify expected return types and error conditions

2. **Interface Compliance Validation**
   - Add runtime checks during test setup to verify mock compliance
   - Create utility function to validate entity manager implementations
   - Integrate validation into `createSystemLogicTestEnv`

3. **Interface Documentation**
   - Create `docs/testing/entity-manager-interface.md`
   - Document usage patterns for operators and services
   - Provide migration guide for updating code to use correct methods

## File Structure

```
docs/testing/
├── entity-manager-interface.md          # Interface documentation
└── anatomy-testing-guide.md             # Reference interface docs

src/entities/
└── interfaces/
    └── IEntityManager.js                # JSDoc interface definition

tests/common/engine/
├── systemLogicTestEnv.js                # Add interface validation
└── entityManagerInterfaceValidator.js   # NEW: Validation utility

tests/unit/entities/
└── entityManagerInterface.test.js       # NEW: Interface compliance tests
```

## Detailed Implementation Steps

### Step 1: Define JSDoc Interface

**File:** `src/entities/interfaces/IEntityManager.js`

```javascript
/**
 * @file IEntityManager interface definition
 * @description Minimal entity manager interface for operators and services
 */

/**
 * Minimal entity manager interface that all implementations must satisfy.
 *
 * @interface IEntityManager
 * @description This interface defines the contract that operators, scope resolvers,
 * and other services rely on when interacting with entity managers.
 */
export const IEntityManager = {
  /**
   * Get all entities as an array.
   *
   * @function
   * @name IEntityManager#getEntities
   * @returns {Array<Object>} Array of entity objects with at minimum { id: string }
   * @example
   * const entities = entityManager.getEntities();
   * // Returns: [{ id: 'actor-1', ... }, { id: 'item-2', ... }]
   */
  getEntities: () => [],

  /**
   * Get component data for a specific entity and component type.
   *
   * @function
   * @name IEntityManager#getComponentData
   * @param {string} entityId - The entity ID
   * @param {string} componentType - Namespaced component type (e.g., 'positioning:closeness')
   * @returns {Object|null} Component data object, or null if not found
   * @example
   * const data = entityManager.getComponentData('actor-1', 'positioning:closeness');
   * // Returns: { partners: ['actor-2'] } or null
   */
  getComponentData: (entityId, componentType) => null,

  /**
   * Check if entity has a specific component.
   *
   * @function
   * @name IEntityManager#hasComponent
   * @param {string} entityId - The entity ID
   * @param {string} componentType - Namespaced component type
   * @returns {boolean} True if entity has component, false otherwise
   * @example
   * const hasSitting = entityManager.hasComponent('actor-1', 'positioning:sitting');
   */
  hasComponent: (entityId, componentType) => false,

  /**
   * Get full entity instance with all components.
   *
   * @function
   * @name IEntityManager#getEntityInstance
   * @param {string} entityId - The entity ID
   * @returns {Object|null} Entity object with components, or null if not found
   * @example
   * const entity = entityManager.getEntityInstance('actor-1');
   * // Returns: { id: 'actor-1', components: { ... } } or null
   */
  getEntityInstance: (entityId) => null
};

/**
 * Validate that an object conforms to IEntityManager interface.
 *
 * @param {Object} manager - Object to validate
 * @param {string} context - Context string for error messages
 * @throws {Error} If manager doesn't implement required methods
 */
export function validateEntityManagerInterface(manager, context = 'EntityManager') {
  const requiredMethods = ['getEntities', 'getComponentData', 'hasComponent', 'getEntityInstance'];

  for (const method of requiredMethods) {
    if (typeof manager[method] !== 'function') {
      throw new Error(
        `${context} does not implement IEntityManager.${method}. ` +
        `Required methods: ${requiredMethods.join(', ')}`
      );
    }
  }
}
```

### Step 2: Add Interface Validation to Test Environment

**File:** `tests/common/engine/systemLogicTestEnv.js` (modify)

Add validation during test environment setup:

```javascript
import { validateEntityManagerInterface } from '../../../src/entities/interfaces/IEntityManager.js';

// In createSystemLogicTestEnv function, after creating SimpleEntityManager:
export function createSystemLogicTestEnv() {
  // ... existing setup ...

  const entityManager = new SimpleEntityManager({ logger });

  // Validate interface compliance
  validateEntityManagerInterface(entityManager, 'SimpleEntityManager');

  // ... rest of setup ...
}
```

### Step 3: Create Interface Validator Utility

**File:** `tests/common/engine/entityManagerInterfaceValidator.js`

```javascript
/**
 * @file Entity Manager Interface Validator
 * @description Runtime validation for IEntityManager compliance
 */

import { validateEntityManagerInterface } from '../../../src/entities/interfaces/IEntityManager.js';

/**
 * Test helper to validate entity manager interface compliance.
 *
 * @param {Object} manager - Entity manager instance to validate
 * @param {Object} logger - Logger for diagnostic output
 * @returns {Object} Validation result with details
 */
export function validateInterfaceCompliance(manager, logger) {
  const results = {
    valid: true,
    errors: [],
    warnings: [],
    methods: {}
  };

  const requiredMethods = [
    { name: 'getEntities', expectedReturn: 'array' },
    { name: 'getComponentData', expectedReturn: 'object|null', params: 2 },
    { name: 'hasComponent', expectedReturn: 'boolean', params: 2 },
    { name: 'getEntityInstance', expectedReturn: 'object|null', params: 1 }
  ];

  for (const methodSpec of requiredMethods) {
    const method = manager[methodSpec.name];

    if (typeof method !== 'function') {
      results.valid = false;
      results.errors.push(`Missing required method: ${methodSpec.name}`);
      results.methods[methodSpec.name] = { exists: false };
      continue;
    }

    // Validate method signature
    if (methodSpec.params && method.length !== methodSpec.params) {
      results.warnings.push(
        `Method ${methodSpec.name} expects ${methodSpec.params} parameters, ` +
        `found ${method.length}`
      );
    }

    results.methods[methodSpec.name] = {
      exists: true,
      paramCount: method.length,
      expectedReturn: methodSpec.expectedReturn
    };
  }

  if (!results.valid) {
    logger.error('Entity manager interface validation failed', results);
  } else if (results.warnings.length > 0) {
    logger.warn('Entity manager interface validation warnings', results.warnings);
  }

  return results;
}
```

### Step 4: Create Interface Compliance Tests

**File:** `tests/unit/entities/entityManagerInterface.test.js`

```javascript
import { describe, it, expect } from '@jest/globals';
import { validateEntityManagerInterface } from '../../../src/entities/interfaces/IEntityManager.js';
import SimpleEntityManager from '../../common/engine/SimpleEntityManager.js';
import EntityManager from '../../../src/entities/entityManager.js';

describe('IEntityManager Interface Compliance', () => {
  describe('SimpleEntityManager', () => {
    it('should implement all required interface methods', () => {
      const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
      const manager = new SimpleEntityManager({ logger });

      expect(() => validateEntityManagerInterface(manager, 'SimpleEntityManager'))
        .not.toThrow();
    });

    it('should have correct method signatures', () => {
      const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
      const manager = new SimpleEntityManager({ logger });

      expect(typeof manager.getEntities).toBe('function');
      expect(manager.getEntities.length).toBe(0); // No parameters

      expect(typeof manager.getComponentData).toBe('function');
      expect(manager.getComponentData.length).toBe(2); // entityId, componentType

      expect(typeof manager.hasComponent).toBe('function');
      expect(manager.hasComponent.length).toBe(2); // entityId, componentType

      expect(typeof manager.getEntityInstance).toBe('function');
      expect(manager.getEntityInstance.length).toBe(1); // entityId
    });
  });

  describe('EntityManager (Production)', () => {
    it('should implement all required interface methods', () => {
      const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
      const eventBus = { dispatch: jest.fn() };
      const manager = new EntityManager({ logger, eventBus });

      expect(() => validateEntityManagerInterface(manager, 'EntityManager'))
        .not.toThrow();
    });
  });

  describe('Interface Validation Error Handling', () => {
    it('should throw clear error for missing methods', () => {
      const incomplete = {
        getEntities: () => [],
        getComponentData: () => null
        // Missing: hasComponent, getEntityInstance
      };

      expect(() => validateEntityManagerInterface(incomplete, 'IncompleteManager'))
        .toThrow('IncompleteManager does not implement IEntityManager.hasComponent');
    });

    it('should list all required methods in error message', () => {
      const incomplete = {};

      expect(() => validateEntityManagerInterface(incomplete, 'EmptyManager'))
        .toThrow('Required methods: getEntities, getComponentData, hasComponent, getEntityInstance');
    });
  });
});
```

### Step 5: Create Documentation

**File:** `docs/testing/entity-manager-interface.md`

```markdown
# Entity Manager Interface Documentation

## Overview

The `IEntityManager` interface defines the minimal contract that all entity manager implementations (production and test) must satisfy. This ensures compatibility between operators, scope resolvers, and other services across different execution contexts.

## Interface Definition

All entity manager implementations must provide these methods:

### `getEntities(): Array<Object>`

Returns all entities as an array.

**Returns:** Array of entity objects with at minimum `{ id: string }`

**Example:**
```javascript
const entities = entityManager.getEntities();
// [{ id: 'actor-1', ... }, { id: 'item-2', ... }]
```

**Usage in Operators:**
```javascript
// ✅ CORRECT
const allEntities = this.#entityManager.getEntities();

// ❌ INCORRECT - Method doesn't exist
const allEntities = this.#entityManager.getAllEntities();
```

### `getComponentData(entityId, componentType): Object|null`

Get component data for a specific entity and component type.

**Parameters:**
- `entityId` (string): The entity ID
- `componentType` (string): Namespaced component type (e.g., 'positioning:closeness')

**Returns:** Component data object, or null if not found

**Example:**
```javascript
const closeness = entityManager.getComponentData('actor-1', 'positioning:closeness');
// { partners: ['actor-2'] } or null
```

### `hasComponent(entityId, componentType): boolean`

Check if entity has a specific component.

**Parameters:**
- `entityId` (string): The entity ID
- `componentType` (string): Namespaced component type

**Returns:** True if entity has component, false otherwise

**Example:**
```javascript
const isSitting = entityManager.hasComponent('actor-1', 'positioning:sitting');
```

### `getEntityInstance(entityId): Object|null`

Get full entity instance with all components.

**Parameters:**
- `entityId` (string): The entity ID

**Returns:** Entity object with components, or null if not found

**Example:**
```javascript
const entity = entityManager.getEntityInstance('actor-1');
// { id: 'actor-1', components: { 'positioning:closeness': { ... } } } or null
```

## Implementation Compliance

### Validation

Use the interface validator to ensure compliance:

```javascript
import { validateEntityManagerInterface } from '../../../src/entities/interfaces/IEntityManager.js';

// Validate during setup
validateEntityManagerInterface(entityManager, 'MyEntityManager');
```

### Test Environment

The test environment automatically validates `SimpleEntityManager` compliance during setup:

```javascript
// Automatic validation in createSystemLogicTestEnv()
const entityManager = new SimpleEntityManager({ logger });
validateEntityManagerInterface(entityManager, 'SimpleEntityManager');
```

## Common Migration Patterns

### Updating Operators

**Before (Incorrect):**
```javascript
class MyOperator {
  execute(context) {
    const entities = this.#entityManager.getAllEntities(); // ❌ Method doesn't exist
    // ...
  }
}
```

**After (Correct):**
```javascript
class MyOperator {
  execute(context) {
    const entities = this.#entityManager.getEntities(); // ✅ Correct method
    // ...
  }
}
```

### Updating Scope Resolvers

Scope resolvers should use the interface methods consistently:

```javascript
// ✅ Good - Uses interface methods
const resolver = (runtimeCtx) => {
  const entities = runtimeCtx.entityManager.getEntities();
  return entities.filter(e =>
    runtimeCtx.entityManager.hasComponent(e.id, 'positioning:sitting')
  );
};
```

## References

- **Interface Definition:** `src/entities/interfaces/IEntityManager.js`
- **Validation Utility:** `tests/common/engine/entityManagerInterfaceValidator.js`
- **Compliance Tests:** `tests/unit/entities/entityManagerInterface.test.js`
- **Report:** `reports/anatomy-prerequisite-test-fixes-2025-01.md` (lines 113-134)
```

## Acceptance Criteria

- [ ] `IEntityManager` interface defined with JSDoc annotations in `src/entities/interfaces/IEntityManager.js`
- [ ] Interface validation integrated into `createSystemLogicTestEnv()`
- [ ] Interface validator utility created with diagnostic output
- [ ] Unit tests verify `SimpleEntityManager` and `EntityManager` compliance
- [ ] Documentation created at `docs/testing/entity-manager-interface.md`
- [ ] Documentation includes:
  - All 4 required interface methods with signatures
  - Usage examples for operators and scope resolvers
  - Common migration patterns (getAllEntities → getEntities)
  - References to validation utilities
- [ ] All tests pass (unit and integration)
- [ ] No breaking changes to existing code

## Implementation Notes

**Key Design Decisions:**

1. **JSDoc over TypeScript**: Use JSDoc `@interface` for runtime validation without TypeScript compilation overhead
2. **Validation Timing**: Validate during test setup (fail-fast) rather than at method call time (performance)
3. **Error Messages**: Include full list of required methods in error messages for quick remediation

**Testing Strategy:**

1. Unit tests verify both implementations comply with interface
2. Integration tests ensure operators work with both implementations
3. Interface validator provides diagnostic output for debugging

**Migration Path:**

1. Phase 1: Add interface definition and validation (this ticket)
2. Phase 2: Update all operators to use correct methods (separate tickets)
3. Phase 3: Enable strict mode to catch new violations

## Dependencies

**Blocks:**
- ANAPRETEST-005 (Standardize Entity Manager Mock Creation) - Needs interface definition first

**Related:**
- Anatomy prerequisite test fixes (completed)
- `hasOtherActorsAtLocationOperator` fix (completed)

## References

- **Report Section:** Suggestion #1 - Create Entity Manager Interface Documentation
- **Report Lines:** 113-134
- **Fixed Issue:** `hasOtherActorsAtLocationOperator.js:166` - `getAllEntities()` → `getEntities()`
- **Related Docs:**
  - `docs/testing/anatomy-testing-guide.md` - Will reference this interface
  - `docs/testing/mod-testing-guide.md` - Testing patterns
