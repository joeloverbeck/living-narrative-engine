# ITESYSIMP-012: Implement Container Component

**Phase:** 3 - Container System
**Priority:** High
**Estimated Effort:** 1.5 hours

**Status:** ✅ CORRECTED - Workflow validated and updated against current codebase

## Goal

Create the `items:container` component to enable entities to store items internally (chests, bags, etc.).

## Context

Containers are distinct from inventories - they're objects that can hold items. A chest can contain items but isn't carried. This enables storage gameplay.

## Corrections Applied

This workflow has been validated against the actual codebase. Key corrections:

1. **Component naming**: Changed `physical_properties` → `weight`
2. **Manifest structure**: Updated from flat arrays to nested `content` object
3. **Entity schema**: Changed to `entity-definition.schema.json`
4. **Entity IDs**: Updated to namespaced format (`items:treasure_chest`)
5. **Component properties**: Updated `core:name` and `core:description` to use `text` property
6. **Weight component**: Removed `dimensions` (only has `weight` property)
7. **Test utilities**: Updated to use `TestBedClass` and `validateAgainstSchema`
8. **Test organization**: Split into `dataComponents.test.js` and `markerComponents.test.js`
9. **Entity definitions**: Removed instance-only properties like `positioning:position`

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

Add to the `content.components` array in `data/mods/items/mod-manifest.json`:

```json
{
  "content": {
    "components": [
      "inventory.component.json",
      "item.component.json",
      "portable.component.json",
      "weight.component.json",
      "container.component.json",
      "openable.component.json"
    ]
  }
}
```

**Note**: The manifest uses nested structure with `content` object, not flat arrays. Component `weight.component.json` exists (not `physical_properties.component.json`).

### 4. Create Unit Tests

Add to existing `tests/unit/mods/items/components/dataComponents.test.js`:

```javascript
describe('items:container', () => {
  it('should validate valid container data', () => {
    const data = {
      contents: ['item-1', 'item-2'],
      capacity: { maxWeight: 100, maxItems: 20 },
      isOpen: false,
      requiresKey: true,
      keyItemId: 'brass-key-1'
    };
    const result = testBed.validateAgainstSchema(data, 'items:container');
    expect(result.isValid).toBe(true);
  });

  it('should require isOpen field', () => {
    const data = {
      contents: [],
      capacity: { maxWeight: 100, maxItems: 20 }
    };
    const result = testBed.validateAgainstSchema(data, 'items:container');
    expect(result.isValid).toBe(false);
  });

  it('should enforce unique contents', () => {
    const data = {
      contents: ['item-1', 'item-1'],
      capacity: { maxWeight: 100, maxItems: 20 },
      isOpen: true
    };
    const result = testBed.validateAgainstSchema(data, 'items:container');
    expect(result.isValid).toBe(false);
  });

  it('should allow empty container', () => {
    const data = {
      contents: [],
      capacity: { maxWeight: 100, maxItems: 20 },
      isOpen: false
    };
    const result = testBed.validateAgainstSchema(data, 'items:container');
    expect(result.isValid).toBe(true);
  });

  it('should validate capacity constraints', () => {
    const data = {
      contents: [],
      capacity: { maxWeight: -1, maxItems: 0 },
      isOpen: true
    };
    const result = testBed.validateAgainstSchema(data, 'items:container');
    expect(result.isValid).toBe(false);
  });

  it('should reject additional properties', () => {
    const data = {
      contents: [],
      capacity: { maxWeight: 100, maxItems: 20 },
      isOpen: true,
      extraProperty: 'not allowed'
    };
    const result = testBed.validateAgainstSchema(data, 'items:container');
    expect(result.isValid).toBe(false);
  });
});
```

Add to existing `tests/unit/mods/items/components/markerComponents.test.js`:

```javascript
describe('items:openable', () => {
  it('should be a valid marker component', () => {
    const data = {};
    const result = testBed.validateAgainstSchema(data, 'items:openable');
    expect(result.isValid).toBe(true);
  });

  it('should reject additional properties', () => {
    const data = { extraProperty: 'not allowed' };
    const result = testBed.validateAgainstSchema(data, 'items:openable');
    expect(result.isValid).toBe(false);
  });
});
```

**Note**: Tests are organized into separate files - `dataComponents.test.js` for data components and `markerComponents.test.js` for marker components. Use `TestBedClass` from `tests/common/entities/testBed.js` and `validateAgainstSchema(data, schemaId)` method (returns `{isValid, errors}`).

### 5. Create Container Entity Examples

Create `data/mods/items/entities/definitions/treasure_chest.entity.json`:

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "items:treasure_chest",
  "description": "A sturdy wooden chest with brass fittings",
  "components": {
    "core:name": {
      "text": "Treasure Chest"
    },
    "core:description": {
      "text": "A heavy oak chest bound with brass corners and a large lock. It looks like it could hold valuable items."
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
    }
  }
}
```

Create `data/mods/items/entities/definitions/brass_key.entity.json`:

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "items:brass_key",
  "description": "A small brass key",
  "components": {
    "core:name": {
      "text": "Brass Key"
    },
    "core:description": {
      "text": "A small brass key with an ornate handle. It looks like it might fit a chest lock."
    },
    "items:item": {},
    "items:portable": {},
    "items:weight": {
      "weight": 0.1
    }
  }
}
```

**Note**:
- Entity definition schema is `entity-definition.schema.json` (not `entity.schema.json`)
- Entity IDs use namespaced format: `items:treasure_chest` (not `treasure-chest-1`)
- Component data uses `text` property (not `name`, `shortDescription`, `fullDescription`)
- Use `items:weight` component (not `items:physical_properties`)
- `items:weight` only has `weight` property (no `dimensions`)
- Do not include `positioning:position` in entity definitions (instances only)

### 6. Update Mod Manifest with Entities

Update the `content.entities.definitions` array in `data/mods/items/mod-manifest.json`:

```json
{
  "content": {
    "entities": {
      "definitions": [
        "gold_bar.entity.json",
        "letter_to_sheriff.entity.json",
        "revolver.entity.json",
        "treasure_chest.entity.json",
        "brass_key.entity.json"
      ],
      "instances": []
    }
  }
}
```

**Note**: Entity manifest structure is nested: `content.entities.definitions` (array), not flat `entities` array. Existing entities: `gold_bar.entity.json`, `letter_to_sheriff.entity.json`, `revolver.entity.json`.

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
- ITESYSIMP-002: Marker components (items:item, items:portable) must exist
- items:weight component must exist (not physical_properties)

## Next Steps

After completion, proceed to:
- ITESYSIMP-013: Implement open_container action
