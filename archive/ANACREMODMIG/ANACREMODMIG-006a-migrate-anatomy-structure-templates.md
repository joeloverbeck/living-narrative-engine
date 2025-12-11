# ANACREMODMIG-006a: Migrate Structure Templates from anatomy Mod

**Status: ✅ COMPLETED** (2025-12-11)

## Summary
Move all 6 structure template files from `anatomy` to `anatomy-creatures` and update their IDs from `anatomy:*` to `anatomy-creatures:*`.

## Files to Touch

### Move (Copy + Delete Original)
| From | To |
|------|-----|
| `data/mods/anatomy/structure-templates/structure_arachnid_8leg.structure-template.json` | `data/mods/anatomy-creatures/structure-templates/structure_arachnid_8leg.structure-template.json` |
| `data/mods/anatomy/structure-templates/structure_centauroid.structure-template.json` | `data/mods/anatomy-creatures/structure-templates/structure_centauroid.structure-template.json` |
| `data/mods/anatomy/structure-templates/structure_eldritch_abomination.structure-template.json` | `data/mods/anatomy-creatures/structure-templates/structure_eldritch_abomination.structure-template.json` |
| `data/mods/anatomy/structure-templates/structure_octopoid.structure-template.json` | `data/mods/anatomy-creatures/structure-templates/structure_octopoid.structure-template.json` |
| `data/mods/anatomy/structure-templates/structure_tortoise_biped.structure-template.json` | `data/mods/anatomy-creatures/structure-templates/structure_tortoise_biped.structure-template.json` |
| `data/mods/anatomy/structure-templates/structure_winged_quadruped.structure-template.json` | `data/mods/anatomy-creatures/structure-templates/structure_winged_quadruped.structure-template.json` |

### Modify
- All 6 moved structure template files - Update `id` field in each
- `data/mods/anatomy-creatures/mod-manifest.json` - Add to structure-templates content array

## ID Changes Required

| File | Old ID | New ID |
|------|--------|--------|
| `structure_arachnid_8leg.structure-template.json` | `anatomy:structure_arachnid_8leg` | `anatomy-creatures:structure_arachnid_8leg` |
| `structure_centauroid.structure-template.json` | `anatomy:structure_centauroid` | `anatomy-creatures:structure_centauroid` |
| `structure_eldritch_abomination.structure-template.json` | `anatomy:structure_eldritch_abomination` | `anatomy-creatures:structure_eldritch_abomination` |
| `structure_octopoid.structure-template.json` | `anatomy:structure_octopoid` | `anatomy-creatures:structure_octopoid` |
| `structure_tortoise_biped.structure-template.json` | `anatomy:structure_tortoise_biped` | `anatomy-creatures:structure_tortoise_biped` |
| `structure_winged_quadruped.structure-template.json` | `anatomy:structure_winged_quadruped` | `anatomy-creatures:structure_winged_quadruped` |

## Out of Scope
- DO NOT modify `anatomy/mod-manifest.json` yet (ANACREMODMIG-010)
- DO NOT modify blueprints that reference these templates yet (ANACREMODMIG-006b)
- DO NOT modify any other files in anatomy mod

## Implementation Notes
- Structure templates define slot hierarchies and are referenced by blueprints
- ALL structure templates in anatomy mod are creature-specific (no humanoid templates exist)
- Only the `id` field at the top level needs updating
- Delete original files from anatomy after copying

## Acceptance Criteria

### Tests that must pass
- `npm run validate` passes
- `npm run typecheck` passes

### Invariants that must remain true
- Structure template slot definitions are preserved exactly
- No structural changes to template content
- New mod not yet loaded, so existing tests still pass

## Verification Commands
```bash
# Validate JSON structure
npm run validate

# Ensure no type regressions
npm run typecheck

# Verify files moved and IDs updated
for f in data/mods/anatomy-creatures/structure-templates/*.structure-template.json; do
  echo "$f: $(cat "$f" | grep '"id"' | head -1)"
done

# Verify originals deleted
ls data/mods/anatomy/structure-templates/ 2>&1 || echo "Directory empty or removed - GOOD"
```

## Dependencies
- ANACREMODMIG-001 (mod scaffold must exist)

## Blocks
- ANACREMODMIG-006b (anatomy blueprints reference these templates)
- ANACREMODMIG-010 (anatomy manifest update)

---

## Outcome

### What was Changed
1. **Created 6 new structure template files** in `data/mods/anatomy-creatures/structure-templates/`:
   - `structure_arachnid_8leg.structure-template.json`
   - `structure_centauroid.structure-template.json`
   - `structure_eldritch_abomination.structure-template.json`
   - `structure_octopoid.structure-template.json`
   - `structure_tortoise_biped.structure-template.json`
   - `structure_winged_quadruped.structure-template.json`

2. **Updated IDs** in all 6 files from `anatomy:*` to `anatomy-creatures:*`

3. **Deleted 6 original files** from `data/mods/anatomy/structure-templates/`

4. **Updated `data/mods/anatomy-creatures/mod-manifest.json`** to include the 6 structure templates in its `structure-templates` content array

### Verification Results
- ✅ `npm run validate` passes (0 cross-reference violations)
- ✅ `npm run typecheck` has only pre-existing errors (unrelated to this change)
- ✅ All 6 files exist in new location with updated IDs
- ✅ Original `data/mods/anatomy/structure-templates/` directory is now empty

### Notes
- The `anatomy-creatures` mod is not yet loaded in `game.json` (handled by ANACREMODMIG-009)
- Blueprints in `anatomy` still reference `anatomy:structure_*` IDs (handled by ANACREMODMIG-006b/006h)
- The anatomy mod manifest still lists these structure templates (handled by ANACREMODMIG-010)
- No tests were modified as specified in the ticket scope

### Tests Added/Modified
No tests were added or modified for this ticket. Test updates are handled by:
- ANACREMODMIG-013 (anatomy integration tests)
- ANACREMODMIG-014 (unit tests)
