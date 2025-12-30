# VIOMIG-012: Update game.json and Remove Old Violence Mod

**Status**: Completed
**Type**: Cleanup
**Priority**: High

## Summary

Final cleanup ticket: update `data/game.json` to remove the `violence` mod entry and list the 4 replacement mods in a stable load order, then remove the old `data/mods/violence/` directory (which still contains legacy content).

## Files to Touch

- UPDATE `data/game.json` - replace `violence` with new mods
- DELETE `data/mods/violence/` directory

## Out of Scope

- Do NOT modify any new mod files (striking, grabbing, lethal-violence, creature-attacks)
- Do NOT modify any source code
- Do NOT update documentation beyond what's required
- Do NOT add/adjust tests unless required to keep the suite green or to reflect the mod list cleanup

## Implementation Details

### game.json Update

Replace the `violence` entry in the mods array with the 4 new mods in a stable load order (respecting actual manifest dependencies):

**Load Order Notes**:
1. `striking` depends on recovery-states, physical-control-states, sitting-states, hugging-states, sex-states, anatomy, damage-types, skills, performances-states, weapons, bending-states, liquids-states.
2. `grabbing` depends on personal-space-states, hugging-states, physical-control-states, personal-space.
3. `lethal-violence` depends on biting-states.
4. `creature-attacks` depends on damage-types, hugging-states, sex-states, performances-states, bending-states, physical-control-states, recovery-states, skills, weapons, anatomy.

There are no direct dependencies among the four new mods, but keep their order stable and ensure they appear only once in `data/game.json`.

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

1. Update game.json with new mod list
2. Run validation to ensure mod loading works
3. Delete violence mod directory (legacy content should already be migrated)
4. Run relevant test suites with `--runInBand`

## Acceptance Criteria

### Tests
- [ ] `npm run validate` passes
- [ ] Relevant test suite(s) pass (targeted, with `--runInBand`)
- [ ] `data/game.json` contains `striking`, `grabbing`, `lethal-violence`, `creature-attacks` and no `violence`
- [ ] `data/mods/violence/` directory removed

### Invariants
- [ ] All 4 new mods listed in game.json
- [ ] Load order respects dependencies
- [ ] Old violence directory completely removed
- [ ] No orphaned files in `data/mods/violence/`
- [ ] No references to the `violence` mod id remain in `data/game.json`

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
# After game.json update: Validate
npm run validate

# After cleanup: Verify violence mod removed
ls data/mods/violence 2>/dev/null && echo "ERROR: violence dir still exists" || echo "OK: violence dir removed"

# Verify the mod id is removed from game.json
rg -n "\"violence\"" data/game.json

# Run relevant test suite(s)
npm run test:single -- --config jest.config.integration.js --runInBand <test-file>
```

## Final Checklist

Before marking this ticket complete, verify:

- [ ] All 12 VIOMIG tickets completed
- [ ] All 4 new mods pass `npm run validate:mod:*` (if run)
- [ ] All tests pass (targeted suites)
- [ ] Color schemes documented in `docs/mods/mod-color-schemes-used.md`
- [ ] Old `violence/` directory removed
- [ ] `game.json` updated with new mod list in correct order
- [ ] Application starts and runs without errors (optional manual check)

## Outcome

- Updated `data/game.json` to remove the `violence` mod entry, insert `striking`, `grabbing`, `lethal-violence`, and `creature-attacks`, and eliminate duplicate entries.
- Removed the legacy `data/mods/violence/` directory.
- Ran `npm run validate` and targeted integration coverage for mod loading (`modsLoader.gameConfigPhase.integration.test.js`).
- Adjusted ticket assumptions to reflect actual mod dependencies and realistic verification steps.
