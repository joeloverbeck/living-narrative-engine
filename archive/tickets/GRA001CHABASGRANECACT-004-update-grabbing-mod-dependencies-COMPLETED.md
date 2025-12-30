# GRA001CHABASGRANECACT-004: Update grabbing Mod Dependencies

## Summary
Update the `grabbing` mod's `mod-manifest.json` to add dependencies on `grabbing-states`, `anatomy`, `skills`, and `recovery-states`. This is a preparatory change; current grabbing content does not yet reference these mods but upcoming updates will.

## Status
Completed

## File List (Files to Touch)

### Files to Modify
- `data/mods/grabbing/mod-manifest.json`

## Out of Scope

**DO NOT modify or touch:**
- Any action files in `data/mods/grabbing/actions/`
- Any rule files in `data/mods/grabbing/rules/`
- Any condition files in `data/mods/grabbing/conditions/`
- The `content` section of the manifest (handled in separate ticket after file creation)
- `data/game.json`
- Any files in `data/mods/grabbing-states/`
- Any source code in `src/`
 - Any test files (unless validation or coverage gaps require a minimal new test)

## Implementation Details

### Current Dependencies (do not remove)
```json
{
  "dependencies": [
    { "id": "personal-space-states", "version": "^1.0.0" },
    { "id": "hugging-states", "version": "^1.0.0" },
    { "id": "physical-control-states", "version": "^1.0.0" },
    { "id": "personal-space", "version": "^1.0.0" }
  ]
}
```

### New Dependencies to Add
```json
{
  "dependencies": [
    { "id": "personal-space-states", "version": "^1.0.0" },
    { "id": "hugging-states", "version": "^1.0.0" },
    { "id": "physical-control-states", "version": "^1.0.0" },
    { "id": "personal-space", "version": "^1.0.0" },
    { "id": "grabbing-states", "version": "^1.0.0" },
    { "id": "anatomy", "version": "^1.0.0" },
    { "id": "skills", "version": "^1.0.0" },
    { "id": "recovery-states", "version": "^1.0.0" }
  ]
}
```

### Dependencies Explanation
- `grabbing-states`: For `grabbing_neck` and `neck_grabbed` state components
- `anatomy`: For `actor-has-free-grabbing-appendage` prerequisite condition
- `skills`: For `melee_skill` and `mobility_skill` in chance-based contest
- `recovery-states`: For `fallen` state (forbidden component and fumble outcome)

## Acceptance Criteria

### Tests That Must Pass
- Existing grabbing mod tests pass: `npm run test:integration -- tests/integration/mods/grabbing/`

### Validation Notes
- `npm run validate` will report unused dependencies for `grabbing` until the grab-neck action/rule updates land (see GRA001CHABASGRANECACT-005/007). Do not treat this as a blocker for this ticket.

### Invariants That Must Remain True
- All existing dependencies are preserved (do not remove any)
- New dependencies are added, not replacing existing ones
- Version constraints use `^1.0.0` format (semver compatible)
- The `content` section remains unchanged in this ticket
- No changes to action/rule/condition functionality

## Verification Steps

1. `data/mods/grabbing/mod-manifest.json` contains all 8 dependencies
2. `npm run test:integration -- tests/integration/mods/grabbing/` passes
3. Dependencies are in the same format as existing entries

## Dependencies
- GRA001CHABASGRANECACT-001 (grabbing-states mod must exist)
- GRA001CHABASGRANECACT-002 (grabbing_neck component should exist)
- GRA001CHABASGRANECACT-003 (neck_grabbed component should exist)

## Blocked By
- None (the `grabbing-states` mod already exists in the repo)

## Blocks
- GRA001CHABASGRANECACT-005 (new action needs these dependencies)
- GRA001CHABASGRANECACT-007 (new rule needs these dependencies)

## Outcome
- Added new dependencies to `data/mods/grabbing/mod-manifest.json` without modifying grabbing actions/rules/conditions.
- Validation remains expected to flag unused dependencies until grab-neck action/rule updates are implemented.
