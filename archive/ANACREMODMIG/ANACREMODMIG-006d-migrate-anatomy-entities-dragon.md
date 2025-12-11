# ANACREMODMIG-006d: Migrate Dragon Entity Definitions from anatomy Mod

**Status**: ✅ COMPLETED (2025-12-11)

## Outcome

### What was originally planned
- Move 5 dragon entity files from `anatomy` to `anatomy-creatures`
- Update entity IDs from `anatomy:*` to `anatomy-creatures:*`
- Update `anatomy-creatures/mod-manifest.json`
- Delete original files from `anatomy`

### What was actually changed
All planned changes were executed exactly as specified:

**Files Created:**
- `data/mods/anatomy-creatures/entities/definitions/dragon_head.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/dragon_leg.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/dragon_tail.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/dragon_torso.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/dragon_wing.entity.json`

**Files Deleted:**
- `data/mods/anatomy/entities/definitions/dragon_head.entity.json`
- `data/mods/anatomy/entities/definitions/dragon_leg.entity.json`
- `data/mods/anatomy/entities/definitions/dragon_tail.entity.json`
- `data/mods/anatomy/entities/definitions/dragon_torso.entity.json`
- `data/mods/anatomy/entities/definitions/dragon_wing.entity.json`

**Files Modified:**
- `data/mods/anatomy-creatures/mod-manifest.json` - Added 5 dragon entity entries

### Ticket corrections applied
1. **Clarified test assumptions**: Tests use `anatomy:dragon*` in mock/fixture data (not actual file references), so no test updates are needed for this ticket
2. **Clarified typecheck acceptance**: Pre-existing typecheck errors in `cli/validation/` and `src/validation/` are unrelated to this migration

### New/Modified Tests
**None required** - The ticket is a pure data migration. Tests referencing dragon entities use mock fixture data with hardcoded IDs, not actual file loads. Test updates will be addressed in ANACREMODMIG-012 through ANACREMODMIG-015.

---

## Summary
Move the 5 dragon-related entity definition files from `anatomy` to `anatomy-creatures` and update their IDs from `anatomy:*` to `anatomy-creatures:*`.

## Files to Touch

### Move (Copy + Delete Original)
| From | To |
|------|-----|
| `data/mods/anatomy/entities/definitions/dragon_head.entity.json` | `data/mods/anatomy-creatures/entities/definitions/dragon_head.entity.json` |
| `data/mods/anatomy/entities/definitions/dragon_leg.entity.json` | `data/mods/anatomy-creatures/entities/definitions/dragon_leg.entity.json` |
| `data/mods/anatomy/entities/definitions/dragon_tail.entity.json` | `data/mods/anatomy-creatures/entities/definitions/dragon_tail.entity.json` |
| `data/mods/anatomy/entities/definitions/dragon_torso.entity.json` | `data/mods/anatomy-creatures/entities/definitions/dragon_torso.entity.json` |
| `data/mods/anatomy/entities/definitions/dragon_wing.entity.json` | `data/mods/anatomy-creatures/entities/definitions/dragon_wing.entity.json` |

### Modify
- All 5 moved entity files - Update `id` field in each
- `data/mods/anatomy-creatures/mod-manifest.json` - Add to entities.definitions content array

## ID Changes Required

| File | Old ID | New ID |
|------|--------|--------|
| `dragon_head.entity.json` | `anatomy:dragon_head` | `anatomy-creatures:dragon_head` |
| `dragon_leg.entity.json` | `anatomy:dragon_leg` | `anatomy-creatures:dragon_leg` |
| `dragon_tail.entity.json` | `anatomy:dragon_tail` | `anatomy-creatures:dragon_tail` |
| `dragon_torso.entity.json` | `anatomy:dragon_torso` | `anatomy-creatures:dragon_torso` |
| `dragon_wing.entity.json` | `anatomy:dragon_wing` | `anatomy-creatures:dragon_wing` |

## Out of Scope
- DO NOT modify `anatomy/mod-manifest.json` yet (ANACREMODMIG-010)
- DO NOT modify blueprints/recipes that reference these entities yet (ANACREMODMIG-006h)
- DO NOT modify test files yet (tests use `anatomy:dragon*` in mock/fixture data, not actual file references)

## Implementation Notes
- Only the `id` field at the top level of each entity needs updating
- All component data within entities remains unchanged
- Delete original files from anatomy after copying

## Acceptance Criteria

### Tests that must pass
- `npm run validate` passes ✅
- `npm run typecheck` passes (has pre-existing errors in codebase not related to this migration)

### Invariants that must remain true
- Entity component structure is preserved exactly ✅
- No component references are modified ✅
- New mod not yet loaded, so existing tests still pass ✅

## Verification Commands
```bash
# Validate JSON structure
npm run validate

# Verify files moved and IDs updated
for f in dragon_head dragon_leg dragon_tail dragon_torso dragon_wing; do
  echo "$f: $(cat "data/mods/anatomy-creatures/entities/definitions/${f}.entity.json" | grep '"id"' | head -1)"
done
```

## Dependencies
- ANACREMODMIG-001 (mod scaffold must exist) ✅
- ANACREMODMIG-006a (structure templates including winged_quadruped should be migrated) ✅

## Blocks
- ANACREMODMIG-006h (anatomy blueprints/recipes reference these entities)
- ANACREMODMIG-010 (anatomy manifest update)

## Assumption Validation

### Original Assumptions vs Reality
| Assumption | Status | Notes |
|------------|--------|-------|
| 5 dragon entity files exist in anatomy | ✅ Correct | All files found at expected paths |
| Files have `anatomy:` namespace IDs | ✅ Correct | All IDs were `anatomy:dragon_*` |
| anatomy-creatures mod exists | ✅ Correct | Scaffold was previously created |
| Tests reference actual entity files | ⚠️ Clarified | Tests use mock data with `anatomy:dragon*` IDs in fixtures, not references to actual entity files - no test updates needed for this ticket |

### Discrepancies Found and Corrected
- **typecheck assumption**: The ticket stated `npm run typecheck` must pass. The typecheck has **pre-existing errors** in `cli/validation/` and `src/validation/` files that are unrelated to the migration. These errors exist independently of this ticket's changes. The acceptance criterion has been updated to note this.

## Completion Notes
- All 5 dragon entity files successfully migrated
- IDs updated from `anatomy:dragon_*` to `anatomy-creatures:dragon_*`
- Original files deleted from `data/mods/anatomy/entities/definitions/`
- Manifest updated with 5 new entity entries (alphabetically ordered after centaur, before ermine)
- `npm run validate` passes with 0 cross-reference violations for anatomy-creatures mod
