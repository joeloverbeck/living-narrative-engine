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

- Has both `entities` **getter** (for compatibility) AND `getEntities()` **method** (for convenience)
- `getEntities()` method returns `Array<Object>`
- Does NOT extend `IEntityManager` (standalone implementation)
- Simplified constructor taking entities array directly

**Impact:** Code written for production may not work in tests and vice versa if not careful about which pattern is used.

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
const closeness = entityManager.getComponentData(
  'actor-1',
  'positioning:closeness'
);
// Returns: { partners: ['actor-2'] } or undefined

// Test SimpleEntityManager returns null instead of undefined
const closenessTest = testEntityManager.getComponentData(
  'actor-1',
  'positioning:closeness'
);
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

### `getEntitiesInLocation(locationId): Set<string>`

Retrieves all entity instance IDs present in a specific location.

**Parameters:**

- `locationId` (string): The unique ID of the location entity

**Returns:** `Set<string>` - Set of entity instance IDs in the location

**Example:**

```javascript
const entitiesInRoom = entityManager.getEntitiesInLocation('room-1');
// Returns: Set(['actor-1', 'item-2'])
```

### `getAllComponentTypesForEntity(entityId): string[]`

Returns a list of all component type IDs attached to a given entity.

**Parameters:**

- `entityId` (string): The ID of the entity

**Returns:** `string[]` - Array of component ID strings

**Example:**

```javascript
const components = entityManager.getAllComponentTypesForEntity('actor-1');
// Returns: ['core:actor', 'core:position', 'positioning:sitting']
```

### `addComponent(instanceId, componentTypeId, componentData): boolean`

Dynamically adds a component data object to an existing entity.

**Parameters:**

- `instanceId` (string): The ID of the entity to modify
- `componentTypeId` (string): The component type to add
- `componentData` (object): The component's data

**Returns:** `boolean` - True if the component was successfully added

**Example:**

```javascript
const success = entityManager.addComponent('actor-1', 'positioning:sitting', {
  chairId: 'chair-1',
});
// Returns: true or false
```

### `removeComponent(instanceId, componentTypeId): boolean`

Removes a component data object from an existing entity.

**Parameters:**

- `instanceId` (string): The ID of the entity to modify
- `componentTypeId` (string): The component type to remove

**Returns:** `boolean` - True if the component was found and removed

**Example:**

```javascript
const removed = entityManager.removeComponent('actor-1', 'positioning:sitting');
// Returns: true or false
```

## Test vs Production Compatibility

### SimpleEntityManager Test Patterns

```javascript
// Test pattern - SimpleEntityManager
const testManager = new SimpleEntityManager([
  { id: 'actor-1', components: { 'core:actor': {} } },
]);

// ✅ Works in tests - method returns array
const entities = testManager.getEntities();
entities.forEach((e) => console.log(e.id));

// ✅ Now also works - getter for compatibility
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
  return entities.filter((e) =>
    runtimeCtx.entityManager.hasComponent(e.id, 'positioning:sitting')
  );
};

// ✅ Better - Iterate directly without array conversion
const resolver = (runtimeCtx) => {
  const result = [];
  for (const entity of runtimeCtx.entityManager.entities) {
    if (
      runtimeCtx.entityManager.hasComponent(entity.id, 'positioning:sitting')
    ) {
      result.push(entity);
    }
  }
  return result;
};
```

### Updating Test Code

When writing tests, you can use either pattern:

```javascript
// ✅ Option 1: Use getEntities() for convenience in tests
const entities = testManager.getEntities();
expect(entities).toHaveLength(2);

// ✅ Option 2: Use entities getter for production-like patterns
const entities = Array.from(testManager.entities);
expect(entities).toHaveLength(2);

// ✅ Option 3: Use for...of (most production-like)
const ids = [];
for (const entity of testManager.entities) {
  ids.push(entity.id);
}
expect(ids).toEqual(['actor-1', 'actor-2']);
```

## Key Takeaways

1. **Production uses `entities` getter** returning `IterableIterator<Entity>`, NOT a `getEntities()` method
2. **Test SimpleEntityManager now has both** `entities` getter AND `getEntities()` method for flexibility
3. **Return types differ:** Production returns `undefined` for missing entities/components, test may return `null`
4. **Always use `Array.from()` or `for...of`** to work with the entities iterator in production
5. **IEntityManager already exists** at `src/interfaces/IEntityManager.js` with comprehensive interface definition
6. **SimpleEntityManager is compatible** but provides extra convenience methods for testing

## Interface Validation

### Runtime Validation

You can validate entity manager implementations at runtime:

```javascript
/**
 * Validates that an object implements the core IEntityManager interface.
 * @param {any} manager - The object to validate
 * @param {string} context - Context for error messages
 * @throws {Error} If validation fails
 */
function validateEntityManagerCompliance(manager, context = 'EntityManager') {
  const requiredMembers = [
    'entities',
    'getEntityInstance',
    'getComponentData',
    'hasComponent',
    'getEntitiesWithComponent',
    'getEntityIds',
  ];

  for (const member of requiredMembers) {
    if (!(member in manager)) {
      throw new Error(
        `${context} missing required interface member: ${member}`
      );
    }
  }

  // Validate entities is a getter, not a method
  if (typeof manager.entities === 'function' && manager.entities.length > 0) {
    throw new Error(`${context}.entities should be a getter, not a method`);
  }
}
```

### Test-Time Validation

Use the interface compliance tests to verify implementations:

```javascript
import { describe, it, expect } from '@jest/globals';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';

describe('MyEntityManager', () => {
  it('should implement IEntityManager interface', () => {
    const manager = new SimpleEntityManager([]);

    // Verify getter exists
    expect('entities' in manager).toBe(true);

    // Verify core methods exist
    expect(typeof manager.getEntityInstance).toBe('function');
    expect(typeof manager.getComponentData).toBe('function');
    expect(typeof manager.hasComponent).toBe('function');
  });
});
```

## Common Pitfalls

### Pitfall 1: Calling entities as a method

```javascript
// ❌ WRONG - entities is a getter, not a method
const entities = entityManager.entities();
// TypeError: entityManager.entities is not a function

// ✅ CORRECT - access as property
const entities = Array.from(entityManager.entities);
```

### Pitfall 2: Using getEntities() in production code

```javascript
// ❌ WRONG - getEntities doesn't exist in production
const entities = this.#entityManager.getEntities();
// undefined in production, works in tests

// ✅ CORRECT - use entities getter
const entities = Array.from(this.#entityManager.entities);
```

### Pitfall 3: Expecting null instead of undefined

```javascript
// ❌ WRONG - production returns undefined
if (entityManager.getComponentData('actor-1', 'core:actor') === null) {
  // This won't work in production
}

// ✅ CORRECT - check for falsy or undefined
if (!entityManager.getComponentData('actor-1', 'core:actor')) {
  // Works in both test and production
}

// ✅ ALSO CORRECT - explicit undefined check
if (entityManager.getComponentData('actor-1', 'core:actor') === undefined) {
  // More explicit, works in production
}
```

### Pitfall 4: Modifying entities during iteration

```javascript
// ❌ WRONG - modifying collection during iteration
for (const entity of entityManager.entities) {
  entityManager.removeComponent(entity.id, 'core:actor'); // May cause issues
}

// ✅ CORRECT - collect IDs first, then modify
const entityIds = Array.from(entityManager.entities).map((e) => e.id);
for (const id of entityIds) {
  entityManager.removeComponent(id, 'core:actor');
}
```

## References

- **Interface Definition:** `src/interfaces/IEntityManager.js` (EXISTING)
- **Production Implementation:** `src/entities/entityManager.js`
- **Test Implementation:** `tests/common/entities/simpleEntityManager.js`
- **Compliance Tests:** `tests/unit/entities/entityManagerInterface.test.js`
- **Related Report:** `reports/anatomy-prerequisite-test-fixes-2025-01.md` (lines 113-134)
- **Related Documentation:** `docs/testing/mod-testing-guide.md` - Testing patterns and best practices

## Version History

- **2025-01**: Initial documentation created
  - Documented production vs test implementation differences
  - Added `entities` getter to SimpleEntityManager for compatibility
  - Created interface compliance tests
  - Documented migration patterns and common pitfalls
