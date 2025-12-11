# TOAFOLMALREC-005: Create toad_folk_male.blueprint.json (COMPLETED)

## Summary

Create the blueprint file that composes the amphibian_core part with male-specific slot definitions and clothing slot mappings for toad-folk male anatomy.

## Assumption Review

- The amphibian_core part already omits hair-related slots, but its inherited `standard_torso_lower` clothing mapping still references `pubic_hair`; this blueprint must override that mapping to remove `pubic_hair` for the hairless toad-folk.
- Clothing mappings are inherited from the part (head_gear, face_gear, hands). On top of those, the blueprint defines 8 mappings (including the `full_body` addition), with overrides for the torso/limb coverage. The earlier “9 mappings” note was incorrect.
- Validation we can run now is schema-level via `npm run validate`. Full recipe validation with `npm run validate:recipe -- --recipe dredgers:toad_folk_male_standard` stays blocked until the recipe (TOAFOLMALREC-006) and manifest update (TOAFOLMALREC-007) land.

## Background

The blueprint is the structural definition that:
1. Specifies the root entity (toad_folk_male_torso)
2. Composes parts (amphibian_core) to inherit slot definitions
3. Adds sex-specific slots (penis, testicles) not in the core part
4. Defines clothing slot mappings for the complete body

**Spec Reference**: `specs/toad-folk-male-recipe.md` - Section "5. blueprints/toad_folk_male.blueprint.json"

## Files to Create

| File | Description |
|------|-------------|
| `data/mods/dredgers/blueprints/toad_folk_male.blueprint.json` | Blueprint composing amphibian_core with male slots |

## Files to Touch

- `data/mods/dredgers/blueprints/toad_folk_male.blueprint.json` (CREATE)

## Out of Scope

- DO NOT modify `ermine_folk_female.blueprint.json`
- DO NOT modify any existing blueprint files
- DO NOT modify the mod-manifest.json (handled in TOAFOLMALREC-007)
- DO NOT add body descriptors (those go in the recipe, not the blueprint)

## Implementation Details

Create `data/mods/dredgers/blueprints/toad_folk_male.blueprint.json` with (override torso_lower to remove pubic_hair; other inherited mappings stay as-is):

### Required Properties

1. **Schema Reference**: `"$schema": "schema://living-narrative-engine/anatomy.blueprint.schema.json"`
2. **ID**: `"dredgers:toad_folk_male"`
3. **Root**: `"dredgers:toad_folk_male_torso"` (the torso entity from TOAFOLMALREC-004)

### Composition

```json
"compose": [
  {
    "part": "dredgers:amphibian_core",
    "include": ["slots", "clothingSlotMappings"]
  }
]
```

This inherits all slots and clothing mappings from the amphibian_core part.

### Male-Specific Slots (3 slots)

These are added on top of what's composed from amphibian_core:

1. **penis**
   - `socket`: "penis"
   - `requirements.partType`: "penis"
   - `requirements.components`: ["anatomy:part"]

2. **left_testicle**
   - `socket`: "left_testicle"
   - `requirements.partType`: "testicle"
   - `requirements.components`: ["anatomy:part"]

3. **right_testicle**
   - `socket`: "right_testicle"
   - `requirements.partType`: "testicle"
   - `requirements.components`: ["anatomy:part"]

### Clothing Slot Mappings (8 blueprint overrides/additions)

Override/add clothing slot mappings specific to male anatomy (head_gear, face_gear, hands stay inherited from the part):

1. **back_accessory**: upper_back, lower_back sockets
2. **torso_lower**: hips, penis, testicles, asshole, ass cheeks (NO pubic_hair)
3. **full_body**: head, arms, legs
4. **torso_upper**: torso
5. **legs**: left_leg, right_leg
6. **left_arm_clothing**: left_arm
7. **right_arm_clothing**: right_arm
8. **feet**: left_foot, right_foot

### Key Differences from ermine_folk_female.blueprint

| Aspect | Ermine Folk Female | Toad Folk Male |
|--------|-------------------|----------------|
| Root | ermine_folk_female_torso | toad_folk_male_torso |
| Composed Part | mustelid_core | amphibian_core |
| Sex Slots | vagina, labia | penis, testicles |
| torso_lower | includes pubic_hair | excludes pubic_hair |

## Acceptance Criteria

### Tests That Must Pass

1. **Schema Validation**:
   ```bash
   npm run validate
   ```
   - Blueprint must be valid against `anatomy.blueprint.schema.json`

2. **Part Reference**: The `compose[0].part` reference to `dredgers:amphibian_core` must resolve
   - Requires TOAFOLMALREC-001 to be completed first

3. **Root Reference**: The `root` reference to `dredgers:toad_folk_male_torso` must resolve
   - Requires TOAFOLMALREC-004 to be completed first

4. **Integration Test** (after all tickets complete):
   ```bash
   npm run validate:recipe -- --recipe dredgers:toad_folk_male_standard
   ```
   - Blueprint must load and compose correctly (blocked until TOAFOLMALREC-006/007 complete)

### Invariants That Must Remain True

1. **Existing Blueprint Unchanged**: `ermine_folk_female.blueprint.json` must remain identical
2. **Valid Part Reference**: `dredgers:amphibian_core` must exist and be loadable
3. **Valid Root Reference**: `dredgers:toad_folk_male_torso` must exist and be loadable
4. **Male Anatomy**: Must have penis and testicle slots, NOT vagina/labia
5. **No Pubic Hair in Clothing**: `torso_lower` mapping must NOT include pubic_hair
6. **Complete Clothing Coverage**: All required clothing slot mappings present (inherited head_gear/face_gear/hands plus the 8 blueprint overrides/additions)

### Completion Checklist

- [x] File created at `data/mods/dredgers/blueprints/toad_folk_male.blueprint.json`
- [x] Schema reference present and correct
- [x] ID is `dredgers:toad_folk_male`
- [x] Root is `dredgers:toad_folk_male_torso`
- [x] Composes `dredgers:amphibian_core` part
- [x] All 3 male-specific slots defined (penis, left_testicle, right_testicle)
- [x] All clothing slot mappings defined (8 overrides/additions plus inherited head_gear/face_gear/hands)
- [x] No pubic_hair in torso_lower mapping
- [x] `npm run validate` passes
- [x] `ermine_folk_female.blueprint.json` unchanged
- [x] No changes to any other files

## Outcome

- Created the toad_folk_male blueprint composing amphibian_core and adding male slots, with torso_lower override to remove pubic_hair per hairless spec.
- Clarified clothing mapping count (8 overrides/additions; head_gear/face_gear/hands remain inherited) and noted integration validation remains blocked until recipe/manifest tickets land.

## Dependencies

- **Blocks**: TOAFOLMALREC-006 (recipe references this blueprint)
- **Blocked By**:
  - TOAFOLMALREC-001 (needs amphibian_core.part.json)
  - TOAFOLMALREC-004 (needs toad_folk_male_torso.entity.json for root)
