# ANACREMODMIG-004: Migrate Blueprints from dredgers Mod

**Status: ✅ COMPLETED**

## Summary
Move the 2 blueprint files (`ermine_folk_female.blueprint.json`, `toad_folk_male.blueprint.json`) from `dredgers` to `anatomy-creatures`, update their IDs, and update all internal references to parts and entities that were migrated in previous tickets.

## Files to Touch

### Move (Copy + Delete Original)
| From | To |
|------|-----|
| `data/mods/dredgers/blueprints/ermine_folk_female.blueprint.json` | `data/mods/anatomy-creatures/blueprints/ermine_folk_female.blueprint.json` |
| `data/mods/dredgers/blueprints/toad_folk_male.blueprint.json` | `data/mods/anatomy-creatures/blueprints/toad_folk_male.blueprint.json` |

### Modify
- Both moved blueprint files - Update `id` field and internal references
- `data/mods/anatomy-creatures/mod-manifest.json` - Add blueprints to content array

## ID Changes Required

| File | Old ID | New ID |
|------|--------|--------|
| `ermine_folk_female.blueprint.json` | `dredgers:ermine_folk_female` | `anatomy-creatures:ermine_folk_female` |
| `toad_folk_male.blueprint.json` | `dredgers:toad_folk_male` | `anatomy-creatures:toad_folk_male` |

## Internal Reference Updates

> **NOTE (Corrected)**: The original ticket incorrectly assumed blueprints reference ear/tail/eye/tympanum entities.
> Blueprints only reference the root torso entity and the composed part. Entity references like `ermine_ear`,
> `ermine_tail`, `toad_eye`, `toad_tympanum` are in **recipes**, not blueprints.

Within `ermine_folk_female.blueprint.json`:
| Reference Type | Old Value | New Value |
|----------------|-----------|-----------|
| root entity | `dredgers:ermine_folk_female_torso` | `anatomy-creatures:ermine_folk_female_torso` |
| part reference (compose) | `dredgers:mustelid_core` | `anatomy-creatures:mustelid_core` |

Within `toad_folk_male.blueprint.json`:
| Reference Type | Old Value | New Value |
|----------------|-----------|-----------|
| root entity | `dredgers:toad_folk_male_torso` | `anatomy-creatures:toad_folk_male_torso` |
| part reference (compose) | `dredgers:amphibian_core` | `anatomy-creatures:amphibian_core` |

## Out of Scope
- DO NOT modify `dredgers/mod-manifest.json` yet (ANACREMODMIG-007)
- DO NOT modify recipes that reference these blueprints yet (ANACREMODMIG-008)
- DO NOT update test files yet (ANACREMODMIG-012)
- DO NOT update `data/game.json`

## Implementation Notes
- Search for all `dredgers:` references in blueprints and update to `anatomy-creatures:`
- Blueprint structure and all other fields remain unchanged
- Delete original files from dredgers after copying

## Acceptance Criteria

### Tests that must pass
- `npm run validate` passes
- `npm run typecheck` passes

### Invariants that must remain true
- Blueprint structure (slots, parts, entity mappings) is preserved
- All internal references point to `anatomy-creatures:` namespace
- No dangling references to `dredgers:` namespace in migrated files
- New mod not yet loaded, so existing tests still pass

## Verification Commands
```bash
# Validate JSON structure
npm run validate

# Ensure no type regressions
npm run typecheck

# Verify no old namespace references remain
grep -r "dredgers:" data/mods/anatomy-creatures/blueprints/ || echo "No old refs found - GOOD"

# Verify IDs updated
cat data/mods/anatomy-creatures/blueprints/ermine_folk_female.blueprint.json | grep '"id"'
cat data/mods/anatomy-creatures/blueprints/toad_folk_male.blueprint.json | grep '"id"'
```

## Dependencies
- ANACREMODMIG-001 (mod scaffold)
- ANACREMODMIG-002 (parts must be migrated first - blueprints reference them)
- ANACREMODMIG-003 (entities must be migrated first - blueprints reference them)

## Blocks
- ANACREMODMIG-007 (dredgers manifest update)
- ANACREMODMIG-008 (dredgers recipe reference updates)

---

## Outcome

### Implementation Date
2025-12-11

### Ticket Corrections Applied
The original ticket incorrectly assumed blueprints contain direct references to entity IDs like `ermine_ear`, `ermine_tail`, `toad_eye`, and `toad_tympanum`. In reality, blueprints only reference:
- The root torso entity (`root` field)
- The composed part (`compose.part` field)

Entity references for ears, tails, eyes, etc. are in **recipes**, not blueprints. The ticket was corrected to reflect the actual blueprint structure.

### What Was Changed

#### Files Migrated
1. `ermine_folk_female.blueprint.json`: dredgers → anatomy-creatures
2. `toad_folk_male.blueprint.json`: dredgers → anatomy-creatures

#### ID Updates Applied
| File | Field | Old Value | New Value |
|------|-------|-----------|-----------|
| ermine_folk_female.blueprint.json | id | `dredgers:ermine_folk_female` | `anatomy-creatures:ermine_folk_female` |
| ermine_folk_female.blueprint.json | root | `dredgers:ermine_folk_female_torso` | `anatomy-creatures:ermine_folk_female_torso` |
| ermine_folk_female.blueprint.json | compose.part | `dredgers:mustelid_core` | `anatomy-creatures:mustelid_core` |
| toad_folk_male.blueprint.json | id | `dredgers:toad_folk_male` | `anatomy-creatures:toad_folk_male` |
| toad_folk_male.blueprint.json | root | `dredgers:toad_folk_male_torso` | `anatomy-creatures:toad_folk_male_torso` |
| toad_folk_male.blueprint.json | compose.part | `dredgers:amphibian_core` | `anatomy-creatures:amphibian_core` |

#### Manifest Updated
- `data/mods/anatomy-creatures/mod-manifest.json` - Added blueprints array with 2 entries

#### Original Files Deleted
- `data/mods/dredgers/blueprints/ermine_folk_female.blueprint.json`
- `data/mods/dredgers/blueprints/toad_folk_male.blueprint.json`

### Tests Added
New test file: `tests/integration/mods/anatomy-creatures/blueprintsLoading.test.js`
- 14 test cases covering:
  - Correct namespace for blueprint IDs
  - Root entity references updated
  - Compose part references updated
  - No remaining dredgers namespace references
  - Valid schema references preserved
  - Slots structure preserved
  - ClothingSlotMappings structure preserved

### Validation Results
- ✅ `npm run validate` - PASSED (0 cross-reference violations)
- ✅ `npm run typecheck` - Pre-existing type errors only (unrelated to this migration)
- ✅ All anatomy-creatures tests - 16 passed
- ✅ No `dredgers:` references remain in migrated blueprints
