# CLOREMBLO-006: Update Belt Entities with Blocking Component

**Category**: Clothing System Enhancement
**Priority**: High
**Estimated Effort**: 2-3 hours
**Phase**: 5 - Content Updates

---

## Overview

Update all belt entity definitions in the clothing mod to include the `clothing:blocks_removal` component. This makes belts realistically block pants removal, demonstrating the blocking system with real content.

---

## Background

Belts are the primary use case for the blocking system. In real life:
- Belts secure pants at the waist
- Pants cannot be fully removed while belt is fastened
- Belt must be removed (or loosened) before pants removal

This ticket updates existing belt entities to enforce this realistic constraint using the newly implemented blocking system.

---

## Requirements

### Component Addition

Add `clothing:blocks_removal` component to all belt entities with:
- **Blocked Slot**: `legs`
- **Blocked Layers**: `["base", "outer"]` (covers both regular pants and outer layer pants like chaps)
- **Block Type**: `must_remove_first`
- **Reason**: `"Belt secures pants at waist"`

### Affected Entities

**Directory**: `data/mods/clothing/entities/`

**Belt Entity Files** (update all that exist):
- `black_calfskin_belt.entity.json`
- `brown_leather_belt.entity.json`
- Any other belt entities found in directory

---

## Implementation Tasks

### 1. Identify Belt Entities

Search for all belt entity files in the clothing mod:

```bash
find data/mods/clothing/entities/ -name "*belt*.entity.json"
```

Expected output: List of belt entity files.

### 2. Read Existing Belt Entities

For each belt entity file, read the current structure to understand:
- Existing components
- File format and indentation
- Any special properties

### 3. Add Blocking Component

For each belt entity, add the `clothing:blocks_removal` component to the `components` section:

```json
{
  "clothing:blocks_removal": {
    "blockedSlots": [
      {
        "slot": "legs",
        "layers": ["base", "outer"],
        "blockType": "must_remove_first",
        "reason": "Belt secures pants at waist"
      }
    ]
  }
}
```

**Placement**: Add after `clothing:coverage_mapping` component for consistency.

### 4. Complete Belt Entity Example

**Before** (example):
```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:black_calfskin_belt",
  "description": "Black calfskin belt with brushed-brass buckle",
  "components": {
    "core:name": {
      "text": "belt"
    },
    "clothing:wearable": {
      "layer": "accessories",
      "equipmentSlots": {
        "primary": "torso_lower"
      },
      "allowedLayers": ["accessories"]
    },
    "clothing:coverage_mapping": {
      "covers": ["torso_lower"],
      "coveragePriority": "accessories"
    },
    "core:material": {
      "material": "calfskin"
    },
    "core:color": {
      "colorName": "black"
    }
  }
}
```

**After**:
```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:black_calfskin_belt",
  "description": "Black calfskin belt with brushed-brass buckle",
  "components": {
    "core:name": {
      "text": "belt"
    },
    "clothing:wearable": {
      "layer": "accessories",
      "equipmentSlots": {
        "primary": "torso_lower"
      },
      "allowedLayers": ["accessories"]
    },
    "clothing:coverage_mapping": {
      "covers": ["torso_lower"],
      "coveragePriority": "accessories"
    },
    "clothing:blocks_removal": {
      "blockedSlots": [
        {
          "slot": "legs",
          "layers": ["base", "outer"],
          "blockType": "must_remove_first",
          "reason": "Belt secures pants at waist"
        }
      ]
    },
    "core:material": {
      "material": "calfskin"
    },
    "core:color": {
      "colorName": "black"
    }
  }
}
```

### 5. Validate Updated Entities

After updating each entity, validate it:

```bash
npm run validate
```

Expected: All entity definitions valid.

### 6. Update Mod Manifest (if needed)

**File**: `data/mods/clothing/mod-manifest.json`

Check if the mod manifest needs updating:
- Version bump (minor version, e.g., 1.2.0 → 1.3.0)
- Changelog entry for blocking system

**Example Manifest Update**:
```json
{
  "id": "clothing",
  "version": "1.3.0",
  "name": "Clothing System",
  "description": "Core clothing and equipment system with realistic removal blocking",
  "dependencies": ["core"],
  "changelog": [
    {
      "version": "1.3.0",
      "changes": [
        "Added removal blocking system",
        "Updated belts to block pants removal"
      ]
    }
  ]
}
```

### 7. Create Entity Update Tests

**File**: `tests/integration/clothing/beltBlockingEntities.integration.test.js`

**Test Coverage**:

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('Belt Entities - Blocking Integration', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('clothing', 'clothing:remove_clothing');
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('should load black calfskin belt with blocking component', () => {
    // Act
    const belt = fixture.loadEntity('clothing:black_calfskin_belt');

    // Assert
    expect(belt).toBeDefined();
    expect(belt.components['clothing:blocks_removal']).toBeDefined();
    expect(belt.components['clothing:blocks_removal'].blockedSlots).toHaveLength(1);
    expect(belt.components['clothing:blocks_removal'].blockedSlots[0].slot).toBe('legs');
    expect(belt.components['clothing:blocks_removal'].blockedSlots[0].layers).toContain(
      'base'
    );
    expect(belt.components['clothing:blocks_removal'].blockedSlots[0].layers).toContain(
      'outer'
    );
  });

  it('should block pants removal when black belt equipped', async () => {
    // Arrange
    const actor = fixture.createStandardActor('John');
    const belt = fixture.loadAndSpawnEntity('clothing:black_calfskin_belt');
    const pants = fixture.createEntity('pants', ['clothing:wearable'], {
      'clothing:wearable': {
        layer: 'base',
        equipmentSlots: { primary: 'legs' },
      },
    });

    fixture.equipItem(actor.id, belt.id);
    fixture.equipItem(actor.id, pants.id);

    // Act
    const topmostClothing = fixture.resolveScope('clothing:topmost_clothing', {
      entityId: actor.id,
    });

    // Assert
    expect(topmostClothing).toContain(belt.id);
    expect(topmostClothing).not.toContain(pants.id);
  });

  it('should load brown leather belt with blocking component', () => {
    // Act
    const belt = fixture.loadEntity('clothing:brown_leather_belt');

    // Assert
    expect(belt).toBeDefined();
    expect(belt.components['clothing:blocks_removal']).toBeDefined();
  });

  it('should block pants removal when brown belt equipped', async () => {
    // Arrange
    const actor = fixture.createStandardActor('John');
    const belt = fixture.loadAndSpawnEntity('clothing:brown_leather_belt');
    const pants = fixture.createEntity('pants', ['clothing:wearable'], {
      'clothing:wearable': {
        layer: 'base',
        equipmentSlots: { primary: 'legs' },
      },
    });

    fixture.equipItem(actor.id, belt.id);
    fixture.equipItem(actor.id, pants.id);

    // Act
    const topmostClothing = fixture.resolveScope('clothing:topmost_clothing', {
      entityId: actor.id,
    });

    // Assert
    expect(topmostClothing).toContain(belt.id);
    expect(topmostClothing).not.toContain(pants.id);
  });

  it('should allow pants removal after belt removed', async () => {
    // Arrange
    const actor = fixture.createStandardActor('John');
    const belt = fixture.loadAndSpawnEntity('clothing:black_calfskin_belt');
    const pants = fixture.createEntity('pants', ['clothing:wearable'], {
      'clothing:wearable': {
        layer: 'base',
        equipmentSlots: { primary: 'legs' },
      },
    });

    fixture.equipItem(actor.id, belt.id);
    fixture.equipItem(actor.id, pants.id);

    // Act: Remove belt
    await fixture.executeAction(actor.id, belt.id);

    // Resolve topmost clothing again
    const topmostClothing = fixture.resolveScope('clothing:topmost_clothing', {
      entityId: actor.id,
    });

    // Assert
    expect(topmostClothing).toContain(pants.id);
    expect(topmostClothing).not.toContain(belt.id);
  });
});
```

### 8. Run Tests

```bash
NODE_ENV=test npm run test:integration -- tests/integration/clothing/beltBlockingEntities.integration.test.js
```

Expected: All tests pass.

---

## Validation

### Entity Validation

```bash
npm run validate
```

Expected: All entity definitions valid, no schema errors.

### Mod Validation

If a mod-specific validation script exists:

```bash
npm run validate:mod:clothing
```

Expected: Clothing mod validates successfully.

### Integration Tests

```bash
NODE_ENV=test npm run test:integration -- tests/integration/clothing/beltBlockingEntities.integration.test.js
```

Expected: All tests pass.

### Full Test Suite

```bash
npm run test:ci
```

Expected: No regressions, all tests pass.

### Manual Testing

1. Start application:
```bash
npm run dev
```

2. In game:
   - Create character
   - Equip belt and pants
   - Try to remove pants → should not appear in actions
   - Remove belt
   - Try to remove pants → should now appear in actions

---

## Acceptance Criteria

- [ ] All belt entities identified
- [ ] `clothing:blocks_removal` component added to all belt entities
- [ ] Component blocks `legs` slot, `base` and `outer` layers
- [ ] Block type is `must_remove_first`
- [ ] Reason field provides clear explanation
- [ ] All entities validate successfully
- [ ] Mod manifest updated with version bump and changelog
- [ ] Integration tests created and passing
- [ ] Manual testing confirms blocking works
- [ ] No regressions in existing tests

---

## Notes

### Why Block Both `base` and `outer` Layers?

- **Base Layer**: Regular pants, jeans, trousers
- **Outer Layer**: Chaps, over-pants, rain pants

Both types require belt removal for full removal.

### Optional: Create Example Armor Entity

**File**: `data/mods/clothing/entities/plate_cuirass.entity.json` (new, optional)

Demonstrates `full_block` type for armor:

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:plate_cuirass",
  "description": "Heavy plate armor chest piece",
  "components": {
    "core:name": {
      "text": "plate cuirass"
    },
    "clothing:wearable": {
      "layer": "outer",
      "equipmentSlots": {
        "primary": "torso_upper"
      },
      "allowedLayers": ["outer"]
    },
    "clothing:coverage_mapping": {
      "covers": ["torso_upper"],
      "coveragePriority": "outer"
    },
    "clothing:blocks_removal": {
      "blockedSlots": [
        {
          "slot": "torso_upper",
          "layers": ["base", "underwear"],
          "blockType": "full_block",
          "reason": "Plate armor completely covers torso"
        }
      ]
    },
    "core:material": {
      "material": "steel"
    }
  }
}
```

This demonstrates another use case for the blocking system.

---

## Common Pitfalls

**Pitfall**: Forgetting to update all belt variants
**Solution**: Use `find` command to identify all belt files

**Pitfall**: JSON syntax errors after editing
**Solution**: Validate after each file update

**Pitfall**: Inconsistent component ordering
**Solution**: Place `blocks_removal` after `coverage_mapping`

**Pitfall**: Not updating mod manifest
**Solution**: Bump version and add changelog entry

**Pitfall**: Breaking existing entity structure
**Solution**: Only add new component, don't modify existing ones

---

## Rollback Plan

If issues arise:
1. Remove `clothing:blocks_removal` component from entities
2. Revert mod manifest changes
3. Run validation to ensure entities still work
4. System falls back to non-blocking behavior (backward compatible)

---

## Related Tickets

- **CLOREMBLO-001**: Create blocks_removal component (prerequisite)
- **CLOREMBLO-004**: Integrate blocking into scope resolver (uses this content)
- **CLOREMBLO-005**: Create can-remove-item condition (validates this content)
- **CLOREMBLO-007**: Create comprehensive test suite (tests this content)
