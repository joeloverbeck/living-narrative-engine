# THRMELCHASPE-002: Create Threadscar Melissa Anatomy Recipe

**Status**: ✅ COMPLETED
**Priority**: High (Blocking)
**Estimated Effort**: Medium (1-2 hours)
**Dependencies**: THRMELCHASPE-001 (Anatomy Part Creation)

---

## Objective

Create the anatomy recipe file that defines Threadscar Melissa's physical body structure, including body descriptors, anatomy slots, patterns, and default clothing configuration.

---

## Files to Touch

### New Files
- `data/mods/fantasy/recipes/threadscar_melissa.recipe.json`

### Modified Files
None

---

## Out of Scope

**Must NOT change:**
- Character definition file (separate ticket THRMELCHASPE-003)
- Any anatomy part entities
- Schema files
- Component definitions
- Mod manifest files
- Clothing entity definitions
- Any existing recipe files

**Must NOT create:**
- Instance files
- Test files (separate ticket)
- Portrait images (separate ticket)

---

## Implementation Details

### Recipe Structure

Create file: `data/mods/fantasy/recipes/threadscar_melissa.recipe.json`

**Complete JSON** (see specification document section "Anatomy Recipe Specification"):

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.recipe.schema.json",
  "recipeId": "fantasy:threadscar_melissa_recipe",
  "blueprintId": "anatomy:human_female",
  "bodyDescriptors": {
    "height": "tall",
    "skinColor": "weathered tan",
    "build": "muscular",
    "composition": "lean",
    "hairDensity": "light",
    "smell": "sweat and leather"
  },
  "slots": {
    "torso": {
      "partType": "torso",
      "preferId": "anatomy:human_female_torso_muscular_scarred",
      "properties": {
        "descriptors:build": {
          "build": "muscular"
        },
        "descriptors:texture": {
          "texture": "scarred"
        }
      }
    },
    "head": {
      "partType": "head",
      "preferId": "anatomy:humanoid_head_scarred",
      "properties": {
        "descriptors:facial_aesthetic": {
          "value": "plain"
        }
      }
    },
    "hair": {
      "partType": "hair",
      "properties": {
        "descriptors:color_extended": {
          "color": "brown"
        },
        "descriptors:hair_style": {
          "style": "ponytail"
        },
        "descriptors:length_hair": {
          "length": "short"
        }
      }
    },
    "nose": {
      "partType": "nose",
      "preferId": "anatomy:humanoid_nose",
      "properties": {
        "descriptors:texture": {
          "texture": "scarred"
        },
        "descriptors:size_category": {
          "size": "medium"
        }
      }
    },
    "left_breast": {
      "partType": "breast",
      "preferId": "anatomy:human_breast_c_cup_firm"
    },
    "right_breast": {
      "partType": "breast",
      "preferId": "anatomy:human_breast_c_cup_firm"
    },
    "left_ass": {
      "partType": "ass_cheek",
      "preferId": "anatomy:human_ass_cheek_firm"
    },
    "right_ass": {
      "partType": "ass_cheek",
      "preferId": "anatomy:human_ass_cheek_firm"
    },
    "vagina": {
      "partType": "vagina",
      "preferId": "anatomy:human_vagina"
    }
  },
  "patterns": [
    {
      "matches": ["left_arm", "right_arm"],
      "partType": "arm",
      "preferId": "anatomy:humanoid_arm_scarred",
      "properties": {
        "descriptors:texture": {
          "texture": "scarred"
        }
      }
    },
    {
      "matches": ["left_leg", "right_leg"],
      "partType": "leg",
      "preferId": "anatomy:human_leg_muscular",
      "properties": {
        "descriptors:build": {
          "build": "muscular"
        }
      }
    },
    {
      "matches": ["left_hand", "right_hand"],
      "partType": "hand",
      "preferId": "anatomy:human_hand",
      "properties": {
        "descriptors:texture": {
          "texture": "scarred"
        }
      }
    },
    {
      "matches": ["left_foot", "right_foot"],
      "partType": "foot",
      "preferId": "anatomy:human_foot"
    },
    {
      "matches": ["left_eye", "right_eye"],
      "partType": "eye",
      "properties": {
        "descriptors:color_basic": {
          "color": "gray"
        },
        "descriptors:shape_eye": {
          "shape": "hooded"
        }
      }
    }
  ],
  "clothingEntities": [
    {
      "entityId": "clothing:graphite_wool_briefs",
      "equip": true
    },
    {
      "entityId": "clothing:charcoal_nylon_sports_bra",
      "equip": true
    },
    {
      "entityId": "clothing:shale_gray_nylon_field_pants",
      "equip": true
    },
    {
      "entityId": "clothing:black_tactical_work_belt",
      "equip": true
    },
    {
      "entityId": "clothing:dark_gray_wool_boot_socks",
      "equip": true
    },
    {
      "entityId": "clothing:black_leather_duty_boots",
      "equip": true
    },
    {
      "entityId": "clothing:battle_scarred_leather_jacket",
      "equip": true
    }
  ]
}
```

### Critical References

**All referenced entities MUST exist:**
- `anatomy:human_female` (blueprint)
- `anatomy:human_female_torso_muscular_scarred` (created in THRMELCHASPE-001) ✓
- `anatomy:humanoid_head_scarred` ✓
- `anatomy:humanoid_arm_scarred` ✓
- `anatomy:human_leg_muscular` ✓
- `anatomy:human_hand` ✓
- `anatomy:human_foot` ✓
- `anatomy:humanoid_nose` ✓
- `anatomy:human_breast_c_cup_firm` ✓ (CORRECTED: was b_cup_firm)
- `anatomy:human_ass_cheek_firm` ✓ (CORRECTED: was firm_athletic)
- `anatomy:human_vagina` ✓
- All clothing entities (7 items - verified existence) ✓

---

## Acceptance Criteria

### Schema Validation
- [ ] Recipe validates against `anatomy.recipe.schema.json`
- [ ] Recipe ID field name is `recipeId` (NOT `id`)
- [ ] Recipe ID follows format: `fantasy:threadscar_melissa_recipe`
- [ ] Blueprint field name is `blueprintId` (NOT `blueprint`)
- [ ] Blueprint reference is valid: `anatomy:human_female`
- [ ] Schema reference uses `schema://` URI format

### Body Descriptors Validation
- [ ] All 6 required body descriptors present:
  - `height: "tall"` (valid enum)
  - `skinColor: "weathered tan"` (free-form)
  - `build: "muscular"` (valid enum)
  - `composition: "lean"` (valid enum)
  - `hairDensity: "light"` (valid enum)
  - `smell: "sweat and leather"` (free-form)
- [ ] No additional unexpected descriptors
- [ ] All enum values match body descriptor registry

### Slots Validation
- [ ] All 9 slots defined: torso, head, hair, nose, left_breast, right_breast, left_ass, right_ass, vagina
- [ ] Each slot has correct `partType`
- [ ] All `preferId` references point to existing entities
- [ ] Torso references new entity: `anatomy:human_female_torso_muscular_scarred`
- [ ] No duplicate slot definitions
- [ ] Property overrides use valid component schemas

### Patterns Validation
- [ ] 5 patterns defined: arms, legs, hands, feet, eyes
- [ ] Each pattern has valid `matches` array
- [ ] `matches` arrays reference valid blueprint slots
- [ ] All `preferId` references exist
- [ ] Property overrides are valid

### Clothing Validation
- [ ] 7 clothing entities referenced
- [ ] All clothing entity IDs exist in clothing mod
- [ ] All items have `equip: true`
- [ ] Clothing layering is logical (underwear → base → outer → accessories)

### Cross-Reference Validation
```bash
# Verify all anatomy parts exist
grep -r "anatomy:humanoid_arm_scarred" data/mods/anatomy/entities/definitions/
grep -r "anatomy:human_leg_muscular" data/mods/anatomy/entities/definitions/
grep -r "anatomy:human_breast_b_cup_firm" data/mods/anatomy/entities/definitions/
# ... etc for all referenced parts

# Verify all clothing items exist
grep -r "clothing:graphite_wool_briefs" data/mods/clothing/entities/definitions/
# ... etc for all 7 clothing items
```

### Validation Commands
```bash
# Schema validation
npm run validate

# Strict validation
npm run validate:strict

# Type checking
npm run typecheck
```

### Expected Results
- [ ] `npm run validate` passes without errors
- [ ] No "entity not found" errors
- [ ] No schema validation failures
- [ ] Recipe structure is valid JSON

### Invariants That Must Remain True
- [ ] No anatomy part entities are modified
- [ ] No clothing entities are modified
- [ ] No schema files are changed
- [ ] Recipe uses `fantasy:` namespace (not `anatomy:`)
- [ ] Blueprint remains `anatomy:human_female`
- [ ] All existing recipes remain unchanged

---

## Testing

**Note**: Full integration testing in THRMELCHASPE-004

Manual verification for this ticket:
1. All referenced entities exist
2. Recipe schema validates
3. No duplicate slot/pattern definitions
4. Body descriptors use correct types (enum vs free-form)

---

## Pre-Implementation Checklist

Before starting implementation:
- [ ] THRMELCHASPE-001 is complete (anatomy part exists)
- [ ] Verify all clothing entities exist in clothing mod
- [ ] Verify all anatomy parts exist in anatomy mod
- [ ] Review anatomy.recipe.schema.json for current structure

---

## Definition of Done

- [ ] Recipe file created at specified path
- [ ] JSON structure matches specification exactly
- [ ] `npm run validate` passes
- [ ] All entity references are valid
- [ ] Recipe ID uses `fantasy:` namespace
- [ ] All 6 body descriptors present with correct values
- [ ] All 9 slots configured
- [ ] All 5 patterns defined
- [ ] All 7 clothing entities referenced
- [ ] File committed to version control
- [ ] No other files modified

---

## Notes

- This recipe will be referenced by character definition in THRMELCHASPE-003
- Clothing layering follows established system (underwear → base → outer → accessories)
- Scarred texture applied to arms, hands, torso, nose for thematic consistency
- Muscular build on torso and legs for combat-capable aesthetic
- Gray hooded eyes match "weathered veteran" aesthetic

---

## Outcome

**Completed**: 2025-11-22

### Changes Made vs Originally Planned

**Corrected Assumptions:**
1. **Schema Field Names**: Fixed `id` → `recipeId` and `blueprint` → `blueprintId` to match actual schema
2. **Anatomy Part References**:
   - Changed `anatomy:human_breast_b_cup_firm` → `anatomy:human_breast_c_cup_firm` (b_cup_firm doesn't exist)
   - Changed `anatomy:human_ass_cheek_firm_athletic` → `anatomy:human_ass_cheek_firm` (firm_athletic doesn't exist)

**Files Created:**
- `data/mods/fantasy/recipes/threadscar_melissa.recipe.json` ✓

**Validation Results:**
- ✅ Schema validation passed (`npm run validate`)
- ✅ All referenced anatomy parts exist and verified
- ✅ All 7 clothing entities exist and verified
- ✅ Recipe structure matches schema exactly
- ✅ No modifications to any other files

**Implementation Notes:**
- Recipe follows exact schema structure from `anatomy.recipe.schema.json`
- All entity references validated against existing entities in anatomy and clothing mods
- Body descriptors use correct enum values and free-form strings as appropriate
- Patterns correctly match blueprint slots for arms, legs, hands, feet, and eyes
- Clothing entities follow logical layering order (underwear → base → outer → accessories)
