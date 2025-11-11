# ANAPRETEST-005: Standardize Entity Manager Mock Creation

**Phase:** 2 (Test Infrastructure)
**Priority:** P2 (Medium)
**Effort:** Medium (3-4 days)
**Impact:** Medium - Reduces API drift and improves test reliability
**Status:** Not Started

## Context

Tests use `SimpleEntityManager` (located at `tests/common/entities/simpleEntityManager.js`) which has largely compatible API with production `EntityManager` but with some differences in implementation details. The production EntityManager has an `entities` getter that returns an iterator, while SimpleEntityManager provides both `getEntities()` (returns array) and `entities` getter for compatibility.

**Key Findings from Code Analysis:**
- Production EntityManager API (src/entities/entityManager.js):
  - `entities` getter (returns IterableIterator)
  - `getEntityIds()` (returns array of IDs)
  - `getEntityInstance()`, `getComponentData()`, `hasComponent()`
  - `getEntitiesWithComponent()` (returns array of entities)
  - `getEntitiesInLocation()` (returns Set<string> of entity IDs, NOT entities)
  - `findEntities()`, `getAllComponentTypesForEntity()`
  - Does NOT have: `getEntities()` as array method, `getEntitiesAtLocation()` returning entities

- SimpleEntityManager API (tests/common/entities/simpleEntityManager.js):
  - `getEntities()` (returns array - test-only convenience)
  - `entities` getter (returns iterator for production compatibility)
  - `getEntityIds()`, `getEntityInstance()`, `getComponentData()`, `hasComponent()`
  - `getEntitiesWithComponent()`, `getEntitiesInLocation()` (returns Set<string>)
  - `getAllComponentTypesForEntity()`
  - Already implements most IEntityManager interface methods

**Root Cause:** SimpleEntityManager already has good API compatibility. The real issue is that some test code may use convenience methods like `getEntities()` that don't exist in production, and path confusion due to multiple engine-related directories.

**Impact:** Minor API drift in convenience methods; mainly affects test code portability.

**Reference:** Report lines 219-246

## Solution Overview

Create a standardized test entity manager that provides the production API surface:

1. **TestEntityManagerAdapter**
   - Wrap `SimpleEntityManager` to provide production API
   - Implement missing methods using adapter pattern
   - Document which methods are required vs optional

2. **Migration Path**
   - Gradually migrate tests to use adapter
   - Ensure backward compatibility with existing tests
   - Update test utilities to use adapter by default

3. **API Compatibility Layer**
   - Define shared interface (from ANAPRETEST-001)
   - Implement additional production methods
   - Add deprecation warnings for direct `SimpleEntityManager` usage

## File Structure

```
tests/common/entities/
├── TestEntityManagerAdapter.js              # NEW: Production API adapter
├── simpleEntityManager.js                   # EXISTING: Keep for backward compat
└── entityManagerTestFactory.js              # NEW: Factory for test managers

tests/common/engine/
└── systemLogicTestEnv.js                    # EXISTING: Modified to use adapter by default

tests/integration/entities/
└── entityManagerApiCompatibility.test.js    # NEW: API compatibility tests

docs/testing/
└── entity-manager-testing-guide.md          # NEW: Testing guide

docs/migration/
└── simple-entity-manager-migration.md       # NEW: Migration guide
```

**Note:** SimpleEntityManager is located at `tests/common/entities/simpleEntityManager.js` (lowercase filename), not in the `engine/` subdirectory.

## Detailed Implementation Steps

### Step 1: Create TestEntityManagerAdapter

**File:** `tests/common/entities/TestEntityManagerAdapter.js`

```javascript
/**
 * @file Test Entity Manager Adapter
 * @description Adapts SimpleEntityManager to provide production EntityManager API
 */

import SimpleEntityManager from './simpleEntityManager.js';

/**
 * Adapter that wraps SimpleEntityManager to provide production EntityManager API.
 *
 * This allows operators and services to use the same API in tests as in production,
 * preventing API drift and runtime errors.
 */
export default class TestEntityManagerAdapter {
  #simple;
  #logger;

  /**
   * @param {Object} config - Configuration
   * @param {Object} config.logger - Logger instance
   * @param {SimpleEntityManager} [config.simpleManager] - Existing SimpleEntityManager to wrap
   * @param {Array<Object>} [config.initialEntities] - Initial entities to load
   */
  constructor({ logger, simpleManager, initialEntities = [] }) {
    this.#logger = logger;
    // Note: SimpleEntityManager constructor takes array of entities, not config object
    this.#simple = simpleManager || new SimpleEntityManager(initialEntities);
  }

  // ============================================================================
  // IEntityManager Interface (Required Methods)
  // ============================================================================

  /**
   * Get iterator over all entities (production API).
   * This matches the production EntityManager.entities getter.
   *
   * @returns {IterableIterator<Object>} Iterator over all entities
   */
  get entities() {
    return this.#simple.entities;
  }

  /**
   * Get array of all entity IDs.
   * This matches the production EntityManager.getEntityIds() method.
   *
   * @returns {Array<string>} Array of entity IDs
   */
  getEntityIds() {
    return this.#simple.getEntityIds();
  }

  /**
   * Get component data for a specific entity and component type.
   *
   * @param {string} entityId - The entity ID
   * @param {string} componentType - Namespaced component type
   * @returns {Object|null} Component data object, or null if not found
   */
  getComponentData(entityId, componentType) {
    return this.#simple.getComponentData(entityId, componentType);
  }

  /**
   * Check if entity has a specific component.
   *
   * @param {string} entityId - The entity ID
   * @param {string} componentType - Namespaced component type
   * @returns {boolean} True if entity has component
   */
  hasComponent(entityId, componentType) {
    return this.#simple.hasComponent(entityId, componentType);
  }

  /**
   * Get full entity instance with all components.
   *
   * @param {string} entityId - The entity ID
   * @returns {Object|null} Entity object with components, or null if not found
   */
  getEntityInstance(entityId) {
    return this.#simple.getEntityInstance(entityId);
  }

  // ============================================================================
  // Production API Extensions (Additional Methods)
  // ============================================================================

  /**
   * Get entities that have a specific component.
   * This matches the production EntityManager.getEntitiesWithComponent() method.
   *
   * @param {string} componentType - Component type to filter by
   * @returns {Array<Object>} Entities with component
   */
  getEntitiesWithComponent(componentType) {
    return this.#simple.getEntitiesWithComponent(componentType);
  }

  /**
   * Get entity IDs at a specific location.
   * This matches the production EntityManager.getEntitiesInLocation() method.
   * NOTE: Production returns Set<string> of entity IDs, NOT entity objects.
   *
   * @param {string} locationId - Location ID
   * @returns {Set<string>} Set of entity IDs at location
   */
  getEntitiesInLocation(locationId) {
    return this.#simple.getEntitiesInLocation(locationId);
  }

  /**
   * Get all component types present on an entity.
   * This matches the production EntityManager.getAllComponentTypesForEntity() method.
   *
   * @param {string} entityId - Entity ID
   * @returns {Array<string>} Component type names
   */
  getAllComponentTypesForEntity(entityId) {
    return this.#simple.getAllComponentTypesForEntity(entityId);
  }

  /**
   * Find entities matching complex query criteria.
   * This matches the production EntityManager.findEntities() method.
   *
   * @param {object} queryObj - Query object with withAll, withAny, without conditions
   * @returns {Array<Object>} Array of entities matching the query
   */
  findEntities(queryObj) {
    // SimpleEntityManager doesn't have findEntities, so implement it
    const allEntities = Array.from(this.#simple.entities);

    return allEntities.filter(entity => {
      // Check withAll - entity must have all these components
      if (queryObj.withAll && Array.isArray(queryObj.withAll)) {
        const hasAll = queryObj.withAll.every(componentType =>
          this.hasComponent(entity.id, componentType)
        );
        if (!hasAll) return false;
      }

      // Check withAny - entity must have at least one of these components
      if (queryObj.withAny && Array.isArray(queryObj.withAny)) {
        const hasAny = queryObj.withAny.some(componentType =>
          this.hasComponent(entity.id, componentType)
        );
        if (!hasAny) return false;
      }

      // Check without - entity must not have any of these components
      if (queryObj.without && Array.isArray(queryObj.without)) {
        const hasNone = queryObj.without.every(componentType =>
          !this.hasComponent(entity.id, componentType)
        );
        if (!hasNone) return false;
      }

      return true;
    });
  }

  // ============================================================================
  // SimpleEntityManager Passthrough (Test-Specific Methods)
  // ============================================================================

  /**
   * Get all entities as array (test-only convenience method).
   * NOTE: Production EntityManager does NOT have this method - use entities getter instead.
   *
   * @returns {Array<Object>} Array of entity objects
   */
  getEntities() {
    return this.#simple.getEntities();
  }

  /**
   * Add entity to the manager (test-only).
   *
   * @param {Object} entity - Entity to add
   */
  addEntity(entity) {
    this.#simple.addEntity(entity);
  }

  /**
   * Delete entity from the manager (test-only).
   * Note: SimpleEntityManager uses deleteEntity, not removeEntity.
   *
   * @param {string} entityId - Entity ID to remove
   */
  deleteEntity(entityId) {
    this.#simple.deleteEntity(entityId);
  }

  /**
   * Clear all entities (test-only).
   */
  clearAll() {
    this.#simple.clearAll();
  }

  /**
   * Set entities (test-only).
   * Replaces all entities with the provided array.
   *
   * @param {Array<Object>} entities - Entities to set
   */
  setEntities(entities = []) {
    this.#simple.setEntities(entities);
  }

  /**
   * Get underlying SimpleEntityManager (for migration purposes).
   *
   * @deprecated Use adapter methods directly
   * @returns {SimpleEntityManager} Simple entity manager
   */
  getSimpleManager() {
    this.#logger.warn(
      'TestEntityManagerAdapter.getSimpleManager() is deprecated',
      {
        hint: 'Use adapter methods directly instead of accessing SimpleEntityManager'
      }
    );
    return this.#simple;
  }
}
```

### Step 2: Create Entity Manager Factory

**File:** `tests/common/entities/entityManagerTestFactory.js`

```javascript
/**
 * @file Entity Manager Test Factory
 * @description Factory for creating test entity managers with correct API
 */

import TestEntityManagerAdapter from './TestEntityManagerAdapter.js';
import SimpleEntityManager from './simpleEntityManager.js';

/**
 * Create entity manager for tests.
 *
 * @param {Object} config - Configuration
 * @param {Object} config.logger - Logger instance
 * @param {boolean} [config.useAdapter=true] - Use adapter (recommended)
 * @param {Array<Object>} [config.initialEntities=[]] - Initial entities
 * @returns {TestEntityManagerAdapter|SimpleEntityManager} Entity manager
 */
export function createTestEntityManager(config) {
  const { logger, useAdapter = true, initialEntities = [] } = config;

  if (useAdapter) {
    const adapter = new TestEntityManagerAdapter({ logger, initialEntities });
    return adapter;
  } else {
    // Legacy mode - direct SimpleEntityManager
    if (logger && logger.warn) {
      logger.warn(
        'Using SimpleEntityManager directly is deprecated',
        {
          hint: 'Set useAdapter: true to use TestEntityManagerAdapter for production API compatibility'
        }
      );
    }

    // SimpleEntityManager constructor takes array of entities directly
    const manager = new SimpleEntityManager(initialEntities);
    return manager;
  }
}

/**
 * Create entity manager adapter (recommended).
 *
 * @param {Object} config - Configuration
 * @param {Object} config.logger - Logger instance
 * @param {Array<Object>} [config.initialEntities=[]] - Initial entities
 * @returns {TestEntityManagerAdapter} Adapter with production API
 */
export function createEntityManagerAdapter(config) {
  return createTestEntityManager({ ...config, useAdapter: true });
}

/**
 * Create simple entity manager (legacy).
 *
 * @deprecated Use createEntityManagerAdapter instead
 * @param {Object} config - Configuration
 * @returns {SimpleEntityManager} Simple manager
 */
export function createSimpleEntityManager(config) {
  config.logger.warn(
    'createSimpleEntityManager is deprecated',
    {
      hint: 'Use createEntityManagerAdapter for production API compatibility'
    }
  );
  return createTestEntityManager({ ...config, useAdapter: false });
}
```

### Step 3: Update systemLogicTestEnv to Use Adapter

**File:** `tests/common/engine/systemLogicTestEnv.js` (modify)

```javascript
import { createEntityManagerAdapter } from '../entities/entityManagerTestFactory.js';

export function createSystemLogicTestEnv(options = {}) {
  const {
    useAdapterEntityManager = true, // Default to adapter
    // ... other options
  } = options;

  // ... existing setup ...

  // Create entity manager with adapter by default
  const entityManager = useAdapterEntityManager
    ? createEntityManagerAdapter({ logger })
    : new SimpleEntityManager([]); // Legacy fallback - takes array of entities

  // Validate interface compliance (from ANAPRETEST-001)
  validateEntityManagerInterface(entityManager, 'Test EntityManager');

  // ... rest of setup ...

  return {
    entityManager,
    // ... other properties ...
  };
}
```

### Step 4: Create API Compatibility Tests

**File:** `tests/integration/entities/entityManagerApiCompatibility.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import TestEntityManagerAdapter from '../../common/entities/TestEntityManagerAdapter.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import EntityManager from '../../../src/entities/entityManager.js';

describe('Entity Manager API Compatibility', () => {
  let logger;

  beforeEach(() => {
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };
  });

  describe('IEntityManager Interface', () => {
    it('TestEntityManagerAdapter should match production EntityManager API', () => {
      const adapter = new TestEntityManagerAdapter({ logger, initialEntities: [] });

      // Required methods from IEntityManager
      const requiredMethods = [
        'getEntityInstance',
        'getComponentData',
        'hasComponent',
        'getEntitiesWithComponent',
        'findEntities',
        'getAllComponentTypesForEntity',
        'getEntityIds',
        'getEntitiesInLocation'
      ];

      for (const method of requiredMethods) {
        expect(typeof adapter[method]).toBe('function');
      }

      // Check entities getter (not a function, but a getter)
      expect(adapter.entities).toBeDefined();
    });

    it('TestEntityManagerAdapter should provide test-specific convenience methods', () => {
      const adapter = new TestEntityManagerAdapter({ logger, initialEntities: [] });

      // Test-specific convenience methods (not in production)
      const testMethods = [
        'getEntities',      // Array convenience method (not in production)
        'addEntity',        // Test setup method
        'deleteEntity',     // Test cleanup method
        'clearAll',         // Test reset method
        'setEntities'       // Test setup method
      ];

      for (const method of testMethods) {
        expect(typeof adapter[method]).toBe('function');
      }
    });
  });

  describe('Behavioral Compatibility', () => {
    let adapter;

    beforeEach(() => {
      adapter = new TestEntityManagerAdapter({ logger, initialEntities: [] });

      // Add test entities
      adapter.addEntity({
        id: 'actor-1',
        components: {
          'core:actor': {},
          'positioning:standing': {},
          'core:position': { locationId: 'room1' }
        }
      });

      adapter.addEntity({
        id: 'actor-2',
        components: {
          'core:actor': {},
          'positioning:sitting': { furniture_id: 'couch' },
          'core:position': { locationId: 'room1' }
        }
      });

      adapter.addEntity({
        id: 'item-1',
        components: {
          'items:portable': {},
          'core:position': { locationId: 'room2' }
        }
      });
    });

    describe('entities getter', () => {
      it('should return iterator over all entities', () => {
        const entities = Array.from(adapter.entities);

        expect(Array.isArray(entities)).toBe(true);
        expect(entities.length).toBe(3);
        expect(entities.map(e => e.id).sort()).toEqual(['actor-1', 'actor-2', 'item-1']);
      });
    });

    describe('getEntities (test convenience)', () => {
      it('should return all entities as array', () => {
        const entities = adapter.getEntities();

        expect(Array.isArray(entities)).toBe(true);
        expect(entities.length).toBe(3);
        expect(entities.map(e => e.id).sort()).toEqual(['actor-1', 'actor-2', 'item-1']);
      });
    });

    describe('getEntitiesWithComponent', () => {
      it('should filter entities by component', () => {
        const actors = adapter.getEntitiesWithComponent('core:actor');

        expect(actors.length).toBe(2);
        expect(actors.map(e => e.id).sort()).toEqual(['actor-1', 'actor-2']);
      });

      it('should return empty array when no entities have component', () => {
        const result = adapter.getEntitiesWithComponent('nonexistent:component');

        expect(result).toEqual([]);
      });
    });

    describe('getEntitiesInLocation', () => {
      it('should return Set of entity IDs at location', () => {
        const room1EntityIds = adapter.getEntitiesInLocation('room1');

        expect(room1EntityIds instanceof Set).toBe(true);
        expect(room1EntityIds.size).toBe(2);
        expect(Array.from(room1EntityIds).sort()).toEqual(['actor-1', 'actor-2']);
      });

      it('should return empty Set for empty location', () => {
        const result = adapter.getEntitiesInLocation('empty-room');

        expect(result instanceof Set).toBe(true);
        expect(result.size).toBe(0);
      });
    });

    describe('getAllComponentTypesForEntity', () => {
      it('should return all component types for entity', () => {
        const components = adapter.getAllComponentTypesForEntity('actor-1');

        expect(components.sort()).toEqual([
          'core:actor',
          'core:position',
          'positioning:standing'
        ]);
      });

      it('should return empty array for nonexistent entity', () => {
        const components = adapter.getAllComponentTypesForEntity('nonexistent');

        expect(components).toEqual([]);
      });
    });

    describe('findEntities', () => {
      it('should find entities matching complex query', () => {
        const result = adapter.findEntities({
          withAll: ['core:actor'],
          without: ['positioning:sitting']
        });

        expect(result.length).toBe(1);
        expect(result[0].id).toBe('actor-1');
      });

      it('should return empty array when no matches', () => {
        const result = adapter.findEntities({
          withAll: ['nonexistent:component']
        });

        expect(result).toEqual([]);
      });
    });
  });

  describe('SimpleEntityManager Passthrough', () => {
    it('should support test-specific methods', () => {
      const adapter = new TestEntityManagerAdapter({ logger, initialEntities: [] });

      // Test-specific methods should work
      const entity = { id: 'test', components: {} };
      adapter.addEntity(entity);

      expect(adapter.getEntityInstance('test')).toBeDefined();
      expect(adapter.getEntityInstance('test').id).toBe('test');

      adapter.deleteEntity('test');
      expect(adapter.getEntityInstance('test')).toBeUndefined();

      adapter.addEntity({ id: 'test2', components: {} });
      adapter.clearAll();
      expect(adapter.getEntities()).toEqual([]);
    });
  });

  describe('Migration Support', () => {
    it('should warn when accessing SimpleEntityManager directly', () => {
      const adapter = new TestEntityManagerAdapter({ logger });

      adapter.getSimpleManager();

      expect(logger.warn).toHaveBeenCalledWith(
        'TestEntityManagerAdapter.getSimpleManager() is deprecated',
        expect.objectContaining({
          hint: expect.stringContaining('Use adapter methods directly')
        })
      );
    });
  });
});
```

### Step 5: Create Testing Guide

**File:** `docs/testing/entity-manager-testing-guide.md`

```markdown
# Entity Manager Testing Guide

## Overview

This guide explains how to use entity managers in tests with production API compatibility.

## Quick Start

### Use TestEntityManagerAdapter (Recommended)

```javascript
import { createEntityManagerAdapter } from '../../common/entities/entityManagerTestFactory.js';

describe('My Test', () => {
  let entityManager;

  beforeEach(() => {
    const logger = { /* ... */ };
    entityManager = createEntityManagerAdapter({ logger });
  });

  it('should use production API', () => {
    // Production API methods work the same in tests
    const entities = entityManager.getEntities();
    const actors = entityManager.getEntitiesWithComponent('core:actor');
  });
});
```

### Legacy SimpleEntityManager (Not Recommended)

```javascript
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';

// ⚠️ This approach is deprecated - use TestEntityManagerAdapter instead
// Note: SimpleEntityManager constructor takes array of entities, not config
const manager = new SimpleEntityManager([]);
```

## API Compatibility

### IEntityManager Interface (Required)

All entity managers implement these methods from the IEntityManager interface:

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `entities` (getter) | None | `IterableIterator<Entity>` | Iterator over all entities |
| `getEntityIds()` | None | `Array<string>` | Get all entity IDs |
| `getComponentData(entityId, componentType)` | `string, string` | `Object\|undefined` | Get component data |
| `hasComponent(entityId, componentType)` | `string, string` | `boolean` | Check component presence |
| `getEntityInstance(entityId)` | `string` | `Entity\|undefined` | Get full entity |
| `getEntitiesWithComponent(componentType)` | `string` | `Array<Entity>` | Filter entities by component |
| `getEntitiesInLocation(locationId)` | `string` | `Set<string>` | Get entity IDs at location |
| `findEntities(queryObj)` | `object` | `Array<Entity>` | Complex query filtering |
| `getAllComponentTypesForEntity(entityId)` | `string` | `Array<string>` | Get all component types |

### Test-Specific Convenience Methods

Methods for test setup and teardown (not in production):

| Method | Description |
|--------|-------------|
| `getEntities()` | Get all entities as array (convenience) |
| `addEntity(entity)` | Add entity to manager |
| `deleteEntity(entityId)` | Remove entity from manager |
| `clearAll()` | Remove all entities |
| `setEntities(entities)` | Replace all entities |

## Common Patterns

### Pattern 1: Setup Test Entities

```javascript
beforeEach(() => {
  entityManager = createEntityManagerAdapter({ logger });

  // Add test entities
  entityManager.addEntity({
    id: 'actor-1',
    components: {
      'core:actor': {},
      'anatomy:body': { parts: { /* ... */ } }
    }
  });
});
```

### Pattern 2: Iterate Entities in Production Code

```javascript
class MyOperator {
  execute(context) {
    // ✅ CORRECT - Production API using iterator
    for (const entity of this.#entityManager.entities) {
      // Process entity
    }

    // ✅ CORRECT - Convert to array if needed
    const entities = Array.from(this.#entityManager.entities);

    // ✅ CORRECT - Production API method
    const actors = this.#entityManager.getEntitiesWithComponent('core:actor');

    // ❌ WRONG - getEntities() doesn't exist in production
    const all = this.#entityManager.getEntities();
  }
}
```

### Pattern 3: Location-Based Queries

```javascript
it('should find entity IDs at location', () => {
  // Production API returns Set<string> of entity IDs
  const room1EntityIds = entityManager.getEntitiesInLocation('room1');

  expect(room1EntityIds instanceof Set).toBe(true);
  expect(room1EntityIds.size).toBeGreaterThan(0);

  // Convert to entity objects if needed
  const entities = Array.from(room1EntityIds)
    .map(id => entityManager.getEntityInstance(id))
    .filter(Boolean);
});
```

## Migration from SimpleEntityManager

### Step 1: Update Imports

**Before:**
```javascript
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';

const manager = new SimpleEntityManager([]);
```

**After:**
```javascript
import { createEntityManagerAdapter } from '../../common/entities/entityManagerTestFactory.js';

const manager = createEntityManagerAdapter({ logger });
```

### Step 2: No Code Changes Needed

All `SimpleEntityManager` methods work through the adapter:

```javascript
// These all work the same
manager.addEntity(entity);
manager.getEntities();  // Test convenience method (array)
manager.hasComponent(id, type);
manager.clearAll();
```

### Step 3: Use Production Extensions

Start using production API methods for better compatibility:

```javascript
// ✅ Production API - works in tests and production
const actors = manager.getEntitiesWithComponent('core:actor');

// ⚠️ Manual filtering - works but not idiomatic
const actors = manager.getEntities().filter(e =>
  manager.hasComponent(e.id, 'core:actor')
);
```

## Troubleshooting

### "Method does not exist" Errors

**Problem:** Calling `getEntities()` in production code (it only exists in test adapter)

**Solution:** Use production API `entities` getter

```javascript
// ❌ Wrong - Only works in tests
const entities = manager.getEntities();

// ✅ Correct - Production API
const entities = Array.from(manager.entities);

// ✅ Alternative - Use specific query methods
const actors = manager.getEntitiesWithComponent('core:actor');
```

### API Drift Between Test and Production

**Problem:** Code works in tests but fails in production

**Solution:** Use `TestEntityManagerAdapter` to ensure API compatibility

```javascript
// This ensures test and production use same API
const manager = createEntityManagerAdapter({ logger });
```

### Performance Issues

**Problem:** Filtering entities inefficiently

**Solution:** Use production API methods strategically

```javascript
// ⚠️ Inefficient - Multiple iterations
const actors = Array.from(manager.entities)
  .filter(e => manager.hasComponent(e.id, 'core:actor'))
  .filter(e => {
    const loc = manager.getComponentData(e.id, 'core:position');
    return loc?.locationId === 'room1';
  });

// ✅ Better - Use getEntitiesWithComponent first
const actorsInRoom = manager
  .getEntitiesWithComponent('core:actor')
  .filter(e => {
    const loc = manager.getComponentData(e.id, 'core:position');
    return loc?.locationId === 'room1';
  });

// ✅ Best - Use location filter first, then check components
const room1EntityIds = manager.getEntitiesInLocation('room1');
const actors = manager
  .getEntitiesWithComponent('core:actor')
  .filter(e => room1EntityIds.has(e.id));
```

## References

- **Interface Definition:** `src/interfaces/IEntityManager.js`
- **Production Implementation:** `src/entities/entityManager.js`
- **Test Implementation:** `tests/common/entities/simpleEntityManager.js`
- **Adapter Implementation:** `tests/common/entities/TestEntityManagerAdapter.js`
- **Factory:** `tests/common/entities/entityManagerTestFactory.js`
- **Compatibility Tests:** `tests/integration/entities/entityManagerApiCompatibility.test.js`
- **Report:** `reports/anatomy-prerequisite-test-fixes-2025-01.md` (lines 219-246)
```

### Step 6: Create Migration Guide

**File:** `docs/migration/simple-entity-manager-migration.md`

```markdown
# SimpleEntityManager Migration Guide

## Overview

This guide helps migrate tests from direct `SimpleEntityManager` usage to `TestEntityManagerAdapter` for production API compatibility.

## Why Migrate?

### Before (SimpleEntityManager)

❌ **Problem:** API drift between test and production
❌ **Problem:** Operators must defensively code for both APIs
❌ **Problem:** Runtime errors that don't surface until integration testing

### After (TestEntityManagerAdapter)

✅ **Benefit:** Same API in tests and production
✅ **Benefit:** Catch API misuse early in unit tests
✅ **Benefit:** Easier operator development

## Migration Steps

### Step 1: Update Test File Imports

**Find files using SimpleEntityManager:**
```bash
grep -r "SimpleEntityManager" tests/
```

**Before:**
```javascript
import SimpleEntityManager from '../../common/engine/SimpleEntityManager.js';

describe('My Test', () => {
  let entityManager;

  beforeEach(() => {
    entityManager = new SimpleEntityManager({ logger });
  });
});
```

**After:**
```javascript
import { createEntityManagerAdapter } from '../../common/engine/entityManagerTestFactory.js';

describe('My Test', () => {
  let entityManager;

  beforeEach(() => {
    entityManager = createEntityManagerAdapter({ logger });
  });
});
```

### Step 2: No Logic Changes Required

All existing test code continues to work:

```javascript
// All these work the same
entityManager.addEntity({ id: 'test', components: {} });
entityManager.getEntities();
entityManager.hasComponent('test', 'core:actor');
entityManager.getComponentData('test', 'core:actor');
entityManager.clear();
```

### Step 3: (Optional) Use Production Extensions

Take advantage of new production API methods:

```javascript
// Before - manual filtering
const actors = entityManager.getEntities().filter(e =>
  entityManager.hasComponent(e.id, 'core:actor')
);

// After - production API
const actors = entityManager.getEntitiesWithComponent('core:actor');
```

## Automated Migration Script

Use this script to automate Step 1:

```bash
#!/bin/bash
# migrate-entity-manager.sh

find tests/ -name "*.test.js" -type f | while read file; do
  # Check if file uses SimpleEntityManager
  if grep -q "SimpleEntityManager" "$file"; then
    echo "Migrating: $file"

    # Update import
    sed -i 's/import SimpleEntityManager from/import { createEntityManagerAdapter } from/g' "$file"
    sed -i 's/SimpleEntityManager\.js/entityManagerTestFactory\.js/g' "$file"

    # Update instantiation
    sed -i 's/new SimpleEntityManager({ logger })/createEntityManagerAdapter({ logger })/g' "$file"

    echo "  ✓ Migrated"
  fi
done

echo "Migration complete"
```

## Validation

After migration, run tests to verify:

```bash
# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Verify no warnings about SimpleEntityManager
npm run test:unit 2>&1 | grep "SimpleEntityManager is deprecated"
```

## Rollback

If migration causes issues, rollback is simple:

```bash
git checkout tests/
```

Individual files can be reverted using legacy mode:

```javascript
import { createTestEntityManager } from '../../common/engine/entityManagerTestFactory.js';

// Use legacy SimpleEntityManager
const manager = createTestEntityManager({ logger, useAdapter: false });
```

## Timeline

**Phase 1 (Weeks 1-2):** Migrate high-traffic test files
**Phase 2 (Weeks 3-4):** Migrate remaining test files
**Phase 3 (Week 5):** Remove SimpleEntityManager deprecation warnings
**Phase 4 (Week 6):** Make adapter the default (remove useAdapter flag)

## References

- **Testing Guide:** `docs/testing/entity-manager-testing-guide.md`
- **Interface Definition:** `docs/testing/entity-manager-interface.md` (from ANAPRETEST-001)
- **Adapter Code:** `tests/common/engine/TestEntityManagerAdapter.js`
```

## Acceptance Criteria

- [ ] `TestEntityManagerAdapter` created with production API surface
- [ ] Entity manager factory created with adapter/legacy modes
- [ ] `systemLogicTestEnv` updated to use adapter by default
- [ ] API compatibility tests created and passing
- [ ] Testing guide created at `docs/testing/entity-manager-testing-guide.md`
- [ ] Migration guide created at `docs/migration/simple-entity-manager-migration.md`
- [ ] All existing tests pass with adapter (backward compatible)
- [ ] No breaking changes to existing tests
- [ ] Adapter provides:
  - All IEntityManager interface methods
  - Production API extensions (getEntitiesWithComponent, getEntitiesAtLocation, etc.)
  - Test-specific methods (addEntity, clear, reset)

## Implementation Notes

**Key Design Decisions:**

1. **Adapter Pattern**: Wrap SimpleEntityManager rather than replacing it to maintain backward compatibility
2. **Gradual Migration**: Allow both adapter and direct usage during transition
3. **Production API First**: Implement production methods to prevent API drift

**Testing Strategy:**

1. Compatibility tests verify adapter matches production API
2. Behavioral tests ensure all methods work correctly
3. Migration tests verify backward compatibility

**Performance Considerations:**

- Adapter adds minimal overhead (single function call delegation)
- Filtering methods use efficient array operations
- Caching can be added later if needed

## Dependencies

**Requires:**
- ANAPRETEST-001 (Entity Manager Interface Documentation) - For IEntityManager interface definition

**Blocks:**
- None (standalone improvement that enhances existing tests)

## References

- **Report Section:** Suggestion #5 - Standardize Entity Manager Mock Creation
- **Report Lines:** 219-246
- **Related Issue:** `hasOtherActorsAtLocationOperator.js:166` - getAllEntities() → getEntities()
- **Related Docs:**
  - ANAPRETEST-001 - Entity Manager Interface Documentation
  - `docs/testing/anatomy-testing-guide.md` - Will reference adapter usage
