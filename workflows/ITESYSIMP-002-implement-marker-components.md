# ITESYSIMP-002: Implement Marker Components

**Phase:** 1 - Core Infrastructure
**Priority:** Critical
**Estimated Effort:** 1 hour

## Goal

Create the foundational marker components (`items:item` and `items:portable`) that enable the modular item system architecture.

## Context

Unlike monolithic "item" objects, this system uses marker components that entities can combine. The `items:item` marker identifies something as an item, while `items:portable` indicates it can be carried in inventory.

## Tasks

### 1. Create items:item Component

Create `data/mods/items/components/item.component.json`:

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "items:item",
  "description": "Marker component identifying an entity as an item. Entities with this component are recognized by item-related systems.",
  "dataSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

### 2. Create items:portable Component

Create `data/mods/items/components/portable.component.json`:

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "items:portable",
  "description": "Marker component indicating an item can be carried in inventory. Items with this component can be picked up, given, dropped, etc.",
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
    "portable.component.json"
  ]
}
```

### 4. Create Unit Tests

Create `tests/unit/mods/items/components/markerComponents.test.js`:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../../common/testBed.js';

describe('Items - Marker Components', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  describe('items:item component', () => {
    it('should be a valid marker component with no data', () => {
      const component = testBed.loadComponent('items:item');
      expect(component.dataSchema.type).toBe('object');
      expect(component.dataSchema.properties).toEqual({});
    });

    it('should reject additional properties', () => {
      const component = testBed.loadComponent('items:item');
      expect(component.dataSchema.additionalProperties).toBe(false);
    });
  });

  describe('items:portable component', () => {
    it('should be a valid marker component with no data', () => {
      const component = testBed.loadComponent('items:portable');
      expect(component.dataSchema.type).toBe('object');
      expect(component.dataSchema.properties).toEqual({});
    });

    it('should reject additional properties', () => {
      const component = testBed.loadComponent('items:portable');
      expect(component.dataSchema.additionalProperties).toBe(false);
    });
  });
});
```

## Validation

- [ ] Both components have valid JSON schema structure
- [ ] Components validate against component.schema.json
- [ ] Marker components have empty dataSchema (no properties)
- [ ] additionalProperties set to false
- [ ] Mod manifest updated with component references
- [ ] Unit tests pass

## Dependencies

- ITESYSIMP-001: Mod structure must exist

## Next Steps

After completion, proceed to:
- ITESYSIMP-003: Implement data components (physical_properties, inventory)
