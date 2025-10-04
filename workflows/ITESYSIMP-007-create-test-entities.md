# ITESYSIMP-007: Create Test Item Entities

**Phase:** 1 - Core Infrastructure
**Priority:** High
**Estimated Effort:** 1 hour

## Goal

Create example item entities for testing and demonstration of the items system.

## Context

Test entities provide concrete examples of how to combine components to create functional items. These will be used in integration tests and as templates for content creators.

## Tasks

### 1. Create Letter Entity

Create `data/mods/items/entities/definitions/letter_to_sheriff.entity.json`:

```json
{
  "$schema": "schema://living-narrative-engine/entity.schema.json",
  "id": "letter-to-sheriff-1",
  "components": {
    "core:name": {
      "name": "Letter to the Sheriff"
    },
    "core:description": {
      "shortDescription": "A sealed letter addressed to the sheriff",
      "fullDescription": "A crisp white envelope sealed with red wax, bearing the sheriff's name in elegant script."
    },
    "items:item": {},
    "items:portable": {},
    "items:physical_properties": {
      "weight": 0.05,
      "dimensions": {
        "length": 0.22,
        "width": 0.11,
        "height": 0.002
      }
    }
  }
}
```

### 2. Create Gun Entity

Create `data/mods/items/entities/definitions/revolver.entity.json`:

```json
{
  "$schema": "schema://living-narrative-engine/entity.schema.json",
  "id": "revolver-1",
  "components": {
    "core:name": {
      "name": "Six-Shooter Revolver"
    },
    "core:description": {
      "shortDescription": "A well-worn six-shooter",
      "fullDescription": "A reliable revolver with a weathered wooden grip and six chambers. The metal shows signs of frequent use."
    },
    "items:item": {},
    "items:portable": {},
    "items:physical_properties": {
      "weight": 1.2,
      "dimensions": {
        "length": 0.28,
        "width": 0.13,
        "height": 0.04
      }
    }
  }
}
```

### 3. Create Heavy Item for Capacity Testing

Create `data/mods/items/entities/definitions/gold_bar.entity.json`:

```json
{
  "$schema": "schema://living-narrative-engine/entity.schema.json",
  "id": "gold-bar-1",
  "components": {
    "core:name": {
      "name": "Gold Bar"
    },
    "core:description": {
      "shortDescription": "A heavy gold bar",
      "fullDescription": "A solid gold bar stamped with the mint's seal. Its weight makes it difficult to carry for long."
    },
    "items:item": {},
    "items:portable": {},
    "items:physical_properties": {
      "weight": 12.4,
      "dimensions": {
        "length": 0.25,
        "width": 0.08,
        "height": 0.02
      }
    }
  }
}
```

### 4. Update Mod Manifest

Add to `data/mods/items/mod-manifest.json`:

```json
{
  "entities": [
    "letter_to_sheriff.entity.json",
    "revolver.entity.json",
    "gold_bar.entity.json"
  ]
}
```

### 5. Create Entity Loading Tests

Create `tests/integration/mods/items/entityLoading.test.js`:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('Items - Entity Loading', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  it('should load letter entity with all required components', () => {
    const entity = testBed.loadEntity('letter-to-sheriff-1');

    expect(entity.hasComponent('core:name')).toBe(true);
    expect(entity.hasComponent('core:description')).toBe(true);
    expect(entity.hasComponent('items:item')).toBe(true);
    expect(entity.hasComponent('items:portable')).toBe(true);
    expect(entity.hasComponent('items:physical_properties')).toBe(true);

    const props = entity.getComponent('items:physical_properties');
    expect(props.weight).toBe(0.05);
  });

  it('should load revolver entity with correct properties', () => {
    const entity = testBed.loadEntity('revolver-1');

    const props = entity.getComponent('items:physical_properties');
    expect(props.weight).toBe(1.2);
    expect(props.dimensions.length).toBe(0.28);
  });

  it('should load gold bar as heavy item', () => {
    const entity = testBed.loadEntity('gold-bar-1');

    const props = entity.getComponent('items:physical_properties');
    expect(props.weight).toBe(12.4);
    expect(props.weight).toBeGreaterThan(10); // Heavy item threshold
  });

  it('should validate all entities against schemas', () => {
    const entities = [
      'letter-to-sheriff-1',
      'revolver-1',
      'gold-bar-1'
    ];

    entities.forEach(id => {
      const entity = testBed.loadEntity(id);
      const validation = testBed.validateEntity(entity);
      expect(validation.valid).toBe(true);
    });
  });
});
```

### 6. Create Usage Examples

Create `tests/integration/mods/items/entityUsageExamples.test.js`:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('Items - Entity Usage Examples', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  it('should demonstrate giving a light item', () => {
    const actor = testBed.createActorWithInventory(['letter-to-sheriff-1']);
    const recipient = testBed.createActorNearby(actor);

    const actions = testBed.discoverActions(actor);
    const giveAction = actions.find(a =>
      a.actionId === 'items:give_item' &&
      a.secondaryTargetId === 'letter-to-sheriff-1'
    );

    expect(giveAction).toBeDefined();
    expect(giveAction.format).toContain('Letter to the Sheriff');
  });

  it('should demonstrate capacity limits with heavy item', () => {
    const actor = testBed.createActorWithInventory(['gold-bar-1']);
    const recipient = testBed.createActorWithInventory([], {
      maxWeight: 5, // Too light for gold bar
      maxItems: 10
    });

    testBed.setActorPosition(actor, 'loc-1');
    testBed.setActorPosition(recipient, 'loc-1');

    const result = testBed.attemptAction('items:give_item', {
      actorId: actor,
      targetId: recipient,
      secondaryTargetId: 'gold-bar-1'
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('max_weight_exceeded');
  });

  it('should demonstrate multiple items in inventory', () => {
    const actor = testBed.createActorWithInventory([
      'letter-to-sheriff-1',
      'revolver-1',
      'gold-bar-1'
    ]);

    const inventory = testBed.getComponent(actor, 'items:inventory');
    expect(inventory.items).toHaveLength(3);

    const totalWeight = testBed.calculateInventoryWeight(actor);
    expect(totalWeight).toBe(13.65); // 0.05 + 1.2 + 12.4
  });
});
```

## Validation

- [ ] All entities have valid JSON structure
- [ ] All entities validate against entity schema
- [ ] Required components present (name, description, item, portable, physical_properties)
- [ ] Physical properties have realistic values
- [ ] Entities demonstrate different weight classes (light, medium, heavy)
- [ ] Entity loading tests pass
- [ ] Usage example tests pass
- [ ] Mod manifest updated

## Dependencies

- ITESYSIMP-001: Mod structure must exist
- ITESYSIMP-002: Marker components must exist
- ITESYSIMP-003: Physical properties component must exist

## Next Steps

After completion, proceed to:
- ITESYSIMP-008: Write comprehensive test suite for Phase 1
