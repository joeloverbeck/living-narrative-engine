# VIOMIG-011: Migrate and Update Tests

**Status**: Completed
**Type**: Migration
**Priority**: High

## Summary

Update all tests referencing the legacy `violence` mod IDs (now split into `striking`, `grabbing`, `lethal-violence`, and `creature-attacks`) to use the new mod IDs and action names. The `data/mods/violence/` content is now empty aside from the manifest, so any tests pointing at `violence` action files, scopes, macros, or conditions must be migrated to the new mod locations.

## Files to Touch

- Search `tests/` for files containing `violence:` or `violence` mod references
- Update test fixtures, mocks, and assertions
- Update test helper mappings (category handlers, scope discovery heuristics)
- Verify all test files compile and run

**Note**: The exact file list will be determined by running:
```bash
rg -P "(?<!-)violence:" tests
rg "\"violence\"" tests -g "*.js" -g "*.json"
```

## Out of Scope

- Do NOT modify production code (src/)
- Do NOT modify mod data files (data/mods/)
- Do NOT update `data/game.json` yet
- Do NOT create new test files (only update existing)
- Do NOT delete test files
- Do NOT change narrative/prompt text that uses the word "violence" but is not a mod ID

## Implementation Details

### Reference Mapping for Tests

| Old Reference | New Reference |
|---------------|---------------|
| `violence:punch_target` | `striking:punch_target` |
| `violence:slap_target` | `striking:slap_target` |
| `violence:slap` | `striking:slap_target` |
| `violence:sucker_punch` | `striking:sucker_punch` |
| `violence:punch` | `striking:punch_target` |
| `violence:kick` | `striking:slap_target` (closest available action) |
| `violence:actor-has-arm` | `striking:actor-has-arm` |
| `violence:actor_arm_body_parts` | `striking:actor_arm_body_parts` |
| `violence:handleArmFumble` | `striking:handleArmFumble` |
| `violence:grab_neck` | `grabbing:grab_neck` |
| `violence:squeeze_neck_with_both_hands` | `grabbing:squeeze_neck_with_both_hands` |
| `violence:tear_out_throat` | `lethal-violence:tear_out_throat` |
| `violence:peck_target` | `creature-attacks:peck_target` |
| `violence:actor-has-beak` | `creature-attacks:actor-has-beak` |
| `violence:actor_beak_body_parts` | `creature-attacks:actor_beak_body_parts` |
| `violence:handleBeakFumble` | `creature-attacks:handleBeakFumble` |
| `violence:event-is-action-peck-target` | `creature-attacks:event-is-action-peck-target` |

### Mod Name References

Also update mod name references in test configurations:
| Old | New |
|-----|-----|
| `'violence'` (mod ID) | `'striking'`, `'grabbing'`, `'lethal-violence'`, or `'creature-attacks'` as appropriate |

For legacy placeholder components like `violence:health` or `violence:aggressor`, replace them with real component IDs that exist in current mods (e.g., `damage-types:damage_capabilities`, `skills:melee_skill`) while keeping the test intent intact.

### Update Process

1. Run grep to find all test files with violence references
2. Categorize references by type (action, condition, mod name, etc.)
3. Apply appropriate mapping based on content type
4. Update any mock data or fixtures
5. Run affected tests to verify changes
6. Run full test suite to ensure no regressions

## Acceptance Criteria

### Tests
- [ ] `npm run test:unit` passes
- [ ] `npm run test:integration` passes
- [ ] `rg -P "(?<!-)violence:" tests` returns no matches
- [ ] `rg "\"violence\"" tests -g "*.js" -g "*.json"` only matches narrative text (not mod IDs)

### Invariants
- [ ] All existing test coverage maintained (no tests deleted)
- [ ] Test behavior unchanged (only IDs updated)
- [ ] No new test files created
- [ ] Test patterns and structure preserved

## Dependencies

- VIOMIG-003 (striking migration complete)
- VIOMIG-005 (grabbing migration complete)
- VIOMIG-007 (lethal-violence migration complete)
- VIOMIG-009 (creature-attacks migration complete)
- VIOMIG-010 (cross-references updated in mods)

## Blocks

- VIOMIG-012 (cleanup requires tests passing)

## Verification Commands

```bash
# Search for violence references in tests
rg -P "(?<!-)violence:" tests
rg "\"violence\"" tests -g "*.js" -g "*.json"

# Run test suites
npm run test:unit
npm run test:integration

# Verify specific test categories if they exist
npm run test:unit -- --testPathPatterns="violence" 2>/dev/null || echo "No violence-specific tests found"
npm run test:unit -- --testPathPatterns="striking" 2>/dev/null || echo "Striking tests ready"
npm run test:unit -- --testPathPatterns="grabbing" 2>/dev/null || echo "Grabbing tests ready"
```

## Outcome

Updated test fixtures, helpers, and coverage to reference `striking`, `grabbing`, `lethal-violence`, and `creature-attacks` instead of `violence`, plus refreshed example components and visual scheme expectations. Left production code and mod data untouched; adjusted test docs to match the migrated mods.
