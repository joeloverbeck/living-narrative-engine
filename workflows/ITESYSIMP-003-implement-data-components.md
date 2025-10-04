# ITESYSIMP-003: Implement Data Components

**Phase:** 1 - Core Infrastructure
**Priority:** Critical
**Estimated Effort:** 2 hours

## Goal

Create the data-bearing components (`items:physical_properties` and `items:inventory`) that store item attributes and inventory state.

## Context

Data components store actual properties, unlike marker components. `items:physical_properties` holds physical attributes, while `items:inventory` manages the collection of items an entity carries.

## Tasks

### 1. Create items:physical_properties Component

Create `data/mods/items/components/physical_properties.component.json`:

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "items:physical_properties",
  "description": "Physical properties of an item including weight and dimensions",
  "dataSchema": {
    "type": "object",
    "properties": {
      "weight": {
        "type": "number",
        "minimum": 0,
        "description": "Weight in kilograms"
      },
      "dimensions": {
        "type": "object",
        "properties": {
          "length": { "type": "number", "minimum": 0 },
          "width": { "type": "number", "minimum": 0 },
          "height": { "type": "number", "minimum": 0 }
        },
        "required": ["length", "width", "height"]
      }
    },
    "required": ["weight", "dimensions"],
    "additionalProperties": false
  }
}
```

### 2. Create items:inventory Component

Create `data/mods/items/components/inventory.component.json`:

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "items:inventory",
  "description": "Collection of items an entity is carrying",
  "dataSchema": {
    "type": "object",
    "properties": {
      "items": {
        "type": "array",
        "items": {
          "type": "string",
          "pattern": "^[a-zA-Z0-9_-]+$"
        },
        "uniqueItems": true,
        "description": "Array of entity IDs for items in inventory"
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
      }
    },
    "required": ["items", "capacity"],
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
    "inventory.component.json"
  ]
}
```

### 4. Create Unit Tests

Create `tests/unit/mods/items/components/dataComponents.test.js`:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../../common/testBed.js';

describe('Items - Data Components', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  describe('items:physical_properties', () => {
    it('should validate valid physical properties', () => {
      const data = {
        weight: 0.5,
        dimensions: { length: 10, width: 5, height: 2 }
      };
      const result = testBed.validateComponent('items:physical_properties', data);
      expect(result.valid).toBe(true);
    });

    it('should reject negative weight', () => {
      const data = {
        weight: -1,
        dimensions: { length: 10, width: 5, height: 2 }
      };
      const result = testBed.validateComponent('items:physical_properties', data);
      expect(result.valid).toBe(false);
    });

    it('should require all dimension properties', () => {
      const data = {
        weight: 0.5,
        dimensions: { length: 10, width: 5 }
      };
      const result = testBed.validateComponent('items:physical_properties', data);
      expect(result.valid).toBe(false);
    });
  });

  describe('items:inventory', () => {
    it('should validate valid inventory data', () => {
      const data = {
        items: ['item-1', 'item-2'],
        capacity: { maxWeight: 50, maxItems: 10 }
      };
      const result = testBed.validateComponent('items:inventory', data);
      expect(result.valid).toBe(true);
    });

    it('should enforce unique item IDs', () => {
      const data = {
        items: ['item-1', 'item-1'],
        capacity: { maxWeight: 50, maxItems: 10 }
      };
      const result = testBed.validateComponent('items:inventory', data);
      expect(result.valid).toBe(false);
    });

    it('should require capacity properties', () => {
      const data = {
        items: [],
        capacity: { maxWeight: 50 }
      };
      const result = testBed.validateComponent('items:inventory', data);
      expect(result.valid).toBe(false);
    });

    it('should reject invalid entity ID patterns', () => {
      const data = {
        items: ['invalid@id'],
        capacity: { maxWeight: 50, maxItems: 10 }
      };
      const result = testBed.validateComponent('items:inventory', data);
      expect(result.valid).toBe(false);
    });
  });
});
```

## Validation

- [ ] Physical properties schema validates correctly
- [ ] Inventory schema validates correctly
- [ ] Weight/dimension validation enforces non-negative values
- [ ] Inventory enforces unique item IDs
- [ ] Capacity constraints properly defined
- [ ] All unit tests pass
- [ ] Mod manifest updated

## Dependencies

- ITESYSIMP-001: Mod structure must exist

## Next Steps

After completion, proceed to:
- ITESYSIMP-004: Implement operation handlers
