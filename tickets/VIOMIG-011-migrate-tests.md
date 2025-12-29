# VIOMIG-011: Migrate and Update Tests

**Status**: Open
**Type**: Migration
**Priority**: High

## Summary

Update all tests referencing the violence mod to use the new mod IDs. This includes unit tests, integration tests, and any test fixtures or mocks that reference violence actions, conditions, or other resources.

## Files to Touch

- Search `tests/` for files containing `violence:` or `violence` mod references
- Update test fixtures, mocks, and assertions
- Verify all test files compile and run

**Note**: The exact file list will be determined by running:
```bash
grep -r "violence:" tests/ --include="*.js" --include="*.json"
grep -r '"violence"' tests/ --include="*.js" --include="*.json"
```

## Out of Scope

- Do NOT modify production code (src/)
- Do NOT modify mod data files (data/mods/)
- Do NOT update `data/game.json` yet
- Do NOT create new test files (only update existing)
- Do NOT delete test files

## Implementation Details

### Reference Mapping for Tests

| Old Reference | New Reference |
|---------------|---------------|
| `violence:punch_target` | `striking:punch_target` |
| `violence:slap_target` | `striking:slap_target` |
| `violence:sucker_punch` | `striking:sucker_punch` |
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

### Mod Name References

Also update mod name references in test configurations:
| Old | New |
|-----|-----|
| `'violence'` (mod ID) | `'striking'`, `'grabbing'`, `'lethal-violence'`, or `'creature-attacks'` as appropriate |

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
- [ ] `grep -r "violence:" tests/` returns no matches (except intentional legacy test cases if any)
- [ ] `grep -r '"violence"' tests/` returns no matches for mod references

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
grep -r "violence:" tests/ --include="*.js" --include="*.json"
grep -r '"violence"' tests/ --include="*.js" --include="*.json" | grep -i mod

# Run test suites
npm run test:unit
npm run test:integration

# Verify specific test categories if they exist
npm run test:unit -- --testPathPattern="violence" 2>/dev/null || echo "No violence-specific tests found"
npm run test:unit -- --testPathPattern="striking" 2>/dev/null || echo "Striking tests ready"
npm run test:unit -- --testPathPattern="grabbing" 2>/dev/null || echo "Grabbing tests ready"
```
