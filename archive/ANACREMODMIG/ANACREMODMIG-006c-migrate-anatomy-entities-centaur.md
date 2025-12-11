# ANACREMODMIG-006c: Migrate Centaur Entity Definitions from anatomy Mod

**Status: ✅ COMPLETED** (2025-12-11)

## Summary
Move the 5 centaur-related entity definition files from `anatomy` to `anatomy-creatures` and update their IDs from `anatomy:*` to `anatomy-creatures:*`.

## Files to Touch

### Move (Copy + Delete Original)
| From | To |
|------|-----|
| `data/mods/anatomy/entities/definitions/centaur_head.entity.json` | `data/mods/anatomy-creatures/entities/definitions/centaur_head.entity.json` |
| `data/mods/anatomy/entities/definitions/centaur_leg_front.entity.json` | `data/mods/anatomy-creatures/entities/definitions/centaur_leg_front.entity.json` |
| `data/mods/anatomy/entities/definitions/centaur_leg_rear.entity.json` | `data/mods/anatomy-creatures/entities/definitions/centaur_leg_rear.entity.json` |
| `data/mods/anatomy/entities/definitions/centaur_torso.entity.json` | `data/mods/anatomy-creatures/entities/definitions/centaur_torso.entity.json` |
| `data/mods/anatomy/entities/definitions/centaur_upper_torso.entity.json` | `data/mods/anatomy-creatures/entities/definitions/centaur_upper_torso.entity.json` |

### Modify
- All 5 moved entity files - Update `id` field in each
- `data/mods/anatomy-creatures/mod-manifest.json` - Add to entities.definitions content array

## ID Changes Required

| File | Old ID | New ID |
|------|--------|--------|
| `centaur_head.entity.json` | `anatomy:centaur_head` | `anatomy-creatures:centaur_head` |
| `centaur_leg_front.entity.json` | `anatomy:centaur_leg_front` | `anatomy-creatures:centaur_leg_front` |
| `centaur_leg_rear.entity.json` | `anatomy:centaur_leg_rear` | `anatomy-creatures:centaur_leg_rear` |
| `centaur_torso.entity.json` | `anatomy:centaur_torso` | `anatomy-creatures:centaur_torso` |
| `centaur_upper_torso.entity.json` | `anatomy:centaur_upper_torso` | `anatomy-creatures:centaur_upper_torso` |

## Out of Scope
- DO NOT modify `anatomy/mod-manifest.json` yet (ANACREMODMIG-010)
- DO NOT modify blueprints/recipes that reference these entities yet (ANACREMODMIG-006h)
- DO NOT modify test files yet (ANACREMODMIG-012, ANACREMODMIG-013)

## Implementation Notes
- Only the `id` field at the top level of each entity needs updating
- All component data within entities remains unchanged
- Delete original files from anatomy after copying

## Acceptance Criteria

### Tests that must pass
- `npm run validate` passes
- `npm run typecheck` passes

### Invariants that must remain true
- Entity component structure is preserved exactly
- No component references are modified
- New mod not yet loaded, so existing tests still pass

## Verification Commands
```bash
# Validate JSON structure
npm run validate

# Verify files moved and IDs updated
for f in centaur_head centaur_leg_front centaur_leg_rear centaur_torso centaur_upper_torso; do
  echo "$f: $(cat "data/mods/anatomy-creatures/entities/definitions/${f}.entity.json" | grep '"id"' | head -1)"
done
```

## Dependencies
- ANACREMODMIG-001 (mod scaffold must exist)
- ANACREMODMIG-006a (structure templates including centauroid should be migrated)

## Blocks
- ANACREMODMIG-006h (anatomy blueprints/recipes reference these entities)
- ANACREMODMIG-010 (anatomy manifest update)
- ANACREMODMIG-013 (centaur-specific test updates)

---

## Outcome

**Completed: 2025-12-11**

### What Was Actually Changed

1. **Created 5 centaur entity files** in `data/mods/anatomy-creatures/entities/definitions/`:
   - `centaur_head.entity.json`
   - `centaur_leg_front.entity.json`
   - `centaur_leg_rear.entity.json`
   - `centaur_torso.entity.json`
   - `centaur_upper_torso.entity.json`

2. **Updated IDs** from `anatomy:*` to `anatomy-creatures:*` in all 5 files

3. **Updated `anatomy-creatures/mod-manifest.json`** to include the 5 new entity definitions in the `entities.definitions` content array

4. **Deleted original files** from `data/mods/anatomy/entities/definitions/`

### Verification Results

- `npm run validate`: ✅ PASSED (0 cross-reference violations)
- `npm run typecheck`: Pre-existing type errors unrelated to this migration (in `violationReporter.js` and `visualPropertiesValidator.js`)
- All 5 entity IDs verified to use `anatomy-creatures:` namespace

### Differences from Original Plan

**None** - Implementation matched the ticket scope exactly:
- 5 files moved and IDs updated as specified
- Manifest updated with new entity references
- Original files deleted
- No out-of-scope changes (anatomy manifest, blueprints/recipes, tests)

### New/Modified Tests

**No new tests created** - This ticket explicitly defers test updates to ANACREMODMIG-012 and ANACREMODMIG-013. The new mod is not yet loaded in game.json, so existing tests continue to pass.
