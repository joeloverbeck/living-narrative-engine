# Specification: Face Coverage Clothing Slots and Redundancy Fix

## Overview

This specification addresses two interrelated issues in the anatomy clothing slot mapping system:

1. **Missing face coverage slots** - No granular way to equip items covering nose, mouth, or teeth
2. **Redundant clothing mappings** - All 6 core part files repeat identical clothing slot definitions

## Problem Analysis

### Current State

The anatomy system uses a three-layer composition model:

```
Slot Library (humanoid.slot-library.json)
    ↓ defines slots & clothing mappings
Blueprint Part (humanoid_core.part.json, etc.)
    ↓ uses library via $use directive
Blueprint (human_female.blueprint.json, etc.)
    ↓ composes parts
```

**Current clothing slots** (from `humanoid.slot-library.json`):

| Slot | Reference Type | Coverage |
|------|---------------|----------|
| `head_gear` | blueprintSlots: ["head"] | Entire head |
| `face_gear` | blueprintSlots: ["head"] | Head (accessories only) |
| `torso_upper` | anatomySockets | Chest/shoulders |
| `torso_lower` | anatomySockets | Hips/genitals |
| `hands` | blueprintSlots | Both hands |
| `legs` | blueprintSlots | Both legs |
| `feet` | blueprintSlots | Both feet |
| `back_accessory` | anatomySockets | Upper/lower back |

**Problem 1: No granular face coverage**

- `head_gear` covers the entire head - cannot use for respirators if character needs a helmet
- `face_gear` is accessories-only (glasses, jewelry) - not protective gear
- Face anatomy slots (`nose`, `mouth`, `teeth`) are body part attachment points, not clothing attachment points

**Problem 2: Massive redundancy**

All 6 core part files contain identical `clothingSlotMappings` sections:
- `data/mods/anatomy/parts/humanoid_core.part.json`
- `data/mods/anatomy-creatures/parts/hyena_core.part.json`
- `data/mods/anatomy-creatures/parts/feline_core.part.json`
- `data/mods/anatomy-creatures/parts/amphibian_core.part.json`
- `data/mods/anatomy-creatures/parts/mustelid_core.part.json`
- `data/mods/anatomy-creatures/parts/rodent_core.part.json`

Each repeats 10+ identical clothing slot definitions using `$use` references to the same library.

## Design Solution

### Part 1: Add Face Coverage Clothing Slots

Add three new clothing slots with varying granularity:

| Slot | Coverage | Use Cases |
|------|----------|-----------|
| `nose_covering` | Nose only | Nose rings, nose clips, respirator nose pieces |
| `mouth_covering` | Mouth + teeth | Gags, mouth guards, bite guards, dental gear |
| `face_lower` | Nose + mouth + teeth | Respirators, masks, veils, balaclavas |

**Implementation:**

#### 1.1 Add anatomy sockets to head entities

Add clothing-specific sockets to all humanoid head entity definitions:

```json
// In anatomy:sockets component of head entities
{
  "sockets": [
    // ... existing sockets ...
    {
      "id": "nose_covering",
      "allowedTypes": ["clothing"],
      "nameTpl": "nose covering area"
    },
    {
      "id": "mouth_covering",
      "allowedTypes": ["clothing"],
      "nameTpl": "mouth covering area"
    },
    {
      "id": "face_lower",
      "allowedTypes": ["clothing"],
      "nameTpl": "lower face covering area"
    }
  ]
}
```

**Files to modify** (11 head entities):
- `data/mods/anatomy/entities/definitions/humanoid_head.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_head_attractive.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_head_bearded.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_head_beautiful.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_head_cute.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_head_hideous.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_head_moustached.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_head_plain.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_head_plain_weary.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_head_scarred.entity.json`
- `data/mods/anatomy/entities/definitions/humanoid_head_stubble.entity.json`

Also creature-specific heads (if any) in `data/mods/anatomy-creatures/entities/definitions/`.

#### 1.2 Add clothing definitions to slot library

Add to `data/mods/anatomy/libraries/humanoid.slot-library.json`:

```json
{
  "clothingDefinitions": {
    // ... existing definitions ...

    "standard_nose_covering": {
      "anatomySockets": ["nose_covering"],
      "allowedLayers": ["base", "accessories"]
    },
    "standard_mouth_covering": {
      "anatomySockets": ["mouth_covering"],
      "allowedLayers": ["base", "armor"]
    },
    "standard_face_lower": {
      "anatomySockets": ["face_lower"],
      "allowedLayers": ["base", "outer", "armor"]
    }
  }
}
```

**Layer rationale:**
- `nose_covering`: base (functional), accessories (decorative like nose rings)
- `mouth_covering`: base (gags), armor (protective mouth guards)
- `face_lower`: base (cloth masks), outer (veils), armor (respirators, gas masks)

#### 1.3 Update coverage_mapping component enum

Add to `data/mods/clothing/components/coverage_mapping.component.json`:

```json
{
  "covers": {
    "items": {
      "enum": [
        "torso_upper",
        "torso_lower",
        "legs",
        "feet",
        "head_gear",
        "hands",
        "left_arm_clothing",
        "right_arm_clothing",
        "nose_covering",
        "mouth_covering",
        "face_lower"
      ]
    }
  }
}
```

#### 1.4 Add to part files' clothingSlotMappings

Add to each part file (temporary until Phase 2 redundancy fix):

```json
{
  "clothingSlotMappings": {
    // ... existing mappings ...
    "nose_covering": { "$use": "standard_nose_covering" },
    "mouth_covering": { "$use": "standard_mouth_covering" },
    "face_lower": { "$use": "standard_face_lower" }
  }
}
```

### Part 2: Redundancy Fix - Library Auto-Inheritance

#### 2.1 Add `defaultClothingSlotMappings` to slot library schema

Modify `data/schemas/anatomy.slot-library.schema.json` to add:

```json
{
  "properties": {
    // ... existing properties ...

    "defaultClothingSlotMappings": {
      "type": "object",
      "description": "Default clothing slot mappings automatically inherited by parts using this library. Parts can override individual mappings.",
      "additionalProperties": {
        "$ref": "#/definitions/clothingSlotMapping"
      }
    }
  }
}
```

#### 2.2 Update slot library with defaults

Move common mappings to `defaultClothingSlotMappings`:

```json
{
  "id": "anatomy:humanoid_slots",
  "description": "Standard humanoid anatomy slot and clothing definitions",

  "slotDefinitions": { /* unchanged */ },

  "clothingDefinitions": { /* unchanged */ },

  "defaultClothingSlotMappings": {
    "head_gear": { "$use": "standard_head_gear" },
    "face_gear": { "$use": "standard_face_gear" },
    "torso_upper": { "$use": "standard_torso_upper" },
    "torso_lower": { "$use": "standard_torso_lower" },
    "left_arm_clothing": {
      "$use": "standard_arm_clothing",
      "blueprintSlots": ["left_arm"]
    },
    "right_arm_clothing": {
      "$use": "standard_arm_clothing",
      "blueprintSlots": ["right_arm"]
    },
    "hands": { "$use": "standard_hands" },
    "legs": { "$use": "standard_legs" },
    "feet": { "$use": "standard_feet" },
    "back_accessory": { "$use": "standard_back_accessory" },
    "nose_covering": { "$use": "standard_nose_covering" },
    "mouth_covering": { "$use": "standard_mouth_covering" },
    "face_lower": { "$use": "standard_face_lower" }
  }
}
```

#### 2.3 Modify loader to auto-merge defaults

Update `src/loaders/anatomyBlueprintLoader.js` to:

1. When processing a part with a `library` reference
2. Load the library's `defaultClothingSlotMappings` (if present)
3. Merge into the part's `clothingSlotMappings` with part overrides taking precedence

**Pseudocode:**

```javascript
function processPartClothingMappings(part, library) {
  // Start with library defaults
  const mergedMappings = { ...library.defaultClothingSlotMappings };

  // Part mappings override defaults
  if (part.clothingSlotMappings) {
    Object.assign(mergedMappings, part.clothingSlotMappings);
  }

  // Resolve $use references
  return resolveClothingReferences(mergedMappings, library.clothingDefinitions);
}
```

#### 2.4 Simplify part files

After loader changes, simplify part files to only contain overrides:

**Before (humanoid_core.part.json):**
```json
{
  "clothingSlotMappings": {
    "head_gear": { "$use": "standard_head_gear" },
    "face_gear": { "$use": "standard_face_gear" },
    "torso_upper": { "$use": "standard_torso_upper" },
    // ... 10+ more identical mappings ...
  }
}
```

**After:**
```json
{
  "clothingSlotMappings": {
    // Empty - inherits all from library defaults
  }
}
```

Or even remove `clothingSlotMappings` entirely if empty.

**Creature-specific parts** that need tail slots can specify just the override:

```json
{
  "clothingSlotMappings": {
    "tail_accessory": { "$use": "standard_tail_accessory" }
  }
}
```

## Example: Cloth Respirator Entity

After implementation, a respirator can be defined as:

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:cloth_respirator",
  "components": {
    "core:identity": {
      "name": "Cloth Respirator",
      "description": "A woven cloth mask that covers the nose and mouth, providing basic protection against foul air"
    },
    "clothing:wearable": {
      "layer": "base",
      "equipmentSlots": {
        "primary": "face_lower"
      }
    },
    "clothing:coverage_mapping": {
      "covers": ["face_lower"],
      "coveragePriority": "base"
    },
    "core:weight": {
      "weight": 0.1
    }
  }
}
```

## Implementation Phases

### Phase 1: Add Face Coverage Slots (Minimal Risk)

**Changes:**
1. Add 3 sockets to 11+ head entity files
2. Add 3 clothing definitions to slot library
3. Add 3 mappings to 6 part files
4. Update coverage_mapping enum

**Risk:** Low - purely additive changes
**Testing:** Create test respirator entity, verify equipping works

### Phase 2: Schema and Loader Changes

**Changes:**
1. Add `defaultClothingSlotMappings` to slot library schema
2. Modify loader to merge defaults
3. Add defaults to slot library

**Risk:** Medium - loader changes affect all anatomy loading
**Testing:** Comprehensive anatomy loading tests, verify existing blueprints work

### Phase 3: Simplify Part Files

**Changes:**
1. Remove redundant mappings from all 6 part files
2. Keep only creature-specific overrides (tail_accessory for cat_girl, etc.)

**Risk:** Low - only data changes after loader is verified
**Testing:** Verify all existing clothing still works

## Developer Guide: Adding New Clothing Slots

After this implementation, developers can add new clothing slots by:

### For slots using existing body sockets:

1. Add clothing definition to `humanoid.slot-library.json`:
   ```json
   "standard_new_slot": {
     "anatomySockets": ["existing_socket"],
     "allowedLayers": ["base", "outer"]
   }
   ```

2. Add to `defaultClothingSlotMappings`:
   ```json
   "new_slot": { "$use": "standard_new_slot" }
   ```

3. Update `coverage_mapping.component.json` enum

### For slots requiring new body sockets:

1. Add socket to relevant entity definitions (e.g., head, torso)
2. Follow steps above for clothing definition
3. Consider if socket needs to be added to multiple entity variants

### Checklist for new clothing slots:

- [ ] Socket exists in anatomy entities (or add it)
- [ ] Clothing definition in slot library `clothingDefinitions`
- [ ] Mapping in `defaultClothingSlotMappings` (auto-inherited)
- [ ] Enum updated in `coverage_mapping.component.json`
- [ ] (Optional) Override in specific part files if needed

## Backward Compatibility

- Existing blueprints and recipes continue to work unchanged
- Existing clothing items continue to work unchanged
- Explicit `clothingSlotMappings` in parts override library defaults
- New slots are purely additive

## Files Modified Summary

### Phase 1

| File | Change |
|------|--------|
| `data/mods/anatomy/entities/definitions/humanoid_head*.json` (11) | Add 3 face sockets |
| `data/mods/anatomy/libraries/humanoid.slot-library.json` | Add 3 clothing definitions |
| `data/mods/anatomy/parts/humanoid_core.part.json` | Add 3 face mappings |
| `data/mods/anatomy-creatures/parts/*.part.json` (5) | Add 3 face mappings |
| `data/mods/clothing/components/coverage_mapping.component.json` | Add 3 enum values |

### Phase 2

| File | Change |
|------|--------|
| `data/schemas/anatomy.slot-library.schema.json` | Add defaultClothingSlotMappings |
| `src/loaders/anatomyBlueprintLoader.js` | Auto-merge library defaults |
| `data/mods/anatomy/libraries/humanoid.slot-library.json` | Add defaultClothingSlotMappings |

### Phase 3

| File | Change |
|------|--------|
| `data/mods/anatomy/parts/humanoid_core.part.json` | Remove redundant mappings |
| `data/mods/anatomy-creatures/parts/*.part.json` (5) | Remove redundant mappings |

## Testing Strategy

### Unit Tests
- Slot library schema validates with new property
- Clothing definition resolution works correctly
- Default mapping merge logic works

### Integration Tests
- Anatomy loads correctly with defaults
- Explicit overrides take precedence
- Existing blueprints unchanged behavior
- New face slots can be equipped

### Manual Tests
- Create respirator entity
- Equip on character with helmet (should both equip)
- Verify face_lower blocks head_gear removal if needed
- Test creature variants (cat_girl, hyena_folk) work correctly
