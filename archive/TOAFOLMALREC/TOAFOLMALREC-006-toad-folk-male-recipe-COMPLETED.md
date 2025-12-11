# TOAFOLMALREC-006: Create toad_folk_male.recipe.json

**Status**: COMPLETED

## Summary

Create the missing recipe file that assembles all toad-folk male body parts with specific entity assignments and body descriptors. The blueprint (`dredgers:toad_folk_male`), torso, tympanum, and eye entities already exist in the repo; only the recipe file is absent.

## Background

The recipe is the top-level definition that:
1. References the blueprint for structural definition (`blueprintId`)
2. Specifies optional `bodyDescriptors` (height, skinColor, build, etc.)
3. Assigns specific entity definitions to each anatomical slot via `slots`/`patterns`

The character `cress_siltwell.character.json` references `dredgers:toad_folk_male_standard` which this recipe provides.

**Spec Reference**: `specs/toad-folk-male-recipe.md` - Section "6. recipes/toad_folk_male.recipe.json"

## Files to Create

| File | Description |
|------|-------------|
| `data/mods/dredgers/recipes/toad_folk_male.recipe.json` | Complete toad-folk male recipe (the only missing asset; all dependencies are already present) |

## Files to Touch

- `data/mods/dredgers/recipes/toad_folk_male.recipe.json` (CREATE)

## Out of Scope

- DO NOT modify `ermine_folk_female.recipe.json`
- DO NOT modify any other existing recipe files
- Update `data/mods/dredgers/mod-manifest.json` only to register the toad-folk male assets (part, entities, blueprint, and this recipe) so validation can load them; broader manifest work remains in TOAFOLMALREC-007
- DO NOT modify `cress_siltwell.character.json` (it already references this recipe ID)

## Implementation Details

Create `data/mods/dredgers/recipes/toad_folk_male.recipe.json` using the **existing anatomy recipe schema**, which expects `recipeId`, `blueprintId`, and a `slots` map (with `partType` and optional `preferId`).

### Required Properties

1. **Schema Reference**: `"$schema": "schema://living-narrative-engine/anatomy.recipe.schema.json"`
2. **recipeId**: `"dredgers:toad_folk_male_standard"` (this exact ID is referenced by Cress Siltwell)
3. **blueprintId**: `"dredgers:toad_folk_male"`
4. **bodyDescriptors**: Optional but include the six descriptors below

### Body Descriptors (aligned to allowed enum values)

These are supported by the schema:

| Descriptor | Value | Rationale |
|------------|-------|-----------|
| height | "average" | Standard humanoid height |
| skinColor | "olive" | Mottled green-brown tones |
| build | "stocky" | Squat, sturdy toad frame |
| composition | "bumpy" | Warty skin texture for toad-folk (now allowed in schema) |
| hairDensity | "hairless" | Toads have no hair |
| smell | "earthy" | Muddy, earthy scent |

### Slot Assignments (26 slots)

Define the 26 expected slots using `slots` (and `patterns` where convenient) with `partType` plus `preferId`:

#### Toad-Specific Parts (4 slots)
- `torso`: partType `torso`, prefer `dredgers:toad_folk_male_torso`
- `left_eye` / `right_eye`: partType `eye`, prefer `dredgers:toad_eye`
- `left_ear` / `right_ear`: partType `ear`, prefer `dredgers:toad_tympanum`

#### Shared Humanoid Parts (22 slots)
- `head`: partType `head`, prefer `anatomy:humanoid_head`
- `nose`: partType `nose`, prefer `anatomy:humanoid_nose`
- `mouth`: partType `mouth`, prefer `anatomy:humanoid_mouth`
- `teeth`: partType `teeth`, prefer `anatomy:humanoid_teeth`
- `left_arm`, `right_arm`: partType `arm`, prefer `anatomy:humanoid_arm`
- `left_hand`, `right_hand`: partType `hand`, prefer `anatomy:human_hand`
- `left_leg`, `right_leg`: partType `leg`, prefer `anatomy:human_leg`
- `left_foot`, `right_foot`: partType `foot`, prefer `anatomy:human_foot`
- `penis`: partType `penis`, prefer `anatomy:human_penis`
- `left_testicle`, `right_testicle`: partType `testicle`, prefer `anatomy:human_testicle`
- `asshole`: partType `asshole`, prefer `anatomy:human_asshole`
- `left_ass`, `right_ass`: partType `ass_cheek`, prefer `anatomy:human_ass_cheek`
- `heart`: partType `heart`, prefer `anatomy:human_heart`
- `spine`: partType `spine`, prefer `anatomy:human_spine`
- `brain`: partType `brain`, prefer `anatomy:human_brain`

### Key Differences from ermine_folk_female.recipe

| Aspect | Ermine Folk Female | Toad Folk Male |
|--------|-------------------|----------------|
| Recipe ID | dredgers:ermine_folk_female | dredgers:toad_folk_male_standard |
| Blueprint | dredgers:ermine_folk_female | dredgers:toad_folk_male |
| Eyes | anatomy:humanoid_eye | dredgers:toad_eye |
| Ears | dredgers:ermine_ear | dredgers:toad_tympanum |
| Genitals | vagina, labia, clitoris | penis, testicles |
| Tail | dredgers:ermine_tail | None |
| Pubic Hair | anatomy:humanoid_pubic_hair | None |
| hairDensity | "fur" | "hairless" |
| composition | "soft" | "bumpy" (texture handled via part descriptors) |

## Acceptance Criteria

### Tests That Must Pass

1. **Recipe Validation (primary acceptance)**:
   ```bash
   npm run validate:recipe -- data/mods/dredgers/recipes/toad_folk_male.recipe.json
   ```
   - Uses the recipe schema (`recipeId`, `slots`, `patterns`)
   - Verifies descriptor coverage, socket compatibility, and referenced entities/blueprint availability (requires manifest registration)

2. **Schema/Mod Sanity (quick pass)**:
   ```bash
   npm run validate:quick
   ```
   - Light-weight mod validation without cross-mod dependency checks; ensures manifest references stay consistent

3. **Character Load Test** (manual, optional but recommended):
   - Start the game
   - Verify Cress Siltwell character loads without errors using `dredgers:toad_folk_male_standard`
   - Verify anatomy visualizer shows correct toad-folk male anatomy

### Invariants That Must Remain True

1. **Exact Recipe ID**: `recipeId` must be `dredgers:toad_folk_male_standard` (matches character reference)
2. **Existing Recipe Unchanged**: `ermine_folk_female.recipe.json` must remain identical
3. **All 6 Body Descriptors**: All descriptors present with schema-allowed values
4. **All 26 Slot Assignments**: Every slot has `partType` plus a valid `preferId`
5. **Valid Entity References**: All `preferId` values reference existing entities (already present in repo)
6. **Blueprint Reference**: Uses existing `dredgers:toad_folk_male` (must be registered in manifest)
7. **No Hair Slots**: Do NOT assign pubic_hair or tail slots (blueprint/torso omit them)

### Completion Checklist

- [x] File created at `data/mods/dredgers/recipes/toad_folk_male.recipe.json`
- [x] `$schema` present and correct
- [x] `recipeId` is exactly `dredgers:toad_folk_male_standard`
- [x] Blueprint is `dredgers:toad_folk_male`
- [x] All 6 body descriptors present with schema-valid values
- [x] All 26 slot assignments include `partType` with valid entity references
- [x] Toad-specific entities used for torso, eyes, and ears
- [x] Manifest registers the toad-folk male part, entities, blueprint, and recipe
- [x] `npm run validate:recipe -- data/mods/dredgers/recipes/toad_folk_male.recipe.json` passes
- [x] `npm run validate:quick` passes
- [x] `ermine_folk_female.recipe.json` unchanged
- [x] No unrelated files changed

## Outcome

- Created schema-compliant `data/mods/dredgers/recipes/toad_folk_male.recipe.json` with six body descriptors and 26 slot assignments using existing entity IDs.
- Registered toad-folk part, entities, blueprint, and recipe in `data/mods/dredgers/mod-manifest.json` so validators can resolve dependencies (previously assumed out of scope).
- Aligned slot preferences to existing human* entity IDs for shared humanoid anatomy and used schema-valid `composition: "bumpy"` (texture handled on parts).

## Dependencies

- **Blocks**: TOAFOLMALREC-007 (further manifest hardening/automation)
- **Prereqs**: Already present in repo — `toad_eye.entity.json`, `toad_tympanum.entity.json`, `toad_folk_male_torso.entity.json`, `toad_folk_male.blueprint.json`, and `amphibian_core.part.json`; register them in manifest here to satisfy validation
