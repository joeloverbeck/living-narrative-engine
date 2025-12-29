# VIOMIG-012: Update game.json and Remove Old Violence Mod

**Status**: Open
**Type**: Cleanup
**Priority**: High

## Summary

Final cleanup ticket: update `data/game.json` to replace the `violence` mod entry with the 4 new mods in correct dependency order, then remove the old `data/mods/violence/` directory.

## Files to Touch

- UPDATE `data/game.json` - replace `violence` with new mods
- DELETE `data/mods/violence/` directory (should be empty at this point)

## Out of Scope

- Do NOT modify any new mod files (striking, grabbing, lethal-violence, creature-attacks)
- Do NOT modify any tests
- Do NOT modify any source code
- Do NOT update documentation beyond what's required

## Implementation Details

### game.json Update

Replace the `violence` entry in the mods array with the 4 new mods in correct load order (respecting dependencies):

**Load Order Requirements**:
1. `striking` - depends on core, anatomy, positioning (no violence-related deps)
2. `grabbing` - depends on core, anatomy, positioning (no violence-related deps)
3. `lethal-violence` - depends on core, anatomy, positioning, **grabbing**
4. `creature-attacks` - depends on core, anatomy, positioning (no violence-related deps)

**Note**: `lethal-violence` must come after `grabbing` in the load order.

### Example game.json Change

Before:
```json
{
  "mods": [
    "core",
    "anatomy",
    "positioning",
    "violence",
    ...
  ]
}
```

After:
```json
{
  "mods": [
    "core",
    "anatomy",
    "positioning",
    "striking",
    "grabbing",
    "lethal-violence",
    "creature-attacks",
    ...
  ]
}
```

### Cleanup Process

1. Verify violence mod directory is empty (all files migrated)
2. Update game.json with new mod list
3. Run validation to ensure mod loading works
4. Delete violence mod directory
5. Run full test suite
6. Verify application starts correctly

## Acceptance Criteria

### Tests
- [ ] `npm run validate` passes
- [ ] `npm run test:ci` passes (all test suites)
- [ ] `grep -r "violence" data/` returns no matches
- [ ] Application starts without errors

### Invariants
- [ ] All 4 new mods listed in game.json
- [ ] Load order respects dependencies (grabbing before lethal-violence)
- [ ] Old violence directory completely removed
- [ ] No orphaned files anywhere in the codebase
- [ ] No references to violence mod remain

## Dependencies

- VIOMIG-003 (striking migration complete)
- VIOMIG-005 (grabbing migration complete)
- VIOMIG-007 (lethal-violence migration complete)
- VIOMIG-009 (creature-attacks migration complete)
- VIOMIG-010 (cross-references updated)
- VIOMIG-011 (tests updated)

## Blocks

- None (this is the final ticket)

## Verification Commands

```bash
# Pre-cleanup: Verify violence mod is empty
ls data/mods/violence/actions/ 2>/dev/null | wc -l  # Should be 0 or only .gitkeep
ls data/mods/violence/rules/ 2>/dev/null | wc -l    # Should be 0 or only .gitkeep
ls data/mods/violence/conditions/ 2>/dev/null | wc -l  # Should be 0 or only .gitkeep

# After game.json update: Validate
npm run validate

# After cleanup: Verify violence mod removed
ls data/mods/violence 2>/dev/null && echo "ERROR: violence dir still exists" || echo "OK: violence dir removed"

# Search for any remaining violence references
grep -r "violence:" data/
grep -r "violence:" src/
grep -r "violence:" tests/

# Run full test suite
npm run test:ci

# Start application to verify
npm run start
```

## Final Checklist

Before marking this ticket complete, verify:

- [ ] All 12 VIOMIG tickets completed
- [ ] All 4 new mods pass `npm run validate:mod:*`
- [ ] No remaining `violence:` references in entire codebase
- [ ] All tests pass (`npm run test:ci`)
- [ ] Color schemes documented in `docs/mods/mod-color-schemes-used.md`
- [ ] Old `violence/` directory removed
- [ ] `game.json` updated with new mod list in correct order
- [ ] Application starts and runs without errors
