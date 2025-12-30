# DMGFXSVC-005: Extract FractureApplicator

## Summary
Extract the fracture effect logic from `DamageTypeEffectsService` into a standalone `FractureApplicator` class.

## Motivation
- Fracture logic is ~85 lines in `#checkAndApplyFracture` (lines 611-696)
- Has unique logic: threshold check + stun chance roll (RNG-based)
- Stun application is a secondary effect that needs isolation for testing

## Files to Touch

### Create
- `src/anatomy/applicators/fractureApplicator.js` - Applicator class
- `tests/unit/anatomy/applicators/fractureApplicator.test.js` - Unit tests

### Modify
- `src/dependencyInjection/tokens/tokens-core.js` - Add `FractureApplicator` token
- `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` - Register applicator (Note: `anatomyRegistrations.js` does not exist; anatomy services are registered in `worldAndEntityRegistrations.js` alongside `DismembermentApplicator`)

## Out of Scope
- **DO NOT** modify `damageTypeEffectsService.js` in this ticket (integration is DMGFXSVC-009)
- **DO NOT** modify existing `damageTypeEffectsService.test.js` tests
- **DO NOT** change the `anatomy:fractured` or `anatomy:stunned` component schemas
- **DO NOT** change the `anatomy:fractured` event payload structure
- **DO NOT** modify the stun chance calculation (just extract it)

## Implementation Details

### FractureApplicator API
```javascript
class FractureApplicator {
  #logger;
  #entityManager;

  constructor({ logger, entityManager }) {
    // Validate dependencies
  }

  /**
   * Check if fracture should trigger and apply it if so.
   * @param {Object} params
   * @param {string} params.entityId - Owner entity ID
   * @param {string} params.partId - Target part ID
   * @param {number} params.damageAmount - Damage dealt
   * @param {string} params.damageTypeId - Damage type ID
   * @param {number} params.maxHealth - Part max health
   * @param {number} params.currentHealth - Part health after damage
   * @param {Object} params.effectDefinition - Resolved effect definition
   * @param {Object} params.damageEntryConfig - Config from damageEntry
   * @param {IEventDispatchStrategy} params.dispatchStrategy - From DMGFXSVC-003
   * @param {Object} [params.sessionContext] - For dispatch strategy
   * @param {function} [params.rng] - RNG function for stun chance
   * @returns {Promise<{triggered: boolean, stunApplied: boolean}>}
   */
  async apply(params) { ... }

  /**
   * Calculate if damage exceeds threshold.
   * @param {number} damageAmount
   * @param {number} maxHealth
   * @param {number} thresholdFraction
   * @returns {boolean}
   */
  meetsThreshold(damageAmount, maxHealth, thresholdFraction) { ... }

  /**
   * Roll for stun based on chance.
   * @param {number} stunChance - Probability 0-1
   * @param {function} rng - RNG function
   * @returns {boolean}
   */
  rollForStun(stunChance, rng) { ... }
}
```

### Key Logic to Extract
From `damageTypeEffectsService.js` lines 611-696:
1. Calculate threshold: `config.thresholdFraction ?? definition.defaults.thresholdFraction` (default 0.5)
2. Compare: `damageAmount >= maxHealth * threshold`
3. Add `anatomy:fractured` component to **part**: `{ sourceDamageType: damageTypeId, appliedAtHealth: currentHealth }`
4. Roll for stun: `rng() < stunChance` (default chance from definition.defaults.stun.chance)
5. If stun triggered, add `anatomy:stunned` component to **entity**: `{ remainingTurns, sourcePartId }`
6. Dispatch fracture event with payload: `entityId, partId, damageTypeId, stunApplied, timestamp`
7. Record effect in session if applicable

### Stun Configuration Structure
```javascript
// Actual structure in FALLBACK_EFFECT_DEFINITIONS.fracture:
{
  defaults: {
    thresholdFraction: 0.5,
    stun: {
      componentId: 'anatomy:stunned',
      durationTurns: 1,  // DEFAULT_STUN_DURATION
      chance: 0,  // Note: defaults to 0, must be enabled via damageEntry config
    },
  },
}
```

### DI Token
Add to `tokens-core.js`:
```javascript
FractureApplicator: 'FractureApplicator',
```

### Registration
Add to `worldAndEntityRegistrations.js` (alongside `DismembermentApplicator`):
```javascript
registrar.singletonFactory(tokens.FractureApplicator, (c) => {
  return new FractureApplicator({
    logger: c.resolve(tokens.ILogger),
    entityManager: c.resolve(tokens.IEntityManager),
  });
});
```

## Acceptance Criteria

### Tests That Must Pass

#### New Tests (fractureApplicator.test.js)
**Constructor**:
1. `validates logger dependency`
2. `validates entityManager dependency`

**apply()**:
1. `returns { triggered: false, stunApplied: false } when damage below threshold`
2. `returns { triggered: true, stunApplied: false } when damage meets threshold but stun roll fails`
3. `returns { triggered: true, stunApplied: true } when damage meets threshold and stun roll succeeds`
4. `uses config thresholdFraction over definition defaults`
5. `uses config stun.chance over definition defaults`
6. `adds anatomy:fractured component to part with correct data`
7. `adds anatomy:stunned component to entity when stun triggered`
8. `does not add stunned component when stun disabled in config`
9. `does not add stunned component when stun roll fails`
10. `dispatches event via strategy with stunApplied=true when stun triggered`
11. `dispatches event via strategy with stunApplied=false when stun not triggered`
12. `records effect via strategy when triggered`
13. `does not add components when not triggered`

**meetsThreshold()**:
1. `returns false when damageAmount < maxHealth * threshold`
2. `returns true when damageAmount >= maxHealth * threshold`
3. `uses default threshold 0.5 when not specified`

**rollForStun()**:
1. `returns true when rng() < stunChance`
2. `returns false when rng() >= stunChance`
3. `returns false when stunChance is 0`
4. `returns true when stunChance is 1`
5. `uses provided rng function`

#### Existing Tests
- All 68 existing `damageTypeEffectsService.test.js` tests must pass unchanged

### Invariants That Must Remain True
- **INV-2**: Fracture is always checked before bleed/burn/poison (orchestration in DMGFXSVC-009)
- **INV-4**: Effect application adds exactly one component to entity/part (plus optional stun)
- **INV-5**: Effect application dispatches exactly one event
- Fracture component applied to **part**, stun component applied to **entity**
- Component data structures unchanged
- Event payload structure unchanged

## Verification Commands
```bash
# Run new tests
npm run test:unit -- tests/unit/anatomy/applicators/fractureApplicator.test.js

# Verify existing tests still pass
npm run test:unit -- tests/unit/anatomy/services/damageTypeEffectsService.test.js

# Verify DI registration compiles
npm run typecheck
```

## Size Estimate
- ~100 lines of implementation code
- ~250 lines of test code
- ~5 lines of DI registration

---

## Outcome

**Status**: ✅ COMPLETED

**Date Completed**: 2025-12-30

### Files Created
- `src/anatomy/applicators/fractureApplicator.js` (255 lines)
- `tests/unit/anatomy/applicators/fractureApplicator.test.js` (375 lines)

### Files Modified
- `src/dependencyInjection/tokens/tokens-core.js` - Added `FractureApplicator` token
- `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` - Added import and factory registration

### Implementation Summary
1. Created `FractureApplicator` class following the established `DismembermentApplicator` pattern
2. Implemented all public methods: `apply()`, `meetsThreshold()`, `rollForStun()`
3. Exported constants: `FRACTURED_COMPONENT_ID`, `STUNNED_COMPONENT_ID`, `FRACTURED_EVENT`, `DEFAULT_THRESHOLD_FRACTION`, `DEFAULT_STUN_DURATION`
4. Added DI token and singleton factory registration

### Test Results
- **New FractureApplicator tests**: 46 tests, all passing
  - Constructor validation: 3 tests
  - `meetsThreshold()`: 8 tests (including edge cases)
  - `rollForStun()`: 6 tests
  - `apply()`: 24 tests
  - Exported constants: 5 tests
- **Existing damageTypeEffectsService tests**: 68 tests, all passing unchanged

### Ticket Corrections Made During Implementation
1. Line numbers: 620-700 → 611-696 (actual location of `#checkAndApplyFracture`)
2. Registration file: `anatomyRegistrations.js` → `worldAndEntityRegistrations.js` (correct file)
3. Stun config `chance`: 0.3 → 0 (actual default is 0, must be enabled via damageEntry)

### Verification Commands Executed
```bash
# FractureApplicator tests - PASSED (46/46)
NODE_ENV=test npx jest tests/unit/anatomy/applicators/fractureApplicator.test.js

# Existing damageTypeEffectsService tests - PASSED (68/68)
NODE_ENV=test npx jest tests/unit/anatomy/services/damageTypeEffectsService.test.js

# Type check - Pre-existing errors only (unrelated to this change)
npm run typecheck

# ESLint - 0 errors (warnings only, pre-existing patterns)
npx eslint src/anatomy/applicators/fractureApplicator.js
```

### Ready for Integration
The `FractureApplicator` is now available for integration in ticket DMGFXSVC-009, which will refactor `DamageTypeEffectsService` to delegate fracture logic to this applicator.
