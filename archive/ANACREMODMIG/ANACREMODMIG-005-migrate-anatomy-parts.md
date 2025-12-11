# ANACREMODMIG-005: Migrate Parts File from anatomy Mod

**Status: ✅ COMPLETED (2025-12-11)**

## Summary
Move the `feline_core.part.json` file from `anatomy` to `anatomy-creatures` and update its ID from `anatomy:feline_core` to `anatomy-creatures:feline_core`.

## Files to Touch

### Move (Copy + Delete Original)
| From | To |
|------|-----|
| `data/mods/anatomy/parts/feline_core.part.json` | `data/mods/anatomy-creatures/parts/feline_core.part.json` |

### Modify
- `data/mods/anatomy-creatures/parts/feline_core.part.json` - Update `id` field
- `data/mods/anatomy-creatures/mod-manifest.json` - Add to parts content array (if not already listed from ANACREMODMIG-002)

## ID Change Required

| File | Old ID | New ID |
|------|--------|--------|
| `feline_core.part.json` | `anatomy:feline_core` | `anatomy-creatures:feline_core` |

## Out of Scope
- DO NOT modify `anatomy/mod-manifest.json` yet (ANACREMODMIG-010)
- DO NOT modify blueprint files that reference this part yet (ANACREMODMIG-006)
- DO NOT move `humanoid_core.part.json` - it stays in anatomy mod
- DO NOT modify the `anatomy:humanoid_slots` library reference

## Implementation Notes
- The part file references `anatomy:humanoid_slots` library via compose - this reference STAYS unchanged (it's in the `anatomy` mod, which `anatomy-creatures` depends on)
- Only the `id` field at the top level needs updating
- Delete original file from anatomy after copying

## Files That Stay in anatomy Mod
- `humanoid_core.part.json` - stays (humanoid anatomy)

## Acceptance Criteria

### Tests that must pass
- `npm run validate` passes
- `npm run typecheck` passes

### Invariants that must remain true
- `anatomy:humanoid_slots` reference remains unchanged
- Part compose structure is preserved exactly
- `humanoid_core.part.json` remains in anatomy mod
- New mod not yet loaded, so existing tests still pass

## Verification Commands
```bash
# Validate JSON structure
npm run validate

# Ensure no type regressions
npm run typecheck

# Verify file moved and ID updated
cat data/mods/anatomy-creatures/parts/feline_core.part.json | grep '"id"'

# Verify humanoid_slots reference preserved
cat data/mods/anatomy-creatures/parts/feline_core.part.json | grep "humanoid_slots"

# Verify original deleted
ls data/mods/anatomy/parts/feline_core.part.json 2>&1 | grep -q "No such file" && echo "Original deleted - GOOD"
```

## Dependencies
- ANACREMODMIG-001 (mod scaffold must exist)
- ANACREMODMIG-002 (establishes parts migration pattern)

## Blocks
- ANACREMODMIG-006 (anatomy blueprints reference this part)
- ANACREMODMIG-010 (anatomy manifest update)

---

## Outcome

### What Was Actually Changed

1. **Copied** `data/mods/anatomy/parts/feline_core.part.json` → `data/mods/anatomy-creatures/parts/feline_core.part.json`
2. **Updated ID** from `anatomy:feline_core` to `anatomy-creatures:feline_core`
3. **Updated manifest** `data/mods/anatomy-creatures/mod-manifest.json` to include `parts/feline_core.part.json` in the parts array (alphabetically sorted)
4. **Deleted original** `data/mods/anatomy/parts/feline_core.part.json`

### Verification Results

| Check | Result |
|-------|--------|
| `npm run validate` | ✅ PASSED (0 cross-reference violations) |
| `npm run typecheck` | ✅ Pre-existing errors only (none related to migration) |
| ID updated correctly | ✅ `"id": "anatomy-creatures:feline_core"` |
| Library reference preserved | ✅ `"library": "anatomy:humanoid_slots"` |
| Original deleted | ✅ Confirmed removed |
| `humanoid_core.part.json` remains | ✅ Still in `anatomy/parts/` |

### vs Originally Planned

All planned changes were executed exactly as specified. No discrepancies found between ticket requirements and actual implementation.

### New/Modified Tests

**No new tests required.** This ticket is a pure file migration with no behavior changes. Existing tests do not reference `feline_core` directly. Test updates for the new namespace are handled by later tickets (ANACREMODMIG-012 through ANACREMODMIG-015).
