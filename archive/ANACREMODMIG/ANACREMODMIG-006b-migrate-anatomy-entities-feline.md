# ANACREMODMIG-006b: Migrate Feline Entity Definitions from anatomy Mod

## Status: ✅ COMPLETED

## Summary
Move the 7 feline-related entity definition files from `anatomy` to `anatomy-creatures` and update their IDs from `anatomy:*` to `anatomy-creatures:*`.

## Files to Touch

### Move (Copy + Delete Original)
| From | To |
|------|-----|
| `data/mods/anatomy/entities/definitions/cat_ear.entity.json` | `data/mods/anatomy-creatures/entities/definitions/cat_ear.entity.json` |
| `data/mods/anatomy/entities/definitions/cat_ear_decorated.entity.json` | `data/mods/anatomy-creatures/entities/definitions/cat_ear_decorated.entity.json` |
| `data/mods/anatomy/entities/definitions/cat_tail.entity.json` | `data/mods/anatomy-creatures/entities/definitions/cat_tail.entity.json` |
| `data/mods/anatomy/entities/definitions/cat_girl_torso.entity.json` | `data/mods/anatomy-creatures/entities/definitions/cat_girl_torso.entity.json` |
| `data/mods/anatomy/entities/definitions/feline_eye_abyssal_black_glow.entity.json` | `data/mods/anatomy-creatures/entities/definitions/feline_eye_abyssal_black_glow.entity.json` |
| `data/mods/anatomy/entities/definitions/feline_eye_ice_blue_slit.entity.json` | `data/mods/anatomy-creatures/entities/definitions/feline_eye_ice_blue_slit.entity.json` |
| `data/mods/anatomy/entities/definitions/feline_eye_amber_slit.entity.json` | `data/mods/anatomy-creatures/entities/definitions/feline_eye_amber_slit.entity.json` |

### Modify
- All 7 moved entity files - Update `id` field in each
- `data/mods/anatomy-creatures/mod-manifest.json` - Add to entities.definitions content array

## ID Changes Required

| File | Old ID | New ID |
|------|--------|--------|
| `cat_ear.entity.json` | `anatomy:cat_ear` | `anatomy-creatures:cat_ear` |
| `cat_ear_decorated.entity.json` | `anatomy:cat_ear_decorated` | `anatomy-creatures:cat_ear_decorated` |
| `cat_tail.entity.json` | `anatomy:cat_tail` | `anatomy-creatures:cat_tail` |
| `cat_girl_torso.entity.json` | `anatomy:cat_girl_torso` | `anatomy-creatures:cat_girl_torso` |
| `feline_eye_abyssal_black_glow.entity.json` | `anatomy:feline_eye_abyssal_black_glow` | `anatomy-creatures:feline_eye_abyssal_black_glow` |
| `feline_eye_ice_blue_slit.entity.json` | `anatomy:feline_eye_ice_blue_slit` | `anatomy-creatures:feline_eye_ice_blue_slit` |
| `feline_eye_amber_slit.entity.json` | `anatomy:feline_eye_amber_slit` | `anatomy-creatures:feline_eye_amber_slit` |

## Out of Scope
- DO NOT modify `anatomy/mod-manifest.json` yet (ANACREMODMIG-010)
- DO NOT modify blueprints/recipes that reference these entities yet (ANACREMODMIG-006h)
- DO NOT modify test files yet (ANACREMODMIG-012)
- DO NOT move humanoid entities - they stay in anatomy mod

## Implementation Notes
- Only the `id` field at the top level of each entity needs updating
- All component data within entities remains unchanged
- Delete original files from anatomy after copying

## Acceptance Criteria

### Tests that must pass
- `npm run validate` passes
- `npm run typecheck` passes (pre-existing errors unrelated to this migration are acceptable)

### Invariants that must remain true
- Entity component structure is preserved exactly
- No component references are modified

### Known Test Impacts (deferred to ANACREMODMIG-012)
The following test will fail after this migration because it directly reads files from the filesystem:
- `tests/integration/mods/anatomy/creatureWeightValidation.test.js` - This test hardcodes the path `data/mods/anatomy/entities/definitions` and validates Cat/Feline entities. After migration, it will fail because the files are now in `anatomy-creatures`. This is expected and will be fixed in ANACREMODMIG-012.

The original assumption "New mod not yet loaded, so existing tests still pass" was incorrect because `creatureWeightValidation.test.js` bypasses the mod loading system entirely.

## Verification Commands
```bash
# Validate JSON structure
npm run validate

# Verify files moved and IDs updated
for f in cat_ear cat_ear_decorated cat_tail cat_girl_torso feline_eye_abyssal_black_glow feline_eye_ice_blue_slit feline_eye_amber_slit; do
  echo "$f: $(cat "data/mods/anatomy-creatures/entities/definitions/${f}.entity.json" | grep '"id"' | head -1)"
done
```

## Dependencies
- ANACREMODMIG-001 (mod scaffold must exist)
- ANACREMODMIG-005 (feline_core part should be migrated first)

## Blocks
- ANACREMODMIG-006h (anatomy blueprints/recipes reference these entities)
- ANACREMODMIG-010 (anatomy manifest update)

---

## Outcome

### What Was Changed (vs Originally Planned)

**Completed as planned:**
- ✅ All 7 feline entity files migrated from `anatomy` to `anatomy-creatures`
- ✅ Entity IDs updated from `anatomy:*` to `anatomy-creatures:*`
- ✅ `anatomy-creatures/mod-manifest.json` updated with 7 new entity entries
- ✅ Original files deleted from `anatomy` mod
- ✅ `npm run validate` passes (0 cross-reference violations)
- ✅ `npm run typecheck` passes (pre-existing errors only, none related to migration)

**Discrepancy Found and Documented:**
- Original ticket assumed "New mod not yet loaded, so existing tests still pass"
- Discovered: `creatureWeightValidation.test.js` bypasses mod loading system and reads files directly from filesystem
- Test now fails as expected (ENOENT errors for moved feline files)
- Updated ticket to document this as "Known Test Impacts" deferred to ANACREMODMIG-013
- Updated ANACREMODMIG-013 with specific fix guidance for this test file

**No Additional Tests Required:**
- The test failure is expected behavior (files moved)
- Fix is correctly scoped to ANACREMODMIG-013 (anatomy integration test updates)
- No edge cases exposed that require new tests within this ticket's scope

### Verification Results
```
npm run validate: PASSED
  - 61 mods validated
  - 0 cross-reference violations
  - 0 missing files

creatureWeightValidation.test.js: FAILS (expected)
  - 7 ENOENT errors for feline files
  - Deferred to ANACREMODMIG-013
```
