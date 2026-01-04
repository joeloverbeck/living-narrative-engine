# CONREGUNI-001: Add Fail-Fast Validation in registerCondition()

## Summary

Add immediate validation after condition registration to detect infrastructure misconfigurations early. If a registered condition cannot be looked up via `dataRegistry.getConditionDefinition()`, throw an informative error immediately.

## Priority: High | Effort: Small

## Rationale

This is a safety net that catches dual-map synchronization failures at the earliest possible moment, providing developers with diagnostic information instead of cryptic "condition not found" errors later in the test run.

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/common/mods/ModTestFixture.js` | Modify `registerCondition()` method (~lines 2170-2193) |
| `tests/unit/common/mods/ModTestFixture.conditionRegistration.test.js` | Add fail-fast validation tests |

## Out of Scope

- **DO NOT** modify `ScopeResolverHelpers.js` - that's CONREGUNI-005
- **DO NOT** create TestConditionStore - that's CONREGUNI-002
- **DO NOT** change the cleanup logic - just add validation after registration
- **DO NOT** change the public API signature of `registerCondition()`

## Implementation Details

### In ModTestFixture.js

After the existing dual-map write (lines ~2188-2191), add validation:

```javascript
registerCondition(conditionId, definition) {
  // ... existing validation and storage code ...

  // Write to both maps (existing code)
  this._loadedConditions.set(conditionId, definition);
  if (this.testEnv._loadedConditions) {
    this.testEnv._loadedConditions.set(conditionId, definition);
  }
  this.#registeredConditions.add(conditionId);

  // NEW: Fail-fast validation
  const found = this.testEnv.dataRegistry.getConditionDefinition(conditionId);
  if (!found) {
    const debugInfo = [
      `CRITICAL: registerCondition() succeeded but condition '${conditionId}' is not findable.`,
      `This indicates a test infrastructure bug.`,
      ``,
      `Debug state:`,
      `  - fixture._loadedConditions.has(): ${this._loadedConditions.has(conditionId)}`,
      `  - testEnv._loadedConditions exists: ${!!this.testEnv._loadedConditions}`,
      `  - testEnv._loadedConditions.has(): ${this.testEnv._loadedConditions?.has(conditionId)}`,
      ``,
      `Resolution: The dataRegistry.getConditionDefinition override chain may be misconfigured.`,
      `Ensure loadDependencyConditions() or ScopeResolverHelpers._loadConditionsIntoRegistry()`,
      `was called before registerCondition() to establish the override.`
    ].join('\n');

    throw new Error(debugInfo);
  }
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **Existing tests continue to pass:**
   - `npm run test:unit -- tests/unit/common/mods/ModTestFixture.conditionRegistration.test.js`
   - `npm run test:integration -- tests/integration/mods/striking/striking_facing_away_filter.test.js`

2. **New test for fail-fast behavior:**
   ```javascript
   describe('registerCondition fail-fast validation', () => {
     it('should throw with diagnostic info if condition not findable after registration', async () => {
       // This tests the fail-fast mechanism by intentionally breaking the override chain
       const fixture = await ModTestFixture.forAction('positioning', 'positioning:sit_down');

       // Sabotage the override to simulate infrastructure bug
       const original = fixture.testEnv.dataRegistry.getConditionDefinition;
       fixture.testEnv.dataRegistry.getConditionDefinition = () => undefined;

       expect(() => {
         fixture.registerCondition('test:should-fail', { logic: { '==': [1, 1] } });
       }).toThrow(/CRITICAL.*registerCondition\(\) succeeded but condition.*not findable/);

       // Restore for cleanup
       fixture.testEnv.dataRegistry.getConditionDefinition = original;
       fixture.cleanup();
     });
   });
   ```

### Invariants That Must Remain True

1. **Registration Completeness**: Every call to `registerCondition()` either succeeds completely (condition findable) or throws immediately
2. **No Silent Failures**: Infrastructure misconfigurations are never hidden
3. **Backward Compatibility**: Existing tests using `registerCondition()` continue to work unchanged
4. **Error Messages Include Diagnostics**: Thrown errors include debug state for troubleshooting

## Verification Commands

```bash
# Run unit tests for condition registration
npm run test:unit -- tests/unit/common/mods/ModTestFixture.conditionRegistration.test.js --verbose

# Run integration tests that depend on condition registration
npm run test:integration -- tests/integration/mods/striking/striking_facing_away_filter.test.js --verbose

# Run all ModTestFixture tests
npm run test:unit -- --testPathPattern="ModTestFixture" --verbose
```

## Definition of Done

- [ ] `registerCondition()` validates findability after storage
- [ ] Throws informative error with debug state if not findable
- [ ] New test case for fail-fast behavior added
- [ ] All existing condition registration tests pass
- [ ] No changes to public API signature
