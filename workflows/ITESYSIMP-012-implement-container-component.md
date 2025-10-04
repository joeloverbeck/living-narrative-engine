# ITESYSIMP-012: Implement Container Component

**Phase:** 3 - Container System
**Priority:** High
**Estimated Effort:** 1.5 hours

## Goal

Create the `items:container` component to enable entities to store items internally (chests, bags, etc.).

## Context

Containers are distinct from inventories - they're objects that can hold items. A chest can contain items but isn't carried. This enables storage gameplay.

## Tasks

### 1. Create items:container Component

Create `data/mods/items/components/container.component.json`:

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "items:container",
  "description": "Entity can hold items internally. Separate from inventory - containers are objects that store items, not carried collections.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "contents": {
        "type": "array",
        "items": {
          "type": "string",
          "pattern": "^[a-zA-Z0-9_-]+$"
        },
        "uniqueItems": true,
        "description": "Array of entity IDs for items in container"
      },
      "capacity": {
        "type": "object",
        "properties": {
          "maxWeight": {
            "type": "number",
            "minimum": 0,
            "description": "Maximum weight in kilograms"
          },
          "maxItems": {
            "type": "integer",
            "minimum": 1,
            "description": "Maximum number of items"
          }
        },
        "required": ["maxWeight", "maxItems"]
      },
      "isOpen": {
        "type": "boolean",
        "description": "Whether container is currently open"
      },
      "requiresKey": {
        "type": "boolean",
        "description": "Whether container requires a key to open"
      },
      "keyItemId": {
        "type": "string",
        "description": "Entity ID of required key item (if requiresKey is true)"
      }
    },
    "required": ["contents", "capacity", "isOpen"],
    "additionalProperties": false
  }
}
```

### 2. Create items:openable Marker Component

Create `data/mods/items/components/openable.component.json`:

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "items:openable",
  "description": "Marker indicating entity can be opened/closed (doors, containers, etc.)",
  "dataSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

### 3. Update Mod Manifest

Add to `data/mods/items/mod-manifest.json`:

```json
{
  "components": [
    "item.component.json",
    "portable.component.json",
    "physical_properties.component.json",
    "inventory.component.json",
    "container.component.json",
    "openable.component.json"
  ]
}
```

### 4. Create Unit Tests

Create `tests/unit/mods/items/components/containerComponent.test.js`:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../../common/testBed.js';

describe('Items - Container Component', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  describe('items:container', () => {
    it('should validate valid container data', () => {
      const data = {
        contents: ['item-1', 'item-2'],
        capacity: { maxWeight: 100, maxItems: 20 },
        isOpen: false,
        requiresKey: true,
        keyItemId: 'brass-key-1'
      };

      const result = testBed.validateComponent('items:container', data);
      expect(result.valid).toBe(true);
    });

    it('should require isOpen field', () => {
      const data = {
        contents: [],
        capacity: { maxWeight: 100, maxItems: 20 }
      };

      const result = testBed.validateComponent('items:container', data);
      expect(result.valid).toBe(false);
    });

    it('should enforce unique contents', () => {
      const data = {
        contents: ['item-1', 'item-1'],
        capacity: { maxWeight: 100, maxItems: 20 },
        isOpen: true
      };

      const result = testBed.validateComponent('items:container', data);
      expect(result.valid).toBe(false);
    });

    it('should allow empty container', () => {
      const data = {
        contents: [],
        capacity: { maxWeight: 100, maxItems: 20 },
        isOpen: false
      };

      const result = testBed.validateComponent('items:container', data);
      expect(result.valid).toBe(true);
    });

    it('should validate capacity constraints', () => {
      const data = {
        contents: [],
        capacity: { maxWeight: -1, maxItems: 0 },
        isOpen: true
      };

      const result = testBed.validateComponent('items:container', data);
      expect(result.valid).toBe(false);
    });
  });

  describe('items:openable', () => {
    it('should be a valid marker component', () => {
      const component = testBed.loadComponent('items:openable');
      expect(component.dataSchema.type).toBe('object');
      expect(component.dataSchema.properties).toEqual({});
    });
  });
});
```

### 5. Create Container Entity Examples

Create `data/mods/items/entities/definitions/treasure_chest.entity.json`:

```json
{
  "$schema": "schema://living-narrative-engine/entity.schema.json",
  "id": "treasure-chest-1",
  "components": {
    "core:name": {
      "name": "Treasure Chest"
    },
    "core:description": {
      "shortDescription": "A sturdy wooden chest with brass fittings",
      "fullDescription": "A heavy oak chest bound with brass corners and a large lock. It looks like it could hold valuable items."
    },
    "items:item": {},
    "items:openable": {},
    "items:container": {
      "contents": ["gold-coin-1", "gold-coin-2"],
      "capacity": {
        "maxWeight": 50,
        "maxItems": 10
      },
      "isOpen": false,
      "requiresKey": true,
      "keyItemId": "brass-key-1"
    },
    "positioning:position": {
      "locationId": "tavern-cellar"
    }
  }
}
```

Create `data/mods/items/entities/definitions/brass_key.entity.json`:

```json
{
  "$schema": "schema://living-narrative-engine/entity.schema.json",
  "id": "brass-key-1",
  "components": {
    "core:name": {
      "name": "Brass Key"
    },
    "core:description": {
      "shortDescription": "A small brass key",
      "fullDescription": "A small brass key with an ornate handle. It looks like it might fit a chest lock."
    },
    "items:item": {},
    "items:portable": {},
    "items:physical_properties": {
      "weight": 0.1,
      "dimensions": {
        "length": 0.08,
        "width": 0.02,
        "height": 0.01
      }
    }
  }
}
```

### 6. Update Mod Manifest with Entities

Add to `data/mods/items/mod-manifest.json`:

```json
{
  "entities": [
    "letter_to_sheriff.entity.json",
    "revolver.entity.json",
    "gold_bar.entity.json",
    "treasure_chest.entity.json",
    "brass_key.entity.json"
  ]
}
```

## Validation

- [ ] Container component validates correctly
- [ ] Openable marker component exists
- [ ] Unique contents enforced
- [ ] Capacity constraints validated
- [ ] isOpen field required
- [ ] Optional key requirements work
- [ ] Treasure chest entity loads correctly
- [ ] Brass key entity loads correctly
- [ ] All unit tests pass
- [ ] Mod manifest updated

## Dependencies

- ITESYSIMP-001: Mod structure must exist
- ITESYSIMP-002: Marker components must exist
- ITESYSIMP-003: Physical properties component must exist

## Next Steps

After completion, proceed to:
- ITESYSIMP-013: Implement open_container action
