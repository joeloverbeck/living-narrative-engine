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
