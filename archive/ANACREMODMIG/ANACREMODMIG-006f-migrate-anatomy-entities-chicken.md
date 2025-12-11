# ANACREMODMIG-006f: Migrate Chicken/Avian Entity Definitions from anatomy Mod

**Status**: ✅ COMPLETED (2025-12-11)

## Summary
Move all 27 chicken/avian-related entity definition files from `anatomy` to `anatomy-creatures` and update their IDs from `anatomy:*` to `anatomy-creatures:*`.

## Files to Touch

### Move (27 files)
| From | To |
|------|-----|
| `data/mods/anatomy/entities/definitions/chicken_beak.entity.json` | `data/mods/anatomy-creatures/entities/definitions/chicken_beak.entity.json` |
| `data/mods/anatomy/entities/definitions/chicken_brain.entity.json` | `data/mods/anatomy-creatures/entities/definitions/chicken_brain.entity.json` |
| `data/mods/anatomy/entities/definitions/chicken_comb.entity.json` | `data/mods/anatomy-creatures/entities/definitions/chicken_comb.entity.json` |
| `data/mods/anatomy/entities/definitions/chicken_comb_bantam.entity.json` | `data/mods/anatomy-creatures/entities/definitions/chicken_comb_bantam.entity.json` |
| `data/mods/anatomy/entities/definitions/chicken_comb_large_coarse.entity.json` | `data/mods/anatomy-creatures/entities/definitions/chicken_comb_large_coarse.entity.json` |
| `data/mods/anatomy/entities/definitions/chicken_eye_amber_concentric.entity.json` | `data/mods/anatomy-creatures/entities/definitions/chicken_eye_amber_concentric.entity.json` |
| `data/mods/anatomy/entities/definitions/chicken_foot.entity.json` | `data/mods/anatomy-creatures/entities/definitions/chicken_foot.entity.json` |
| `data/mods/anatomy/entities/definitions/chicken_head.entity.json` | `data/mods/anatomy-creatures/entities/definitions/chicken_head.entity.json` |
| `data/mods/anatomy/entities/definitions/chicken_head_chalky_white.entity.json` | `data/mods/anatomy-creatures/entities/definitions/chicken_head_chalky_white.entity.json` |
| `data/mods/anatomy/entities/definitions/chicken_head_rust_red.entity.json` | `data/mods/anatomy-creatures/entities/definitions/chicken_head_rust_red.entity.json` |
| `data/mods/anatomy/entities/definitions/chicken_head_twisted_joints.entity.json` | `data/mods/anatomy-creatures/entities/definitions/chicken_head_twisted_joints.entity.json` |
| `data/mods/anatomy/entities/definitions/chicken_heart.entity.json` | `data/mods/anatomy-creatures/entities/definitions/chicken_heart.entity.json` |
| `data/mods/anatomy/entities/definitions/chicken_leg.entity.json` | `data/mods/anatomy-creatures/entities/definitions/chicken_leg.entity.json` |
| `data/mods/anatomy/entities/definitions/chicken_spine.entity.json` | `data/mods/anatomy-creatures/entities/definitions/chicken_spine.entity.json` |
| `data/mods/anatomy/entities/definitions/chicken_spur.entity.json` | `data/mods/anatomy-creatures/entities/definitions/chicken_spur.entity.json` |
| `data/mods/anatomy/entities/definitions/chicken_tail.entity.json` | `data/mods/anatomy-creatures/entities/definitions/chicken_tail.entity.json` |
| `data/mods/anatomy/entities/definitions/chicken_tail_large_long.entity.json` | `data/mods/anatomy-creatures/entities/definitions/chicken_tail_large_long.entity.json` |
| `data/mods/anatomy/entities/definitions/chicken_torso.entity.json` | `data/mods/anatomy-creatures/entities/definitions/chicken_torso.entity.json` |
| `data/mods/anatomy/entities/definitions/chicken_wattle.entity.json` | `data/mods/anatomy-creatures/entities/definitions/chicken_wattle.entity.json` |
| `data/mods/anatomy/entities/definitions/chicken_wattle_bantam.entity.json` | `data/mods/anatomy-creatures/entities/definitions/chicken_wattle_bantam.entity.json` |
| `data/mods/anatomy/entities/definitions/chicken_wattle_large.entity.json` | `data/mods/anatomy-creatures/entities/definitions/chicken_wattle_large.entity.json` |
| `data/mods/anatomy/entities/definitions/chicken_wing.entity.json` | `data/mods/anatomy-creatures/entities/definitions/chicken_wing.entity.json` |
| `data/mods/anatomy/entities/definitions/chicken_wing_buff.entity.json` | `data/mods/anatomy-creatures/entities/definitions/chicken_wing_buff.entity.json` |
| `data/mods/anatomy/entities/definitions/chicken_wing_copper_metallic.entity.json` | `data/mods/anatomy-creatures/entities/definitions/chicken_wing_copper_metallic.entity.json` |
| `data/mods/anatomy/entities/definitions/chicken_wing_glossy_black_iridescent.entity.json` | `data/mods/anatomy-creatures/entities/definitions/chicken_wing_glossy_black_iridescent.entity.json` |
| `data/mods/anatomy/entities/definitions/chicken_wing_slate_blue.entity.json` | `data/mods/anatomy-creatures/entities/definitions/chicken_wing_slate_blue.entity.json` |
| `data/mods/anatomy/entities/definitions/chicken_wing_speckled.entity.json` | `data/mods/anatomy-creatures/entities/definitions/chicken_wing_speckled.entity.json` |

### Modify
- All 27 moved entity files - Update `id` field in each
- `data/mods/anatomy-creatures/mod-manifest.json` - Add to entities.definitions content array

## ID Changes Required
All IDs change from `anatomy:chicken_*` to `anatomy-creatures:chicken_*`

Example:
| Old ID | New ID |
|--------|--------|
| `anatomy:chicken_beak` | `anatomy-creatures:chicken_beak` |
| `anatomy:chicken_wing_glossy_black_iridescent` | `anatomy-creatures:chicken_wing_glossy_black_iridescent` |
| (etc. for all 27 files) | |

## Out of Scope
- DO NOT modify `anatomy/mod-manifest.json` yet (ANACREMODMIG-010)
- DO NOT modify blueprints/recipes that reference these entities yet (ANACREMODMIG-006h)
- DO NOT modify test files yet (ANACREMODMIG-014)

## Acceptance Criteria

### Tests that must pass
- `npm run validate` passes
- `npm run typecheck` passes

### Invariants that must remain true
- Entity component structure is preserved exactly
- No component references are modified
- All 27 chicken entities migrated
- New mod not yet loaded, so existing tests still pass

## Verification Commands
```bash
# Validate JSON structure
npm run validate

# Count chicken entities (should be 27)
ls data/mods/anatomy-creatures/entities/definitions/chicken_*.entity.json | wc -l

# Verify no old IDs remain
grep -l "anatomy:chicken" data/mods/anatomy-creatures/entities/definitions/chicken_*.entity.json || echo "No old IDs - GOOD"
```

## Dependencies
- ANACREMODMIG-001 (mod scaffold must exist)

## Blocks
- ANACREMODMIG-006h (anatomy blueprints/recipes reference these entities)
- ANACREMODMIG-010 (anatomy manifest update)
- ANACREMODMIG-014 (chicken test updates)

---

## Outcome

**Completed**: 2025-12-11

### What was planned
- Migrate 27 chicken entity files from `anatomy` to `anatomy-creatures`
- Update IDs from `anatomy:chicken_*` to `anatomy-creatures:chicken_*`
- Add entries to `anatomy-creatures/mod-manifest.json`

### What was actually changed
1. **Copied 27 chicken entity files** to `data/mods/anatomy-creatures/entities/definitions/`
2. **Updated all entity IDs** from `anatomy:` to `anatomy-creatures:` namespace
3. **Updated mod-manifest.json** to include all 27 chicken entity entries (alphabetically sorted between cat_* and centaur_* entries)

### Files Modified
- `data/mods/anatomy-creatures/mod-manifest.json` (+27 entity entries)

### Files Created
- 27 chicken entity files in `data/mods/anatomy-creatures/entities/definitions/chicken_*.entity.json`

### Verification
- ✅ `npm run validate` passes
- ✅ All 27 entities migrated with correct IDs
- ✅ No old `anatomy:chicken_*` IDs remain in migrated files
- ✅ Component structures preserved exactly
- ✅ Existing tests pass (original files still in anatomy mod per ticket scope)

### Notes
- Original files remain in `anatomy/` mod as intended - removal is deferred to ANACREMODMIG-010
- No tests modified per ticket scope - test updates deferred to ANACREMODMIG-014
- Typecheck has pre-existing errors in `visualPropertiesValidator.js` unrelated to this migration
