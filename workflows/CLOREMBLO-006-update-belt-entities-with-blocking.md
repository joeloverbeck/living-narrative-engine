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
- **Reason**: `"Belt secures pants at waist"` (optional but recommended for clarity)

### Affected Entities

**Directory**: `data/mods/clothing/entities/definitions/`

**Belt Entity Files** (update all that exist):
- `black_calfskin_belt.entity.json`
- `dark_brown_leather_belt.entity.json`
- `black_tactical_work_belt.entity.json`

---

## Implementation Tasks

### 1. Identify Belt Entities

Search for all belt entity files in the clothing mod:

```bash
find data/mods/clothing/entities/definitions/ -name "*belt*.entity.json"
```

Expected output:
```
data/mods/clothing/entities/definitions/black_calfskin_belt.entity.json
data/mods/clothing/entities/definitions/dark_brown_leather_belt.entity.json
data/mods/clothing/entities/definitions/black_tactical_work_belt.entity.json
```

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

**Placement**: Add after `clothing:wearable` component for consistency.

### 4. Complete Belt Entity Example

**Before** (actual current structure):
```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:black_calfskin_belt",
  "description": "Black calfskin belt with brushed-brass buckle",
  "components": {
    "clothing:wearable": {
      "layer": "accessories",
      "equipmentSlots": {
        "primary": "torso_lower"
      },
      "allowedLayers": ["accessories"]
    },
    "core:material": {
      "material": "calfskin"
    },
    "core:name": {
      "text": "belt"
    },
    "core:description": {
      "text": "A sleek black calfskin belt featuring a sophisticated brushed-brass buckle..."
    },
    "descriptors:color_basic": {
      "color": "black"
    },
    "descriptors:texture": {
      "texture": "smooth"
    },
    "items:item": {},
    "items:portable": {},
    "items:weight": {
      "weight": 0.32
    }
  }
}
```

**After** (with blocking component added):
```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:black_calfskin_belt",
  "description": "Black calfskin belt with brushed-brass buckle",
  "components": {
    "clothing:wearable": {
      "layer": "accessories",
      "equipmentSlots": {
        "primary": "torso_lower"
      },
      "allowedLayers": ["accessories"]
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
    "core:name": {
      "text": "belt"
    },
    "core:description": {
      "text": "A sleek black calfskin belt featuring a sophisticated brushed-brass buckle..."
    },
    "descriptors:color_basic": {
      "color": "black"
    },
    "descriptors:texture": {
      "texture": "smooth"
    },
    "items:item": {},
    "items:portable": {},
    "items:weight": {
      "weight": 0.32
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
import { promises as fs } from 'fs';
import { resolve } from 'path';

describe('Belt Entities - Blocking Component', () => {
  let blackBelt;
  let brownBelt;
  let tacticalBelt;

  beforeEach(async () => {
    // Load belt entity definitions from files
    const blackBeltPath = resolve('data/mods/clothing/entities/definitions/black_calfskin_belt.entity.json');
    const brownBeltPath = resolve('data/mods/clothing/entities/definitions/dark_brown_leather_belt.entity.json');
    const tacticalBeltPath = resolve('data/mods/clothing/entities/definitions/black_tactical_work_belt.entity.json');

    blackBelt = JSON.parse(await fs.readFile(blackBeltPath, 'utf-8'));
    brownBelt = JSON.parse(await fs.readFile(brownBeltPath, 'utf-8'));
    tacticalBelt = JSON.parse(await fs.readFile(tacticalBeltPath, 'utf-8'));
  });

  describe('Black Calfskin Belt', () => {
    it('should have blocking component defined', () => {
      expect(blackBelt.components['clothing:blocks_removal']).toBeDefined();
    });

    it('should block legs slot with base and outer layers', () => {
      const blocking = blackBelt.components['clothing:blocks_removal'];
      expect(blocking.blockedSlots).toHaveLength(1);
      expect(blocking.blockedSlots[0].slot).toBe('legs');
      expect(blocking.blockedSlots[0].layers).toContain('base');
      expect(blocking.blockedSlots[0].layers).toContain('outer');
    });

    it('should use must_remove_first block type', () => {
      const blocking = blackBelt.components['clothing:blocks_removal'];
      expect(blocking.blockedSlots[0].blockType).toBe('must_remove_first');
    });

    it('should have descriptive reason', () => {
      const blocking = blackBelt.components['clothing:blocks_removal'];
      expect(blocking.blockedSlots[0].reason).toBe('Belt secures pants at waist');
    });
  });

  describe('Dark Brown Leather Belt', () => {
    it('should have blocking component defined', () => {
      expect(brownBelt.components['clothing:blocks_removal']).toBeDefined();
    });

    it('should block legs slot with base and outer layers', () => {
      const blocking = brownBelt.components['clothing:blocks_removal'];
      expect(blocking.blockedSlots).toHaveLength(1);
      expect(blocking.blockedSlots[0].slot).toBe('legs');
      expect(blocking.blockedSlots[0].layers).toContain('base');
      expect(blocking.blockedSlots[0].layers).toContain('outer');
    });

    it('should use must_remove_first block type', () => {
      const blocking = brownBelt.components['clothing:blocks_removal'];
      expect(blocking.blockedSlots[0].blockType).toBe('must_remove_first');
    });
  });

  describe('Black Tactical Work Belt', () => {
    it('should have blocking component defined', () => {
      expect(tacticalBelt.components['clothing:blocks_removal']).toBeDefined();
    });

    it('should block legs slot with base and outer layers', () => {
      const blocking = tacticalBelt.components['clothing:blocks_removal'];
      expect(blocking.blockedSlots).toHaveLength(1);
      expect(blocking.blockedSlots[0].slot).toBe('legs');
      expect(blocking.blockedSlots[0].layers).toContain('base');
      expect(blocking.blockedSlots[0].layers).toContain('outer');
    });

    it('should use must_remove_first block type', () => {
      const blocking = tacticalBelt.components['clothing:blocks_removal'];
      expect(blocking.blockedSlots[0].blockType).toBe('must_remove_first');
    });
  });

  describe('All Belts Consistency', () => {
    it('should all have consistent blocking configuration', () => {
      const belts = [blackBelt, brownBelt, tacticalBelt];

      for (const belt of belts) {
        const blocking = belt.components['clothing:blocks_removal'];
        expect(blocking).toBeDefined();
        expect(blocking.blockedSlots).toHaveLength(1);
        expect(blocking.blockedSlots[0].slot).toBe('legs');
        expect(blocking.blockedSlots[0].layers).toEqual(['base', 'outer']);
        expect(blocking.blockedSlots[0].blockType).toBe('must_remove_first');
      }
    });
  });
});
```

**Note**: This test validates the entity definition files directly. For runtime behavior testing (actual blocking in action), see the existing tests:
- `tests/integration/clothing/topmostClothingBlocking.integration.test.js`
- `tests/integration/clothing/removeClothingRuleBlocking.integration.test.js`

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

- [ ] All three belt entities identified (black_calfskin_belt, dark_brown_leather_belt, black_tactical_work_belt)
- [ ] `clothing:blocks_removal` component added to all belt entities
- [ ] Component blocks `legs` slot, `base` and `outer` layers
- [ ] Block type is `must_remove_first`
- [ ] Reason field provides clear explanation (optional but recommended)
- [ ] All entities validate successfully (`npm run validate`)
- [ ] Mod manifest updated with version bump and changelog
- [ ] Entity definition tests created and passing
- [ ] All existing blocking system tests pass
- [ ] No regressions in existing test suite (`npm run test:ci`)

---

## Notes

### Why Block Both `base` and `outer` Layers?

- **Base Layer**: Regular pants, jeans, trousers
- **Outer Layer**: Chaps, over-pants, rain pants

Both types require belt removal for full removal.

### Optional: Create Example Armor Entity

**File**: `data/mods/clothing/entities/definitions/plate_cuirass.entity.json` (new, optional)

Demonstrates `full_block` type for armor:

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:plate_cuirass",
  "description": "Heavy plate armor chest piece",
  "components": {
    "clothing:wearable": {
      "layer": "outer",
      "equipmentSlots": {
        "primary": "torso_upper"
      },
      "allowedLayers": ["outer"]
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
    },
    "core:name": {
      "text": "plate cuirass"
    },
    "core:description": {
      "text": "A heavy plate armor chest piece designed for maximum protection in combat."
    },
    "items:item": {},
    "items:portable": {},
    "items:weight": {
      "weight": 15.0
    }
  }
}
```

**Note**: This demonstrates another use case for the blocking system. The armor would need to be placed in `data/mods/clothing/entities/definitions/` to match the project structure.

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
