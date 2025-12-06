# APPDAME2ECOV-003: Metadata and Damage Tags E2E Coverage

## Summary

Add e2e test coverage for `metadata` and `damage_tags` on `damage_entry`, verifying session recording, propagation to effects, and narrative inclusion.

## Background

Per `specs/apply-damage-e2e-coverage-spec.md`, the existing e2e suites never exercise:

- `metadata` field on `damage_entry` objects
- `damage_tags` array on `damage_entry` objects
- Recording of metadata/tags in the damage session
- Propagation of metadata/tags to triggered effects
- Inclusion of metadata/tags in composed narrative output

## Files Expected to Touch

### New Files

- `tests/e2e/actions/damageMetadataTags.e2e.test.js` - New e2e test suite

### Files Referenced (Read-Only for Context)

- `src/logic/operationHandlers/applyDamageHandler.js` - Metadata/tags processing
- `src/logic/services/damageResolutionService.js` - Session recording
- `src/anatomy/services/damageTypeEffectsService.js` - Effects with metadata
- `src/anatomy/services/damageNarrativeComposer.js` - Narrative composition
- `data/schemas/operations/applyDamage.schema.json` - Schema for damage_entry

## Out of Scope

- Modifications to production code (`src/`)
- Modifications to existing e2e test files
- Changes to schema definitions
- Narrative dispatch mechanics (APPDAME2ECOV-001)
- Hit resolution controls (APPDAME2ECOV-002)
- Propagation bookkeeping (APPDAME2ECOV-004)
- Session event ordering (APPDAME2ECOV-005)

## Acceptance Criteria

### Tests That Must Pass

1. **Metadata recorded in session**
   - Test: `should record damage_entry metadata in damage session`
   - Verifies: `executionContext.damageSession` contains metadata from damage entry

2. **Damage tags recorded in session**
   - Test: `should record damage_tags array in damage session`
   - Verifies: `executionContext.damageSession` contains tags from damage entry

3. **Metadata propagated to effects**
   - Test: `should pass metadata to triggered effects (bleed/burn/poison)`
   - Verifies: Effect components receive metadata from originating damage entry

4. **Tags propagated to effects**
   - Test: `should pass damage_tags to triggered effects`
   - Verifies: Effect event payloads include associated damage tags

5. **Metadata in damage events**
   - Test: `should include metadata in anatomy:damage_applied event payload`
   - Verifies: `anatomy:damage_applied` event contains damage entry metadata

6. **Tags in damage events**
   - Test: `should include damage_tags in anatomy:damage_applied event payload`
   - Verifies: `anatomy:damage_applied` event contains damage entry tags

7. **Multiple entries with different metadata**
   - Test: `should track distinct metadata for each damage entry in multi-entry weapon`
   - Verifies: Each damage entry's metadata/tags are preserved separately in session

### Invariants That Must Remain True

- Existing e2e tests in `tests/e2e/actions/` continue to pass
- No changes to production behavior (tests only)
- Test follows existing patterns in `damageEffectsTriggers.e2e.test.js`
- Uses `ModTestFixture` and `ModEntityBuilder` from test utilities
- Properly cleans up test resources in `afterEach`
- Metadata/tags are optional - absence should not cause failures

## Implementation Notes

- Create custom weapon definitions with `metadata` and `damage_tags` on damage entries
- Example metadata: `{ "source": "enchanted", "element": "fire" }`
- Example tags: `["magical", "holy", "critical_hit"]`
- Capture events via event bus spy to verify payload contents
- Access `executionContext.damageSession` to verify session recording
- Test with multiple damage entries having different metadata/tags

## Testing Command

```bash
NODE_ENV=test npx jest tests/e2e/actions/damageMetadataTags.e2e.test.js --no-coverage --verbose
```

## Dependencies

- None (new standalone test file)

## Estimated Size

Medium - Single test file with ~7-8 test cases
