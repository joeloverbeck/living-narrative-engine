# DMGFXSVC-004: Extract DismembermentApplicator

**Status**: COMPLETED

## Summary
Extract the dismemberment effect logic from `DamageTypeEffectsService` into a standalone `DismembermentApplicator` class.

## Motivation
- Dismemberment logic is ~78 lines in `#checkAndApplyDismemberment` (lines 517-594)
- Has unique logic: embedded part check, threshold calculation, skips all other effects if triggered
- Test isolation requires testing dismemberment separate from orchestration

## Files to Touch

### Create
- `src/anatomy/applicators/dismembermentApplicator.js` - Applicator class
- `tests/unit/anatomy/applicators/dismembermentApplicator.test.js` - Unit tests

### Modify
- `src/dependencyInjection/tokens/tokens-core.js` - Add `DismembermentApplicator` token
- `src/dependencyInjection/registrations/anatomyRegistrations.js` - Register applicator

## Out of Scope
- **DO NOT** modify `damageTypeEffectsService.js` in this ticket (integration is DMGFXSVC-009)
- **DO NOT** modify existing `damageTypeEffectsService.test.js` tests
- **DO NOT** change the `anatomy:dismembered` component schema
- **DO NOT** change the `anatomy:dismembered` event payload structure
- **DO NOT** modify the embedded part check logic (just extract it)

## Implementation Details

### DismembermentApplicator API
```javascript
class DismembermentApplicator {
  #logger;
  #entityManager;

  constructor({ logger, entityManager }) {
    // Validate dependencies
  }

  /**
   * Check if dismemberment should trigger and apply it if so.
   * @param {Object} params
   * @param {string} params.entityId - Owner entity ID
   * @param {string} params.entityName - For event payload
   * @param {string} params.entityPronoun - For event payload
   * @param {string} params.partId - Target part ID
   * @param {string} params.partType - For event payload
   * @param {string} params.orientation - For event payload
   * @param {number} params.damageAmount - Damage dealt
   * @param {string} params.damageTypeId - Damage type ID
   * @param {number} params.maxHealth - Part max health
   * @param {number} params.currentHealth - Part health after damage
   * @param {Object} params.effectDefinition - Resolved effect definition
   * @param {Object} params.damageEntryConfig - Config from damageEntry
   * @param {IEventDispatchStrategy} params.dispatchStrategy - From DMGFXSVC-003
   * @param {Object} [params.sessionContext] - For dispatch strategy
   * @returns {Promise<{triggered: boolean}>}
   */
  async apply(params) { ... }

  /**
   * Check if part is embedded (non-dismemberable).
   * @param {string} partId
   * @returns {Promise<boolean>}
   */
  async isEmbedded(partId) { ... }

  /**
   * Calculate if damage exceeds threshold.
   * @param {number} damageAmount
   * @param {number} maxHealth
   * @param {number} thresholdFraction
   * @returns {boolean}
   */
  meetsThreshold(damageAmount, maxHealth, thresholdFraction) { ... }
}
```

### Key Logic to Extract
From `damageTypeEffectsService.js` lines 517-594:
1. Check `anatomy:embedded` component on partId
2. Calculate threshold: `config.thresholdFraction ?? definition.defaults.thresholdFraction`
3. Compare: `damageAmount >= maxHealth * threshold`
4. Add `anatomy:dismembered` component: `{ sourceDamageType: damageTypeId }`
5. Dispatch event with payload: `entityId, entityName, entityPronoun, partId, partType, orientation, damageTypeId, timestamp`
6. Record effect in session if applicable

### DI Token
Add to `tokens-core.js`:
```javascript
DismembermentApplicator: 'DismembermentApplicator',
```

### Registration
Add to anatomy registrations:
```javascript
registrar.singletonFactory(tokens.DismembermentApplicator, (c) => {
  return new DismembermentApplicator({
    logger: c.resolve(tokens.ILogger),
    entityManager: c.resolve(tokens.IEntityManager),
  });
});
```

## Acceptance Criteria

### Tests That Must Pass

#### New Tests (dismembermentApplicator.test.js)
**Constructor**:
1. `validates logger dependency`
2. `validates entityManager dependency`

**apply()**:
1. `returns { triggered: false } when part is embedded`
2. `returns { triggered: false } when damage below threshold (default 0.8)`
3. `returns { triggered: true } when damage meets threshold exactly`
4. `returns { triggered: true } when damage exceeds threshold`
5. `uses config thresholdFraction over definition defaults`
6. `adds anatomy:dismembered component with correct data`
7. `dispatches event via strategy with correct payload`
8. `records effect via strategy when triggered`
9. `does not add component when not triggered`
10. `does not dispatch event when not triggered`

**isEmbedded()**:
1. `returns true when part has anatomy:embedded component`
2. `returns false when part lacks anatomy:embedded component`
3. `handles entityManager errors gracefully`

**meetsThreshold()**:
1. `returns false when damageAmount < maxHealth * threshold`
2. `returns true when damageAmount == maxHealth * threshold`
3. `returns true when damageAmount > maxHealth * threshold`
4. `handles edge case: maxHealth = 0`
5. `handles edge case: threshold = 0`
6. `handles edge case: threshold = 1`

#### Existing Tests
- All 68 existing `damageTypeEffectsService.test.js` tests must pass unchanged

### Invariants That Must Remain True
- **INV-1**: Dismemberment is always checked before other effects (orchestration in DMGFXSVC-009)
- **INV-4**: Effect application adds exactly one component to entity/part
- **INV-5**: Effect application dispatches exactly one event
- Embedded parts are never dismembered
- Component data structure: `{ sourceDamageType: string }`
- Event payload structure unchanged

## Verification Commands
```bash
# Run new tests
npm run test:unit -- tests/unit/anatomy/applicators/dismembermentApplicator.test.js

# Verify existing tests still pass
npm run test:unit -- tests/unit/anatomy/services/damageTypeEffectsService.test.js

# Verify DI registration compiles
npm run typecheck
```

## Size Estimate
- ~80 lines of implementation code
- ~200 lines of test code
- ~5 lines of DI registration

## Outcome

### What Was Actually Changed vs Originally Planned

**Files Created** (as planned):
- `src/anatomy/applicators/dismembermentApplicator.js` - Applicator class (~220 lines with JSDoc)
- `tests/unit/anatomy/applicators/dismembermentApplicator.test.js` - Unit tests (34 tests, ~300 lines)

**Files Modified** (minor deviation from plan):
- `src/dependencyInjection/tokens/tokens-core.js` - Added `DismembermentApplicator` token
- `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` - Registered applicator
  - **Note**: Ticket planned `anatomyRegistrations.js` but `worldAndEntityRegistrations.js` was the appropriate location as it already handles entity-related registrations

**Implementation Notes**:
- `isEmbedded()` was made synchronous (not async as spec suggested) since `hasComponent()` is synchronous
- Added comprehensive edge case handling in `meetsThreshold()` (threshold=0, threshold>1, maxHealth<=0)
- Exported default thresholds and component/event IDs for testing and future use

**Test Results**:
- All 34 new unit tests pass
- All 68 existing `damageTypeEffectsService.test.js` tests pass unchanged
- No TypeScript errors in new code
- ESLint passes (only expected mod-architecture warnings for anatomy: references)

**Invariants Verified**:
- INV-4: Effect application adds exactly one component (verified via mock assertions)
- INV-5: Effect application dispatches exactly one event (verified via mock assertions)
- Embedded parts are never dismembered (verified via dedicated tests)
- Component data structure matches spec: `{ sourceDamageType: string }`
- Event payload structure matches spec (all 8 fields verified)
