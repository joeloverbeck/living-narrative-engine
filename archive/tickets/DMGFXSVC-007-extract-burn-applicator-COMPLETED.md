# DMGFXSVC-007: Extract BurnApplicator

## Summary
Extract the burn effect logic from `DamageTypeEffectsService` into a standalone `BurnApplicator` class.

## Motivation
- Burn logic is ~80 lines in `#applyBurnEffect` (lines 784-861)
- Has unique logic: stacking behavior (accumulate damage vs refresh duration)
- Stacking edge cases (missing stackedCount property) need isolated testing

## Files to Touch

### Create
- `src/anatomy/applicators/burnApplicator.js` - Applicator class
- `tests/unit/anatomy/applicators/burnApplicator.test.js` - Unit tests

### Modify
- `src/dependencyInjection/tokens/tokens-core.js` - Add `BurnApplicator` token
- `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` - Register applicator

## Out of Scope
- **DO NOT** modify `damageTypeEffectsService.js` in this ticket (integration is DMGFXSVC-009)
- **DO NOT** modify existing `damageTypeEffectsService.test.js` tests
- **DO NOT** change the `anatomy:burning` component schema
- **DO NOT** change the `anatomy:burning_started` event payload structure
- **DO NOT** modify existing burn component data when stacking is disabled

## Implementation Details

### BurnApplicator API
```javascript
class BurnApplicator {
  #logger;
  #entityManager;

  constructor({ logger, entityManager }) {
    // Validate dependencies
  }

  /**
   * Apply burn effect to a part.
   * NOTE: The currentHealth <= 0 check is performed by the caller (applyEffectsForDamage).
   * @param {Object} params
   * @param {string} params.entityId - Owner entity ID
   * @param {string} params.partId - Target part ID
   * @param {Object} params.effectDefinition - Resolved effect definition
   * @param {Object} params.damageEntryConfig - Config from damageEntry.burn
   * @param {IEventDispatchStrategy} params.dispatchStrategy - From DMGFXSVC-003
   * @param {Object} [params.sessionContext] - For dispatch strategy
   * @returns {Promise<{applied: boolean, stacked: boolean, stackedCount: number}>}
   */
  async apply(params) { ... }

  /**
   * Handle stacking logic for existing burn.
   * NOTE: The actual code does NOT enforce maxStackCount - stacking increments without limit.
   * @param {Object} existingBurn - Current burn component data
   * @param {Object} stackingConfig - Stacking configuration
   * @param {number} baseDamage - Base tick damage (dps)
   * @param {number} duration - Duration in turns
   * @returns {Object} Updated burn data
   */
  applyStacking(existingBurn, stackingConfig, baseDamage, duration) { ... }
}
```

### Key Logic to Extract
From `damageTypeEffectsService.js` lines 784-861 (`#applyBurnEffect`):

**Note**: The `currentHealth <= 0` check is in the caller (`applyEffectsForDamage`), not in `#applyBurnEffect`.

1. Get base tick damage (`dps`) and duration from config or definition defaults
2. Get stacking defaults from definition (`defaultStacks` property, fallback to `DEFAULT_BURN_STACK_COUNT`)
3. Get `canStack` from config or stacking defaults (default `false`)
4. Check for existing `anatomy:burning` component on part
5. If existing and `canStack === true`:
   - Get existing stackedCount (default to `baseStackCount` if missing)
   - Increment stackedCount (NOTE: actual code does NOT check maxStackCount)
   - Accumulate tickDamage: `existingDamage + dps`
   - Refresh duration
6. If existing and `canStack === false`:
   - Only refresh duration, keep existing tickDamage
   - Keep stackedCount at existing or baseStackCount
7. If no existing burn:
   - Apply fresh: `{ remainingTurns, tickDamage, stackedCount: baseStackCount }`
8. Dispatch `anatomy:burning_started` event: `entityId, partId, stackedCount, timestamp`
9. Record effect in session if applicable (via dispatchStrategy)

### Stacking Configuration Structure (from defaults)
```javascript
{
  defaults: {
    tickDamage: 2,           // Used as fallback for dps
    durationTurns: 2,
    stacking: {
      canStack: false,       // Default is false in actual code
      defaultStacks: 1       // Property name is 'defaultStacks', not 'baseStackCount'
      // NOTE: maxStackCount is defined in schema but NOT enforced in code
    }
  }
}
```

### DI Token
Add to `tokens-core.js`:
```javascript
BurnApplicator: 'BurnApplicator',
```

### Registration
Add to `worldAndEntityRegistrations.js` (after BleedApplicator registration):
```javascript
registrar.singletonFactory(tokens.BurnApplicator, (c) => {
  return new BurnApplicator({
    logger: c.resolve(tokens.ILogger),
    entityManager: c.resolve(tokens.IEntityManager),
  });
});
```

## Acceptance Criteria

### Tests That Must Pass

#### New Tests (burnApplicator.test.js)
**Constructor**:
1. `validates logger dependency`
2. `validates entityManager dependency`

**apply()**:
NOTE: `currentHealth` check is done by caller, not by applicator.
1. `returns { applied: true, stacked: false } for fresh burn application`
2. `returns { applied: true, stacked: true } when stacking on existing burn`
3. `adds fresh anatomy:burning component with baseStackCount`
4. `uses config dps over definition defaults (tickDamage)`
5. `uses config durationTurns over definition defaults`
6. `accumulates tickDamage when canStack is true`
7. `increments stackedCount when canStack is true`
8. `refreshes duration only when canStack is false`
9. `handles missing stackedCount on existing burn (uses baseStackCount)`
10. `dispatches event via strategy with correct stackedCount`
11. `records effect via strategy when applied`

**applyStacking()** (public helper method for isolated stacking logic):
1. `increments stackedCount` (no maxStackCount check in actual code)
2. `accumulates tickDamage when canStack is true`
3. `preserves tickDamage when canStack is false`
4. `refreshes remainingTurns in both modes`
5. `uses baseStackCount when existing burn has no stackedCount`

#### Existing Tests
- All 68 existing `damageTypeEffectsService.test.js` tests must pass unchanged

### Invariants That Must Remain True
- **INV-4**: Effect application adds exactly one component to entity/part
- **INV-5**: Effect application dispatches exactly one event
- ~~Burn is not applied to destroyed parts~~ (this check is in caller, not applicator)
- ~~Stacking respects `maxStackCount` limit~~ (actual code does NOT enforce this)
- Missing `stackedCount` on existing burn defaults to `baseStackCount`
- Component data structure: `{ remainingTurns, tickDamage, stackedCount }`
- Event payload structure unchanged

## Verification Commands
```bash
# Run new tests
npm run test:unit -- tests/unit/anatomy/applicators/burnApplicator.test.js

# Verify existing tests still pass
npm run test:unit -- tests/unit/anatomy/services/damageTypeEffectsService.test.js

# Verify DI registration compiles
npm run typecheck
```

## Size Estimate
- ~100 lines of implementation code
- ~250 lines of test code
- ~5 lines of DI registration

## Outcome

**Status**: ✅ COMPLETED

**Implementation Date**: 2025-12-30

### Files Created
- `src/anatomy/applicators/burnApplicator.js` (247 lines)
- `tests/unit/anatomy/applicators/burnApplicator.test.js` (508 lines)

### Files Modified
- `src/dependencyInjection/tokens/tokens-core.js` - Added `BurnApplicator` token (line 91)
- `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` - Added import and registration (lines 93, 981-992)

### Test Results
- **New tests**: 39 tests passing
- **Existing tests**: All 68 `damageTypeEffectsService.test.js` tests pass unchanged
- **Lint**: No errors (only pre-existing warnings in other code)

### Ticket Corrections Made During Implementation
Before implementation, the following assumptions in the original ticket were corrected:
1. Line numbers updated (784-861, not 760-840)
2. Registration file corrected to `worldAndEntityRegistrations.js` (not `anatomyRegistrations.js`)
3. Documented that `currentHealth <= 0` check is in the caller, not the applicator
4. Documented that `maxStackCount` is NOT enforced in actual code
5. Corrected config property name: `dps` (not `tickDamage`)
6. Corrected stacking config property: `defaultStacks` (not `baseStackCount`)

### Verification
```bash
# Tests passing
NODE_ENV=test npx jest tests/unit/anatomy/applicators/burnApplicator.test.js --no-coverage
# 39 passed

NODE_ENV=test npx jest tests/unit/anatomy/services/damageTypeEffectsService.test.js --no-coverage
# 68 passed
```

### Notes for DMGFXSVC-009 (Integration)
The BurnApplicator is now ready to be integrated into DamageTypeEffectsService. The integration should:
1. Inject BurnApplicator as a dependency
2. Replace `#applyBurnEffect` method body with a call to `this.#burnApplicator.apply()`
3. Pass the appropriate dispatch strategy and session context
