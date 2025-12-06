# APPDAME2ECOV-007: REGENERATE_DESCRIPTION After APPLY_DAMAGE E2E Coverage

## Summary

Add e2e test coverage validating that `REGENERATE_DESCRIPTION` operations after `APPLY_DAMAGE` correctly update entity descriptions and log entries to reflect damage state.

## Background

Per `specs/apply-damage-e2e-coverage-spec.md`, the macro workflow calls `REGENERATE_DESCRIPTION` after `APPLY_DAMAGE`, but this is not validated:

- Entity descriptions should reflect new damage state
- Log updates should occur after damage
- Regeneration should include damage-related changes (injuries, effects)

## Files Expected to Touch

### New Files

- `tests/e2e/actions/regenerateDescriptionAfterDamage.e2e.test.js` - New e2e test suite

### Files Referenced (Read-Only for Context)

- `src/logic/operationHandlers/regenerateDescriptionHandler.js` - Description regeneration
- `data/mods/weapons/macros/handleMeleeHit.macro.json` - Workflow reference
- `tests/integration/clothing/regenerateDescriptionErrorHandling.test.js` - Existing tests

## Out of Scope

- Modifications to production code (`src/`)
- Modifications to existing test files
- Changes to `RegenerateDescriptionHandler` implementation
- Changes to macro definitions
- Narrative dispatch (APPDAME2ECOV-001)
- Hit resolution controls (APPDAME2ECOV-002)
- Metadata/tags coverage (APPDAME2ECOV-003)
- Propagation bookkeeping (APPDAME2ECOV-004)
- Session event queueing (APPDAME2ECOV-005)
- Edge cases (APPDAME2ECOV-006)

## Acceptance Criteria

### Tests That Must Pass

1. **Description regenerated after damage**
   - Test: `should regenerate entity description after APPLY_DAMAGE`
   - Verifies: `REGENERATE_DESCRIPTION` executes and updates entity description

2. **Description reflects damage state**
   - Test: `should include damage-related information in regenerated description`
   - Verifies: Description mentions injuries, wounds, or damage effects

3. **Bleeding reflected in description**
   - Test: `should reflect active bleeding status in regenerated description`
   - Verifies: Active `bleeding` component affects description output

4. **Burning reflected in description**
   - Test: `should reflect active burning status in regenerated description`
   - Verifies: Active `burning` component affects description output

5. **Part destruction reflected**
   - Test: `should reflect destroyed parts in regenerated description`
   - Verifies: Destroyed/dismembered parts affect description

6. **Health status in description**
   - Test: `should reflect reduced health status in regenerated description`
   - Verifies: Low health thresholds affect description (e.g., "badly wounded")

7. **Multiple effects combined**
   - Test: `should combine multiple damage effects in regenerated description`
   - Verifies: Description handles multiple active effects coherently

### Invariants That Must Remain True

- Existing e2e tests in `tests/e2e/actions/` continue to pass
- Existing `regenerateDescriptionErrorHandling.test.js` unaffected
- No changes to production behavior (tests only)
- Test follows existing patterns in damage e2e tests
- Uses `ModTestFixture` and `ModEntityBuilder` from test utilities
- Properly cleans up test resources in `afterEach`
- Description regeneration doesn't clear damage state

## Implementation Notes

- Execute full APPLY_DAMAGE → REGENERATE_DESCRIPTION workflow
- Capture description component before and after damage
- Verify description text changes reflect damage state
- Test with various damage types and effects
- Consider using snapshot testing for description format validation

## Example Test Flow

```javascript
// 1. Create actor with initial description
// 2. Apply damage with bleeding effect
// 3. Execute REGENERATE_DESCRIPTION
// 4. Verify description now mentions injury/bleeding
// 5. Compare before/after description components
```

## Testing Command

```bash
NODE_ENV=test npx jest tests/e2e/actions/regenerateDescriptionAfterDamage.e2e.test.js --no-coverage --verbose
```

## Dependencies

- None (new standalone test file)

## Estimated Size

Small-Medium - Single test file with ~7 test cases
