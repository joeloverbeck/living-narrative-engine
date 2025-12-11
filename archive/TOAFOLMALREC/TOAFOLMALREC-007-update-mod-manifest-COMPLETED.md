# TOAFOLMALREC-007: Update mod-manifest.json

**Status**: COMPLETED

## Summary

Verify the dredgers mod manifest still registers every toad-folk asset and correct the ticket’s validation instructions. The manifest already matches the target state from `specs/toad-folk-male-recipe.md`; no additional entries are needed.

## Background

The mod manifest (`mod-manifest.json`) is the registry of all content in a mod. Without proper registration, content files won't be loaded even if they exist in the correct directories.

**Assumptions Reassessed**
- The manifest already includes the toad-folk part, entities, blueprint, and recipe listed in the spec; the work is validation, not new edits.
- The recipe validator CLI accepts recipe file paths as positional args, not a `--recipe` flag. Use the file path for validation.

**Spec Reference**: `specs/toad-folk-male-recipe.md` - Section "7. mod-manifest.json Update"

## Files Reviewed

| File | Action |
|------|--------|
| `data/mods/dredgers/mod-manifest.json` | VERIFY (remains aligned with spec) |

## Out of Scope

- DO NOT modify any other mod manifests
- DO NOT add/remove dependencies
- DO NOT change the mod ID, version, or other metadata
- DO NOT remove any existing content registrations
- DO NOT create any new content files (already present)

## Implementation Details

### Current State (observed)

`data/mods/dredgers/mod-manifest.json` already contains:
- `entities.definitions`: `cress_siltwell.character.json`, `eira_quenreach.character.json`, `ermine_ear.entity.json`, `ermine_folk_female_torso.entity.json`, `ermine_tail.entity.json`, `toad_eye.entity.json`, `toad_tympanum.entity.json`, `toad_folk_male_torso.entity.json`
- `entities.instances`: `eira_quenreach.character.json`
- `blueprints`: `ermine_folk_female.blueprint.json`, `toad_folk_male.blueprint.json`
- `parts`: `mustelid_core.part.json`, `amphibian_core.part.json`
- `recipes`: `ermine_folk_female.recipe.json`, `toad_folk_male.recipe.json`
- `portraits`: `eira_quenreach.png`

### Required Outcome

- Keep the manifest exactly aligned with the spec above; no new entries required.
- Confirm JSON validity and schema compliance.

## Acceptance Criteria

### Tests That Must Pass

1. **Schema Validation**:
   ```bash
   npm run validate
   ```
   - Manifest must be valid against `mod-manifest.schema.json`

2. **Full Recipe Validation** (final acceptance test):
   ```bash
   npm run validate:recipe -- data/mods/dredgers/recipes/toad_folk_male.recipe.json
   ```
   - All validators must pass
   - Recipe must be marked as "used" (recipe_usage validator)

3. **Content Loading Test** (manual):
   - Start the game
   - Verify Cress Siltwell character loads without errors
   - Verify all toad-folk entities, parts, blueprints, and recipes are loaded

4. **Existing Content Test**:
   - Verify Eira Quenreach (ermine folk) still loads correctly
   - No regressions in existing dredgers mod content

### Invariants That Must Remain True

1. **Existing Entries Preserved**: All current entries must remain in place
2. **No Duplicate Entries**: Each file should appear exactly once
3. **Correct Array Placement**: Each file type in its correct array
4. **Valid JSON**: Manifest must remain valid JSON after editing
5. **Schema Compliance**: Manifest must validate against mod-manifest schema
6. **File Existence**: All registered files must exist in the correct directories

### Completion Checklist

- [x] `entities.definitions` contains the 3 toad-folk additions (8 total entries)
- [x] `blueprints` lists `toad_folk_male.blueprint.json`
- [x] `parts` lists `amphibian_core.part.json`
- [x] `recipes` lists `toad_folk_male.recipe.json`
- [x] All existing entries preserved
- [x] No duplicate entries
- [x] Valid JSON format
- [x] `npm run validate` passes
- [x] `npm run validate:recipe -- data/mods/dredgers/recipes/toad_folk_male.recipe.json` passes
- [ ] Cress Siltwell character loads in game (manual)

## Dependencies

- **Blocks**: None (final ticket)
- **Blocked By**: All previous tickets must be completed:
  - TOAFOLMALREC-001 (amphibian_core.part.json)
  - TOAFOLMALREC-002 (toad_eye.entity.json)
  - TOAFOLMALREC-003 (toad_tympanum.entity.json)
  - TOAFOLMALREC-004 (toad_folk_male_torso.entity.json)
  - TOAFOLMALREC-005 (toad_folk_male.blueprint.json)
  - TOAFOLMALREC-006 (toad_folk_male.recipe.json)

## Verification Command Sequence

After completing this ticket, run these commands in order:

```bash
# 1. Basic validation
npm run validate

# 2. Full recipe validation (pass recipe file path, no --recipe flag)
npm run validate:recipe -- data/mods/dredgers/recipes/toad_folk_male.recipe.json

# 3. Start game and verify character loads
npm run start
```

All three steps must pass for the feature to be considered complete.

## Outcome

- Verified `data/mods/dredgers/mod-manifest.json` already contains the toad-folk entities, part, blueprint, and recipe described in the spec—no edits required.
- Corrected the validation instructions to use the recipe file path (the CLI does not support a `--recipe` flag).
- Confirmed `npm run validate` and `npm run validate:recipe -- data/mods/dredgers/recipes/toad_folk_male.recipe.json` both pass.
