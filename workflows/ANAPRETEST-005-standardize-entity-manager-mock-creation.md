# ANAPRETEST-005: Standardize Entity Manager Mock Creation

**Phase:** 2 (Test Infrastructure)
**Priority:** P2 (Medium)
**Effort:** Medium (3-4 days)
**Impact:** Medium - Reduces API drift and improves test reliability
**Status:** Not Started

## Context

Tests use `SimpleEntityManager` which has a different API than production `EntityManager`. This API mismatch required operators to handle both implementations, and caused the `hasOtherActorsAtLocationOperator` bug where it called `getAllEntities()` (non-existent method) instead of `getEntities()`.

**Root Cause:** No adapter or wrapper to bridge the gap between test and production entity manager APIs.

**Impact:** API drift between test and production implementations, requiring defensive coding in operators and services.

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
tests/common/engine/
├── TestEntityManagerAdapter.js              # NEW: Production API adapter
├── SimpleEntityManager.js                   # Keep for backward compat
├── entityManagerTestFactory.js              # NEW: Factory for test managers
└── systemLogicTestEnv.js                    # Modified: Use adapter by default

tests/integration/entities/
└── entityManagerApiCompatibility.test.js    # NEW: API compatibility tests

docs/testing/
└── entity-manager-testing-guide.md          # NEW: Testing guide

docs/migration/
└── simple-entity-manager-migration.md       # NEW: Migration guide
```

## Detailed Implementation Steps

### Step 1: Create TestEntityManagerAdapter

**File:** `tests/common/engine/TestEntityManagerAdapter.js`

```javascript
/**
 * @file Test Entity Manager Adapter
 * @description Adapts SimpleEntityManager to provide production EntityManager API
 */

import SimpleEntityManager from './SimpleEntityManager.js';

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
   */
  constructor({ logger, simpleManager }) {
    this.#logger = logger;
    this.#simple = simpleManager || new SimpleEntityManager({ logger });
  }

  // ============================================================================
  // IEntityManager Interface (Required Methods)
  // ============================================================================

  /**
   * Get all entities as an array.
   *
   * @returns {Array<Object>} Array of entity objects
   */
  getEntities() {
    return this.#simple.getEntities();
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
   *
   * @param {string} componentType - Component type to filter by
   * @returns {Array<Object>} Entities with component
   */
  getEntitiesWithComponent(componentType) {
    return this.getEntities().filter(entity =>
      this.hasComponent(entity.id, componentType)
    );
  }

  /**
   * Get entities at a specific location.
   *
   * @param {string} locationId - Location ID
   * @returns {Array<Object>} Entities at location
   */
  getEntitiesAtLocation(locationId) {
    return this.getEntities().filter(entity => {
      const locationData = this.getComponentData(entity.id, 'core:location');
      return locationData?.location_id === locationId;
    });
  }

  /**
   * Get all component types present on an entity.
   *
   * @param {string} entityId - Entity ID
   * @returns {Array<string>} Component type names
   */
  getEntityComponents(entityId) {
    const entity = this.getEntityInstance(entityId);
    if (!entity || !entity.components) {
      return [];
    }
    return Object.keys(entity.components);
  }

  /**
   * Check if any entities exist with given component.
   *
   * @param {string} componentType - Component type
   * @returns {boolean} True if at least one entity has component
   */
  hasAnyEntityWithComponent(componentType) {
    return this.getEntitiesWithComponent(componentType).length > 0;
  }

  /**
   * Count entities with specific component.
   *
   * @param {string} componentType - Component type
   * @returns {number} Count of entities
   */
  countEntitiesWithComponent(componentType) {
    return this.getEntitiesWithComponent(componentType).length;
  }

  // ============================================================================
  // SimpleEntityManager Passthrough (Test-Specific Methods)
  // ============================================================================

  /**
   * Add entity to the manager (test-only).
   *
   * @param {Object} entity - Entity to add
   */
  addEntity(entity) {
    this.#simple.addEntity(entity);
  }

  /**
   * Remove entity from the manager (test-only).
   *
   * @param {string} entityId - Entity ID to remove
   */
  removeEntity(entityId) {
    this.#simple.removeEntity(entityId);
  }

  /**
   * Clear all entities (test-only).
   */
  clear() {
    this.#simple.clear();
  }

  /**
   * Reset to initial state (test-only).
   *
   * @param {Array<Object>} entities - Entities to reset with
   */
  reset(entities = []) {
    this.#simple.reset(entities);
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

**File:** `tests/common/engine/entityManagerTestFactory.js`

```javascript
/**
 * @file Entity Manager Test Factory
 * @description Factory for creating test entity managers with correct API
 */

import TestEntityManagerAdapter from './TestEntityManagerAdapter.js';
import SimpleEntityManager from './SimpleEntityManager.js';

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
    const adapter = new TestEntityManagerAdapter({ logger });
    if (initialEntities.length > 0) {
      adapter.reset(initialEntities);
    }
    return adapter;
  } else {
    // Legacy mode - direct SimpleEntityManager
    logger.warn(
      'Using SimpleEntityManager directly is deprecated',
      {
        hint: 'Set useAdapter: true to use TestEntityManagerAdapter for production API compatibility'
      }
    );

    const manager = new SimpleEntityManager({ logger });
    if (initialEntities.length > 0) {
      initialEntities.forEach(e => manager.addEntity(e));
    }
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
import { createEntityManagerAdapter } from './entityManagerTestFactory.js';

export function createSystemLogicTestEnv(options = {}) {
  const {
    useAdapterEntityManager = true, // Default to adapter
    // ... other options
  } = options;

  // ... existing setup ...

  // Create entity manager with adapter by default
  const entityManager = useAdapterEntityManager
    ? createEntityManagerAdapter({ logger })
    : new SimpleEntityManager({ logger }); // Legacy fallback

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
import TestEntityManagerAdapter from '../../common/engine/TestEntityManagerAdapter.js';
import SimpleEntityManager from '../../common/engine/SimpleEntityManager.js';
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
      const adapter = new TestEntityManagerAdapter({ logger });
      const eventBus = { dispatch: jest.fn() };
      const production = new EntityManager({ logger, eventBus });

      // Required methods from IEntityManager
      const requiredMethods = [
        'getEntities',
        'getComponentData',
        'hasComponent',
        'getEntityInstance'
      ];

      for (const method of requiredMethods) {
        expect(typeof adapter[method]).toBe('function');
        expect(typeof production[method]).toBe('function');
        expect(adapter[method].length).toBe(production[method].length);
      }
    });

    it('TestEntityManagerAdapter should provide production extensions', () => {
      const adapter = new TestEntityManagerAdapter({ logger });

      // Production API extensions
      const extensions = [
        'getEntitiesWithComponent',
        'getEntitiesAtLocation',
        'getEntityComponents',
        'hasAnyEntityWithComponent',
        'countEntitiesWithComponent'
      ];

      for (const method of extensions) {
        expect(typeof adapter[method]).toBe('function');
      }
    });
  });

  describe('Behavioral Compatibility', () => {
    let adapter;

    beforeEach(() => {
      adapter = new TestEntityManagerAdapter({ logger });

      // Add test entities
      adapter.addEntity({
        id: 'actor-1',
        components: {
          'core:actor': {},
          'positioning:standing': {},
          'core:location': { location_id: 'room1' }
        }
      });

      adapter.addEntity({
        id: 'actor-2',
        components: {
          'core:actor': {},
          'positioning:sitting': { furniture_id: 'couch' },
          'core:location': { location_id: 'room1' }
        }
      });

      adapter.addEntity({
        id: 'item-1',
        components: {
          'items:portable': {},
          'core:location': { location_id: 'room2' }
        }
      });
    });

    describe('getEntities', () => {
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

    describe('getEntitiesAtLocation', () => {
      it('should filter entities by location', () => {
        const room1Entities = adapter.getEntitiesAtLocation('room1');

        expect(room1Entities.length).toBe(2);
        expect(room1Entities.map(e => e.id).sort()).toEqual(['actor-1', 'actor-2']);
      });

      it('should return empty array for empty location', () => {
        const result = adapter.getEntitiesAtLocation('empty-room');

        expect(result).toEqual([]);
      });
    });

    describe('getEntityComponents', () => {
      it('should return all component types for entity', () => {
        const components = adapter.getEntityComponents('actor-1');

        expect(components.sort()).toEqual([
          'core:actor',
          'core:location',
          'positioning:standing'
        ]);
      });

      it('should return empty array for nonexistent entity', () => {
        const components = adapter.getEntityComponents('nonexistent');

        expect(components).toEqual([]);
      });
    });

    describe('countEntitiesWithComponent', () => {
      it('should count entities with component', () => {
        const count = adapter.countEntitiesWithComponent('core:actor');

        expect(count).toBe(2);
      });

      it('should return 0 for nonexistent component', () => {
        const count = adapter.countEntitiesWithComponent('nonexistent:component');

        expect(count).toBe(0);
      });
    });
  });

  describe('SimpleEntityManager Passthrough', () => {
    it('should support test-specific methods', () => {
      const adapter = new TestEntityManagerAdapter({ logger });

      // Test-specific methods should work
      const entity = { id: 'test', components: {} };
      adapter.addEntity(entity);

      expect(adapter.getEntityInstance('test')).toEqual(entity);

      adapter.removeEntity('test');
      expect(adapter.getEntityInstance('test')).toBeNull();

      adapter.clear();
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
import { createEntityManagerAdapter } from '../../common/engine/entityManagerTestFactory.js';

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
import SimpleEntityManager from '../../common/engine/SimpleEntityManager.js';

// ⚠️ This approach is deprecated - use TestEntityManagerAdapter instead
const manager = new SimpleEntityManager({ logger });
```

## API Compatibility

### IEntityManager Interface (Required)

All entity managers implement these methods:

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `getEntities()` | None | `Array<Object>` | Get all entities |
| `getComponentData(entityId, componentType)` | `string, string` | `Object\|null` | Get component data |
| `hasComponent(entityId, componentType)` | `string, string` | `boolean` | Check component presence |
| `getEntityInstance(entityId)` | `string` | `Object\|null` | Get full entity |

### Production Extensions (Recommended)

TestEntityManagerAdapter provides additional methods matching production:

| Method | Description |
|--------|-------------|
| `getEntitiesWithComponent(componentType)` | Filter entities by component |
| `getEntitiesAtLocation(locationId)` | Filter entities by location |
| `getEntityComponents(entityId)` | Get all component types on entity |
| `hasAnyEntityWithComponent(componentType)` | Check if any entity has component |
| `countEntitiesWithComponent(componentType)` | Count entities with component |

### Test-Specific Methods

Methods for test setup and teardown:

| Method | Description |
|--------|-------------|
| `addEntity(entity)` | Add entity to manager |
| `removeEntity(entityId)` | Remove entity from manager |
| `clear()` | Remove all entities |
| `reset(entities)` | Replace all entities |

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

### Pattern 2: Filter Entities in Operators

```javascript
class MyOperator {
  execute(context) {
    // ✅ CORRECT - Works in both test and production
    const entities = this.#entityManager.getEntities();

    // ✅ CORRECT - Production API extension
    const actors = this.#entityManager.getEntitiesWithComponent('core:actor');

    // ❌ WRONG - Method doesn't exist
    const all = this.#entityManager.getAllEntities();
  }
}
```

### Pattern 3: Location-Based Queries

```javascript
it('should find entities at location', () => {
  const room1Entities = entityManager.getEntitiesAtLocation('room1');

  expect(room1Entities.length).toBeGreaterThan(0);
  expect(room1Entities[0]).toHaveProperty('id');
});
```

## Migration from SimpleEntityManager

### Step 1: Update Imports

**Before:**
```javascript
import SimpleEntityManager from '../../common/engine/SimpleEntityManager.js';

const manager = new SimpleEntityManager({ logger });
```

**After:**
```javascript
import { createEntityManagerAdapter } from '../../common/engine/entityManagerTestFactory.js';

const manager = createEntityManagerAdapter({ logger });
```

### Step 2: No Code Changes Needed

All `SimpleEntityManager` methods work through the adapter:

```javascript
// These all work the same
manager.addEntity(entity);
manager.getEntities();
manager.hasComponent(id, type);
manager.clear();
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

**Problem:** Calling non-existent method like `getAllEntities()`

**Solution:** Use correct IEntityManager method `getEntities()`

```javascript
// ❌ Wrong
const entities = manager.getAllEntities();

// ✅ Correct
const entities = manager.getEntities();
```

### API Drift Between Test and Production

**Problem:** Code works in tests but fails in production

**Solution:** Use `TestEntityManagerAdapter` to ensure API compatibility

```javascript
// This ensures test and production use same API
const manager = createEntityManagerAdapter({ logger });
```

### Performance Issues

**Problem:** Filtering entities multiple times

**Solution:** Use built-in filter methods

```javascript
// ⚠️ Inefficient
const actors = manager.getEntities()
  .filter(e => manager.hasComponent(e.id, 'core:actor'))
  .filter(e => {
    const loc = manager.getComponentData(e.id, 'core:location');
    return loc?.location_id === 'room1';
  });

// ✅ Efficient
const actorsInRoom = manager
  .getEntitiesWithComponent('core:actor')
  .filter(e => {
    const loc = manager.getComponentData(e.id, 'core:location');
    return loc?.location_id === 'room1';
  });

// ✅ Most efficient (if method exists)
const actorsInRoom = manager.getEntitiesAtLocation('room1')
  .filter(e => manager.hasComponent(e.id, 'core:actor'));
```

## References

- **Interface Definition:** `src/entities/interfaces/IEntityManager.js` (from ANAPRETEST-001)
- **Adapter Implementation:** `tests/common/engine/TestEntityManagerAdapter.js`
- **Factory:** `tests/common/engine/entityManagerTestFactory.js`
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
