# ITESYSIMP-006: Implement Scope Definitions

**Phase:** 1 - Core Infrastructure
**Priority:** Critical
**Estimated Effort:** 1.5 hours

## Goal

Create scope definitions for discovering inventory items and nearby actors with inventory capacity.

## Context

Scopes enable action discovery by querying entities. The `actor_inventory_items` scope finds items in the actor's inventory, while `close_actors_with_inventory` finds nearby actors who can receive items.

## Tasks

### 1. Create actor_inventory_items Scope

Create `data/mods/items/scopes/actor_inventory_items.scope`:

```
actor.items:inventory.items[]
```

**Description:** Returns all item entity IDs from the actor's inventory component.

### 2. Create close_actors_with_inventory Scope

Create `data/mods/items/scopes/close_actors_with_inventory.scope`:

```
positioning:close_actors[{"has": [{"var": "entity"}, "items:inventory"]}]
```

**Description:** Returns nearby actors that have an inventory component, using the positioning mod's close_actors scope and filtering for the inventory component.

### 3. Update Mod Manifest

Add to `data/mods/items/mod-manifest.json`:

```json
{
  "scopes": [
    "actor_inventory_items.scope",
    "close_actors_with_inventory.scope"
  ]
}
```

### 4. Create Unit Tests

Create `tests/unit/mods/items/scopes/inventoryScopes.test.js`:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../../common/testBed.js';

describe('Items - Inventory Scopes', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  describe('actor_inventory_items scope', () => {
    it('should return all items from actor inventory', () => {
      const actor = testBed.createEntity('actor-1', {
        'items:inventory': {
          items: ['item-1', 'item-2', 'item-3'],
          capacity: { maxWeight: 50, maxItems: 10 }
        }
      });

      const result = testBed.evaluateScope('items:actor_inventory_items', { actor });
      expect(result).toEqual(['item-1', 'item-2', 'item-3']);
    });

    it('should return empty array when inventory is empty', () => {
      const actor = testBed.createEntity('actor-1', {
        'items:inventory': {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 }
        }
      });

      const result = testBed.evaluateScope('items:actor_inventory_items', { actor });
      expect(result).toEqual([]);
    });

    it('should handle missing inventory component gracefully', () => {
      const actor = testBed.createEntity('actor-1', {});

      const result = testBed.evaluateScope('items:actor_inventory_items', { actor });
      expect(result).toEqual([]);
    });
  });

  describe('close_actors_with_inventory scope', () => {
    it('should return only nearby actors with inventory', () => {
      const actor = testBed.createEntity('actor-1');
      const actor2 = testBed.createEntity('actor-2', {
        'items:inventory': {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 }
        }
      });
      const actor3 = testBed.createEntity('actor-3', {
        'items:inventory': {
          items: [],
          capacity: { maxWeight: 30, maxItems: 5 }
        }
      });
      const actor4 = testBed.createEntity('actor-4'); // No inventory

      testBed.setActorPosition(actor, 'loc-1');
      testBed.setActorPosition(actor2, 'loc-1');
      testBed.setActorPosition(actor3, 'loc-1');
      testBed.setActorPosition(actor4, 'loc-1');

      const result = testBed.evaluateScope('items:close_actors_with_inventory', { actor });
      expect(result).toContain(actor2);
      expect(result).toContain(actor3);
      expect(result).not.toContain(actor4);
    });

    it('should not include actors in different locations', () => {
      const actor = testBed.createEntity('actor-1');
      const closeActor = testBed.createEntity('actor-2', {
        'items:inventory': { items: [], capacity: { maxWeight: 50, maxItems: 10 } }
      });
      const farActor = testBed.createEntity('actor-3', {
        'items:inventory': { items: [], capacity: { maxWeight: 50, maxItems: 10 } }
      });

      testBed.setActorPosition(actor, 'loc-1');
      testBed.setActorPosition(closeActor, 'loc-1');
      testBed.setActorPosition(farActor, 'loc-2');

      const result = testBed.evaluateScope('items:close_actors_with_inventory', { actor });
      expect(result).toContain(closeActor);
      expect(result).not.toContain(farActor);
    });
  });
});
```

### 5. Create Integration Tests

Create `tests/integration/mods/items/scopeIntegration.test.js`:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('Items - Scope Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  it('should work together for action discovery', () => {
    const actor = testBed.createEntity('actor-1', {
      'items:inventory': {
        items: ['letter-1', 'gun-1'],
        capacity: { maxWeight: 50, maxItems: 10 }
      },
      'positioning:position': { locationId: 'loc-1' }
    });

    const recipient = testBed.createEntity('recipient-1', {
      'items:inventory': {
        items: [],
        capacity: { maxWeight: 30, maxItems: 5 }
      },
      'positioning:position': { locationId: 'loc-1' }
    });

    // Scopes should work together for multi-target discovery
    const items = testBed.evaluateScope('items:actor_inventory_items', { actor });
    const targets = testBed.evaluateScope('items:close_actors_with_inventory', { actor });

    expect(items).toHaveLength(2);
    expect(targets).toContain(recipient);

    // This enables give_item to generate: 2 items × 1 recipient = 2 actions
    const combinations = items.length * targets.length;
    expect(combinations).toBe(2);
  });
});
```

### 6. Validate Scope Syntax

Run scope linting:

```bash
npm run scope:lint
```

Ensure both scopes pass validation.

## Validation

- [ ] Both scopes follow correct Scope DSL syntax
- [ ] actor_inventory_items correctly uses `[]` array iteration
- [ ] close_actors_with_inventory properly filters with JSON Logic
- [ ] Scopes integrate with positioning mod's close_actors
- [ ] Unit tests cover normal and edge cases
- [ ] Integration tests verify scopes work together
- [ ] Scope lint validation passes
- [ ] Mod manifest updated

## Dependencies

- ITESYSIMP-001: Mod structure must exist
- ITESYSIMP-003: Inventory component must exist
- Positioning mod must be loaded (dependency in manifest)

## Next Steps

After completion, proceed to:
- ITESYSIMP-007: Create test entities
