# ANAPRETEST-001: Create Entity Manager Interface Documentation

**Phase:** 1 (Core Infrastructure)
**Priority:** P1 (High)
**Effort:** Medium (2-3 days)
**Impact:** High - Prevents API drift and runtime errors
**Status:** Not Started

## Context

The incompatibility between `SimpleEntityManager` (tests) and `EntityManager` (production) caused runtime errors in anatomy prerequisite tests. The `hasOtherActorsAtLocationOperator` attempted to call a non-existent method, requiring analysis of the actual interface contract.

**Root Cause:** Mismatch between test and production entity manager APIs - production uses `entities` getter returning iterator, while SimpleEntityManager uses `getEntities()` method returning array.

**Impact:** API drift between test and production entity managers leads to runtime errors that are difficult to debug and don't surface until integration testing.

**Key Discovery:** Production EntityManager uses `entities` getter (IterableIterator), not `getEntities()` method. IEntityManager interface already exists at `src/interfaces/IEntityManager.js` with comprehensive method definitions.

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

src/interfaces/
└── IEntityManager.js                    # EXISTING: Interface already defined

tests/common/entities/
└── simpleEntityManager.js               # EXISTING: Test implementation

tests/common/engine/
└── systemLogicTestEnv.js                # MODIFY: Add interface validation

tests/unit/entities/
└── entityManagerInterface.test.js       # NEW: Interface compliance tests

tests/unit/interfaces/
└── IEntityManager.test.js               # NEW: Interface contract tests
```

**Note:** IEntityManager interface already exists with comprehensive method definitions. This ticket focuses on documenting the interface, adding validation, and ensuring test/production compatibility.

## Detailed Implementation Steps

### Step 1: Update Existing IEntityManager Interface Documentation

**File:** `src/interfaces/IEntityManager.js` (EXISTING - already at correct location)

**Status:** Interface already exists with comprehensive method definitions. This step involves:
1. Reviewing existing interface for completeness
2. Adding clarifying JSDoc comments where needed
3. Ensuring consistency between method signatures

**Key Interface Methods** (from existing implementation):

```javascript
/**
 * Core query methods that all implementations must support:
 *
 * - get entities() - Getter returning IterableIterator<Entity> (NOT a method!)
 * - getEntityInstance(instanceId) - Returns Entity|undefined
 * - getEntityIds() - Returns string[] of all entity IDs
 * - getComponentData(instanceId, componentTypeId) - Returns object|undefined
 * - hasComponent(instanceId, componentTypeId) - Returns boolean
 * - hasComponentOverride(instanceId, componentTypeId) - Returns boolean
 * - getEntitiesWithComponent(componentTypeId) - Returns Entity[]
 * - getEntitiesInLocation(locationId) - Returns Set<string>
 * - findEntities(query) - Returns Entity[]
 * - getAllComponentTypesForEntity(entityId) - Returns string[]
 *
 * Component mutation methods:
 * - addComponent(instanceId, componentTypeId, componentData) - Returns boolean
 * - removeComponent(instanceId, componentTypeId) - Returns boolean
 * - batchAddComponentsOptimized(componentSpecs, emitBatchEvent) - Returns Promise<object>
 *
 * Entity lifecycle methods:
 * - createEntityInstance(definitionId, options) - Returns Entity
 * - reconstructEntity(serializedEntity) - Returns Entity
 * - batchCreateEntities(entitySpecs, options) - Returns Promise<object>
 * - hasBatchSupport() - Returns boolean
 * - clearAll() - Returns void
 */
```

**CRITICAL DISCOVERY:** Production uses `entities` **getter** (returns iterator), not `getEntities()` method. SimpleEntityManager has `getEntities()` method for test convenience, creating an API mismatch.

### Step 2: Harmonize SimpleEntityManager with IEntityManager Interface

**File:** `tests/common/entities/simpleEntityManager.js` (MODIFY)

**Issue:** SimpleEntityManager has `getEntities()` method returning array, but production interface uses `entities` getter returning iterator. This creates API drift.

**Solution Options:**

**Option A (Recommended):** Add `entities` getter to SimpleEntityManager for compatibility:
```javascript
// In SimpleEntityManager class
/**
 * Getter that returns an iterator over all active entities.
 * Provides compatibility with production EntityManager interface.
 *
 * @returns {IterableIterator<Entity>} Iterator over all active entities
 */
get entities() {
  return this.entities.values();
}
```

**Option B:** Keep both methods for backward compatibility with existing tests:
- Keep existing `getEntities()` for tests that use it
- Add `entities` getter for interface compliance
- Document deprecation path for `getEntities()`

**Validation:** Add optional validation helper (not required in constructor):
```javascript
import { IEntityManager } from '../../../src/interfaces/IEntityManager.js';

// Optional validation in test setup
export function validateEntityManagerCompliance(manager, context = 'EntityManager') {
  // Check for key interface members
  const requiredMembers = ['entities', 'getEntityInstance', 'getComponentData', 'hasComponent'];

  for (const member of requiredMembers) {
    if (!(member in manager)) {
      throw new Error(`${context} missing required interface member: ${member}`);
    }
  }
}
```

### Step 3: Create Interface Compliance Tests

**File:** `tests/unit/entities/entityManagerInterface.test.js`

```javascript
import { describe, it, expect } from '@jest/globals';
import { IEntityManager } from '../../../src/interfaces/IEntityManager.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import EntityManager from '../../../src/entities/entityManager.js';

describe('IEntityManager Interface Compliance', () => {
  describe('SimpleEntityManager', () => {
    it('should implement core query methods', () => {
      const manager = new SimpleEntityManager([]);

      // Core methods that must exist
      expect(typeof manager.getEntityInstance).toBe('function');
      expect(manager.getEntityInstance.length).toBe(1);

      expect(typeof manager.getComponentData).toBe('function');
      expect(manager.getComponentData.length).toBe(2);

      expect(typeof manager.hasComponent).toBe('function');
      expect(manager.hasComponent.length).toBe(2);

      expect(typeof manager.getEntitiesWithComponent).toBe('function');
      expect(manager.getEntitiesWithComponent.length).toBe(1);
    });

    it('should have getEntities method for backward compatibility', () => {
      const manager = new SimpleEntityManager([]);

      expect(typeof manager.getEntities).toBe('function');
      expect(manager.getEntities()).toEqual([]);
    });

    it('should have entities getter for interface compliance', () => {
      const manager = new SimpleEntityManager([
        { id: 'test-1', components: {} }
      ]);

      // After Step 2 implementation, this should work
      // expect('entities' in manager).toBe(true);
      // expect(Symbol.iterator in Object.getPrototypeOf(manager.entities)).toBe(true);
    });

    it('should return consistent data from both entities getter and getEntities method', () => {
      const testEntities = [
        { id: 'actor-1', components: { 'core:actor': {} } },
        { id: 'item-1', components: { 'items:item': {} } }
      ];
      const manager = new SimpleEntityManager(testEntities);

      const entitiesArray = manager.getEntities();
      expect(entitiesArray).toHaveLength(2);
      expect(entitiesArray.map(e => e.id)).toEqual(['actor-1', 'item-1']);

      // After Step 2 implementation:
      // const entitiesIterator = Array.from(manager.entities);
      // expect(entitiesIterator).toHaveLength(2);
      // expect(entitiesIterator.map(e => e.id)).toEqual(['actor-1', 'item-1']);
    });
  });

  describe('EntityManager (Production)', () => {
    it('should extend IEntityManager', () => {
      const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
      const mockValidator = { validate: jest.fn() };
      const mockRegistry = { getEntityDefinition: jest.fn() };
      const mockDispatcher = { dispatch: jest.fn() };

      const manager = new EntityManager({
        logger: mockLogger,
        validator: mockValidator,
        registry: mockRegistry,
        dispatcher: mockDispatcher
      });

      expect(manager instanceof IEntityManager).toBe(true);
    });

    it('should have entities getter not getEntities method', () => {
      const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
      const mockValidator = { validate: jest.fn() };
      const mockRegistry = { getEntityDefinition: jest.fn() };
      const mockDispatcher = { dispatch: jest.fn() };

      const manager = new EntityManager({
        logger: mockLogger,
        validator: mockValidator,
        registry: mockRegistry,
        dispatcher: mockDispatcher
      });

      // Production uses getter, not method
      expect('entities' in manager).toBe(true);
      expect(typeof manager.getEntities).toBe('undefined');
    });

    it('should implement all interface methods', () => {
      const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
      const mockValidator = { validate: jest.fn() };
      const mockRegistry = { getEntityDefinition: jest.fn() };
      const mockDispatcher = { dispatch: jest.fn() };

      const manager = new EntityManager({
        logger: mockLogger,
        validator: mockValidator,
        registry: mockRegistry,
        dispatcher: mockDispatcher
      });

      // Core interface methods
      expect(typeof manager.getEntityInstance).toBe('function');
      expect(typeof manager.getComponentData).toBe('function');
      expect(typeof manager.hasComponent).toBe('function');
      expect(typeof manager.getEntityIds).toBe('function');
      expect(typeof manager.getEntitiesWithComponent).toBe('function');
    });
  });

  describe('API Compatibility Checks', () => {
    it('should document the entities getter vs getEntities() method difference', () => {
      // This test serves as documentation of the key difference:
      // Production: uses 'entities' getter returning IterableIterator
      // Test: uses 'getEntities()' method returning Array

      const testManager = new SimpleEntityManager([]);
      expect(typeof testManager.getEntities).toBe('function'); // Test convenience

      // Production manager would have:
      // expect('entities' in productionManager).toBe(true);
      // expect(typeof productionManager.getEntities).toBe('undefined');
    });
  });
});
```

### Step 4: Create Documentation

**File:** `docs/testing/entity-manager-interface.md`

```markdown
# Entity Manager Interface Documentation

## Overview

The `IEntityManager` interface (located at `src/interfaces/IEntityManager.js`) defines the contract that all entity manager implementations (production and test) must satisfy. This ensures compatibility between operators, scope resolvers, and other services across different execution contexts.

**Key Location:** `src/interfaces/IEntityManager.js` - Interface already exists with comprehensive method definitions.

## Critical Interface Differences

### Production EntityManager vs Test SimpleEntityManager

**Production (`src/entities/entityManager.js`):**
- Uses `entities` **getter** returning `IterableIterator<Entity>`
- Extends `IEntityManager` class
- Full dependency injection with validators, registries, dispatchers

**Test (`tests/common/entities/simpleEntityManager.js`):**
- Has `getEntities()` **method** returning `Array<Object>`
- Does NOT extend `IEntityManager` (standalone implementation)
- Simplified constructor taking entities array directly

**Impact:** Code written for production may not work in tests and vice versa.

## Core Interface Methods

### `get entities(): IterableIterator<Entity>`

Returns an iterator over all active entities (GETTER, not method).

**Type:** Property getter
**Returns:** `IterableIterator<Entity>` (use with `for...of` or `Array.from()`)

**Example:**
```javascript
// ✅ CORRECT - Production pattern
for (const entity of entityManager.entities) {
  console.log(entity.id);
}

// ✅ CORRECT - Convert to array
const entitiesArray = Array.from(entityManager.entities);

// ❌ INCORRECT - entities is not a method
const entities = entityManager.entities(); // TypeError!

// ❌ INCORRECT - Method doesn't exist in production
const entities = entityManager.getEntities(); // undefined in production
```

**Usage in Operators (Production):**
```javascript
// ✅ CORRECT
const allEntities = Array.from(this.#entityManager.entities);

// ❌ INCORRECT - Not a method
const allEntities = this.#entityManager.entities();

// ❌ INCORRECT - Method doesn't exist in production
const allEntities = this.#entityManager.getEntities();
```

### `getComponentData(instanceId, componentTypeId): object|undefined`

Get component data for a specific entity and component type.

**Parameters:**
- `instanceId` (string): The entity ID (UUID)
- `componentTypeId` (string): Namespaced component type (e.g., 'positioning:closeness')

**Returns:** Component data object, or `undefined` if not found

**Example:**
```javascript
const closeness = entityManager.getComponentData('actor-1', 'positioning:closeness');
// Returns: { partners: ['actor-2'] } or undefined

// Test SimpleEntityManager returns null instead of undefined
const closenessTest = testEntityManager.getComponentData('actor-1', 'positioning:closeness');
// Returns: { partners: ['actor-2'] } or null
```

### `hasComponent(instanceId, componentTypeId, checkOverrideOnly?): boolean`

Check if entity has a specific component.

**Parameters:**
- `instanceId` (string): The entity ID (UUID)
- `componentTypeId` (string): Namespaced component type
- `checkOverrideOnly` (boolean, optional): If true, only check for instance-level overrides

**Returns:** `boolean` - True if entity has component, false otherwise

**Example:**
```javascript
const isSitting = entityManager.hasComponent('actor-1', 'positioning:sitting');
// Returns: true or false
```

### `getEntityInstance(instanceId): Entity|undefined`

Get full entity instance with all components.

**Parameters:**
- `instanceId` (string): The entity ID (UUID)

**Returns:** `Entity` object or `undefined` if not found

**Important:** Return type is `Entity|undefined` in production, not `Object|null`

**Example:**
```javascript
const entity = entityManager.getEntityInstance('actor-1');
if (entity) {
  // Entity found - access via methods
  const components = entity.getAllComponents();
  const hasActor = entity.hasComponent('core:actor');
}
// Returns: Entity instance or undefined
```

### `getEntityIds(): string[]`

Returns an array of all active entity IDs.

**Returns:** `string[]` - Array of entity instance IDs (UUIDs)

**Example:**
```javascript
const ids = entityManager.getEntityIds();
// Returns: ['actor-1', 'actor-2', 'item-1']
```

### `getEntitiesWithComponent(componentTypeId): Entity[]`

Fetches all active entities that possess a specific component type.

**Parameters:**
- `componentTypeId` (string): The component type identifier

**Returns:** `Entity[]` - Array of Entity instances (never null, empty array if none)

**Example:**
```javascript
const actors = entityManager.getEntitiesWithComponent('core:actor');
// Returns: [Entity, Entity, ...] or []
```

## Test vs Production Compatibility

### SimpleEntityManager Test Patterns

```javascript
// Test pattern - SimpleEntityManager
const testManager = new SimpleEntityManager([
  { id: 'actor-1', components: { 'core:actor': {} } }
]);

// ✅ Works in tests - method returns array
const entities = testManager.getEntities();
entities.forEach(e => console.log(e.id));

// ✅ After Step 2 - adds getter for compatibility
for (const entity of testManager.entities) {
  console.log(entity.id);
}
```

### Production EntityManager Patterns

```javascript
// Production pattern - EntityManager
const entityManager = container.resolve('IEntityManager');

// ✅ Correct - use getter with for...of
for (const entity of entityManager.entities) {
  console.log(entity.id);
}

// ✅ Correct - convert to array if needed
const entitiesArray = Array.from(entityManager.entities);

// ❌ WRONG - getEntities() doesn't exist in production
const entities = entityManager.getEntities(); // undefined!
```

## Common Migration Patterns

### Updating Operators for Production

**Before (Incorrect):**
```javascript
class MyOperator {
  execute(context) {
    // ❌ Method doesn't exist in production
    const entities = this.#entityManager.getAllEntities();
    // ❌ Also wrong - getEntities doesn't exist in production
    const entities2 = this.#entityManager.getEntities();
  }
}
```

**After (Correct):**
```javascript
class MyOperator {
  execute(context) {
    // ✅ Use entities getter and convert to array
    const entities = Array.from(this.#entityManager.entities);

    // ✅ Or iterate directly
    for (const entity of this.#entityManager.entities) {
      // process entity
    }
  }
}
```

### Updating Scope Resolvers

Scope resolvers should use the interface methods consistently:

```javascript
// ✅ Good - Uses entities getter correctly
const resolver = (runtimeCtx) => {
  // Convert iterator to array first
  const entities = Array.from(runtimeCtx.entityManager.entities);
  return entities.filter(e =>
    runtimeCtx.entityManager.hasComponent(e.id, 'positioning:sitting')
  );
};

// ✅ Better - Iterate directly without array conversion
const resolver = (runtimeCtx) => {
  const result = [];
  for (const entity of runtimeCtx.entityManager.entities) {
    if (runtimeCtx.entityManager.hasComponent(entity.id, 'positioning:sitting')) {
      result.push(entity);
    }
  }
  return result;
};
```

## Key Takeaways

1. **Production uses `entities` getter** returning `IterableIterator<Entity>`, NOT a `getEntities()` method
2. **Test SimpleEntityManager has `getEntities()` method** returning `Array<Object>` for convenience
3. **Return types differ:** Production returns `undefined` for missing entities/components, test may return `null`
4. **Always use `Array.from()` or `for...of`** to work with the entities iterator in production
5. **IEntityManager already exists** at `src/interfaces/IEntityManager.js` with comprehensive interface definition

## References

- **Interface Definition:** `src/interfaces/IEntityManager.js` (EXISTING)
- **Production Implementation:** `src/entities/entityManager.js`
- **Test Implementation:** `tests/common/entities/simpleEntityManager.js`
- **Compliance Tests:** `tests/unit/entities/entityManagerInterface.test.js` (NEW)
- **Report:** `reports/anatomy-prerequisite-test-fixes-2025-01.md` (lines 113-134)
```

## Acceptance Criteria

- [ ] **Interface Review:** Reviewed existing `IEntityManager` at `src/interfaces/IEntityManager.js` for completeness
- [ ] **SimpleEntityManager Enhancement:** Add `entities` getter to `tests/common/entities/simpleEntityManager.js` for interface compatibility
- [ ] **Unit Tests:** Create `tests/unit/entities/entityManagerInterface.test.js` verifying both implementations
- [ ] **Documentation:** Create comprehensive `docs/testing/entity-manager-interface.md` with:
  - Critical differences between production and test implementations
  - Correct usage of `entities` getter (not `getEntities()` method)
  - All core interface methods with accurate signatures and return types
  - Migration patterns from incorrect usage
  - Test vs production compatibility examples
- [ ] **Key Discoveries Documented:**
  - Production uses `entities` getter returning `IterableIterator<Entity>`
  - SimpleEntityManager uses `getEntities()` method returning `Array<Object>`
  - Return types: `undefined` vs `null` differences
  - Correct iteration patterns using `Array.from()` or `for...of`
- [ ] All tests pass without breaking existing code
- [ ] No breaking changes to production or test code

## Implementation Notes

**Key Design Decisions:**

1. **Interface Already Exists**: No need to create new interface - `src/interfaces/IEntityManager.js` already has comprehensive definitions
2. **Preserve Backward Compatibility**: Keep `getEntities()` method in SimpleEntityManager for existing tests while adding `entities` getter
3. **Document, Don't Break**: Focus on documenting correct usage patterns rather than forcing breaking changes
4. **Production Pattern is Source of Truth**: Production `EntityManager` using `entities` getter is the canonical interface

**Testing Strategy:**

1. Create interface compliance tests comparing production and test implementations
2. Document API differences explicitly in tests
3. Test both `getEntities()` method (backward compat) and `entities` getter (forward compat) in SimpleEntityManager

**Migration Path:**

1. **Phase 1** (This Ticket): Document interface, add compliance tests, enhance SimpleEntityManager with getter
2. **Phase 2** (Future): Gradually migrate test code to use `entities` getter instead of `getEntities()` method
3. **Phase 3** (Future): Consider deprecating `getEntities()` method in favor of standard getter

**Critical Discoveries:**

- **Original assumption was WRONG**: Workflow assumed `getEntities()` method exists in production - it doesn't!
- **Actual interface**: Production uses `entities` **getter** returning `IterableIterator<Entity>`
- **Test convenience**: SimpleEntityManager has `getEntities()` **method** for test convenience, creating API drift
- **Return type differences**: Production returns `undefined`, tests may return `null`

## Dependencies

**Blocks:**
- ANAPRETEST-005 (Standardize Entity Manager Mock Creation) - Needs interface definition first

**Related:**
- Anatomy prerequisite test fixes (completed)
- `hasOtherActorsAtLocationOperator` fix (completed)

## References

- **Report Section:** Suggestion #1 - Create Entity Manager Interface Documentation
- **Report Lines:** 113-134
- **Original Issue:** Operator attempted to call non-existent method on entity manager
- **Corrected Understanding:** Production uses `entities` getter, not `getEntities()` or `getAllEntities()` methods
- **Related Files:**
  - `src/interfaces/IEntityManager.js` - Existing interface definition (26 methods total)
  - `src/entities/entityManager.js` - Production implementation (lines 87-88: entities getter)
  - `tests/common/entities/simpleEntityManager.js` - Test implementation (line 232: getEntities method)
  - `tests/common/engine/systemLogicTestEnv.js` - Test environment using SimpleEntityManager
- **Related Docs:**
  - `docs/testing/anatomy-testing-guide.md` - Will reference this interface documentation
  - `docs/testing/mod-testing-guide.md` - Testing patterns and best practices
