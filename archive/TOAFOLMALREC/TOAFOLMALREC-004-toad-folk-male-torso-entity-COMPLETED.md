# TOAFOLMALREC-004: Create toad_folk_male_torso.entity.json

**Status**: COMPLETED

## Summary

Create the male toad-folk torso entity definition with all required anatomy sockets for a male humanoid body, following the established `human_male_torso.entity.json` pattern and the schema example in `specs/toad-folk-male-recipe.md`.

## Background

The torso is the root entity for the toad-folk male anatomy. It defines all sockets where other body parts attach (head, arms, legs, genitals, etc.). This entity is critical as it's referenced as the `root` in the blueprint.

**Key Characteristics**:
- Stocky build (heavier weight: 35 kg vs human's 32 kg)
- Male anatomy sockets (penis, testicles)
- No pubic_hair socket (toads are hairless)
- Bumpy skin texture (defined in recipe, not here)

**Spec Reference**: `specs/toad-folk-male-recipe.md` - Section "4. entities/definitions/toad_folk_male_torso.entity.json" (use the damage type modifiers and socket definitions as written there)

## Files to Create

| File | Description |
|------|-------------|
| `data/mods/dredgers/entities/definitions/toad_folk_male_torso.entity.json` | Male toad-folk torso entity |

## Files to Touch

- `data/mods/dredgers/entities/definitions/toad_folk_male_torso.entity.json` (CREATE)

## Out of Scope

- DO NOT modify `ermine_folk_female_torso.entity.json`
- DO NOT modify any existing entity files
- DO NOT modify the mod-manifest.json (handled in TOAFOLMALREC-007)
- DO NOT add body descriptor values (those go in the recipe, not the torso entity)

## Implementation Details

Create `data/mods/dredgers/entities/definitions/toad_folk_male_torso.entity.json` with:

### Required Components

1. **anatomy:damage_propagation**
   - Heart socket: 30% base probability, 50% damage fraction, damageTypeModifiers: piercing 1.5, blunt 0.3, slashing 0.8 (matches spec)
   - Spine socket: 20% base probability, 50% damage fraction, damageTypeModifiers: piercing 1.2, blunt 0.5, slashing 0.6 (matches spec)

2. **anatomy:part**
   - `subType`: "torso"
   - `hit_probability_weight`: 45
   - `health_calculation_weight`: 10

3. **anatomy:part_health**
   - `currentHealth`: 50
   - `maxHealth`: 50
   - `state`: "healthy"

4. **anatomy:sockets** - 15 sockets total (use allowedTypes/nameTpls from the spec example):
   - `neck` - for head/neck
   - `left_shoulder`, `right_shoulder` - for arms
   - `left_hip`, `right_hip` - for legs
   - `left_chest`, `right_chest` - for breasts (flat on males)
   - `penis` - for penis
   - `left_testicle`, `right_testicle` - for testicles
   - `asshole` - for asshole
   - `left_ass`, `right_ass` - for ass cheeks
   - `heart_socket` - for heart
   - `spine_socket` - for spine

5. **Description**
   - `description`: "A stocky toad-folk male torso with bumpy skin"

6. **anatomy:visibility_rules**
   - `clothingSlotId`: "torso_upper"
   - `nonBlockingLayers`: ["underwear", "accessories"]

7. **core:name**
   - `text`: "torso"

8. **core:weight**
   - `weight`: 35 (kg) - stocky build, heavier than human's 32 kg

### Socket Definitions (15 sockets)

Each socket needs:
- `id` - unique identifier
- `allowedTypes` - array of part types that can attach
- `nameTpl` - name template for the attached part
- `orientation` (optional) - "left" or "right" for paired sockets

### Key Differences from ermine_folk_female_torso

| Aspect | Ermine Folk Female | Toad Folk Male |
|--------|-------------------|----------------|
| Weight | ~30 kg | 35 kg (stocky) |
| Genitals | vagina socket | penis, testicle sockets |
| Pubic Hair | Yes | No (hairless) |

### Key Differences from human_male_torso

| Aspect | Human Male | Toad Folk Male |
|--------|-----------|----------------|
| Weight | 32 kg | 35 kg (stocky) |
| Pubic Hair | Yes | No (hairless) |
| Everything else | Same | Same |

## Acceptance Criteria

### Tests That Must Pass

1. **Schema Validation**:
   ```bash
   npm run validate
   ```
   - Entity must be valid against `entity-definition.schema.json`

2. **Component Schema Validation**: All components must validate:
   - `anatomy:damage_propagation` component schema
   - `anatomy:part` component schema
   - `anatomy:part_health` component schema
   - `anatomy:sockets` component schema
   - `anatomy:visibility_rules` component schema
   - `core:name` component schema
   - `core:weight` component schema

3. **Integration Test** (after all tickets complete):
   ```bash
   npm run validate:recipe -- --recipe dredgers:toad_folk_male_standard
   ```
   - Torso must be loadable as blueprint root

### Invariants That Must Remain True

1. **SubType Compatibility**: `subType` must be "torso" for anatomy system compatibility
2. **Existing Entities Unchanged**: `ermine_folk_female_torso.entity.json` must remain identical
3. **15 Sockets Required**: All 15 sockets must be present for male anatomy
4. **No Pubic Hair Socket**: The `pubic_hair` socket must NOT be present
5. **Valid Socket Types**: All `allowedTypes` must reference valid part subTypes
6. **Positive Health Values**: `currentHealth` and `maxHealth` must be positive integers
7. **Stocky Weight**: Weight must be 35 kg (heavier than standard 32 kg)

### Completion Checklist

- [x] File created at `data/mods/dredgers/entities/definitions/toad_folk_male_torso.entity.json`
- [x] Schema reference present and correct
- [x] ID is `dredgers:toad_folk_male_torso`
- [x] All 7 required components present
- [x] All 15 sockets defined (no pubic_hair)
- [x] Weight is 35 kg
- [x] Damage propagation rules for heart and spine (with spec damageTypeModifiers)
- [x] `npm run validate` passes
- [x] `ermine_folk_female_torso.entity.json` unchanged
- [x] No changes to any other files

## Dependencies

- **Blocks**: TOAFOLMALREC-005 (blueprint uses this as root)
- **Blocked By**: None (can be created in parallel with TOAFOLMALREC-001, 002, 003)

## Outcome

### What Was Actually Changed vs. Originally Planned

- Created `data/mods/dredgers/entities/definitions/toad_folk_male_torso.entity.json` matching the spec example, including damageTypeModifiers on heart/spine propagation and the bumpy-skin description.
- Preserved the no-`pubic_hair` socket requirement and set weight to 35 kg.

### Discrepancies Found and Resolved

- The ticket originally listed only piercing modifiers for damage propagation; the spec includes blunt and slashing modifiers, so the implementation follows the spec.

### Validation Results

- `npm run validate`: PASSED (ecosystem validation; unregistered-file notices remain expected until manifest updates in TOAFOLMALREC-007).
