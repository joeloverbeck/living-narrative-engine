# DMGFXSVC-006: Extract BleedApplicator

## Status: COMPLETED

## Summary
Extract the bleed effect logic from `DamageTypeEffectsService` into a standalone `BleedApplicator` class.

## Motivation
- Bleed logic is ~60 lines in `#applyBleedEffect` (lines 710-769)
- Has unique logic: severity-based tick damage mapping
- Severity mapping needs isolated testing for edge cases

## Files to Touch

### Create
- `src/anatomy/applicators/bleedApplicator.js` - Applicator class
- `tests/unit/anatomy/applicators/bleedApplicator.test.js` - Unit tests

### Modify
- `src/dependencyInjection/tokens/tokens-core.js` - Add `BleedApplicator` token
- `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` - Register applicator

## Out of Scope
- **DO NOT** modify `damageTypeEffectsService.js` in this ticket (integration is DMGFXSVC-009)
- **DO NOT** modify existing `damageTypeEffectsService.test.js` tests
- **DO NOT** change the `anatomy:bleeding` component schema
- **DO NOT** change the `anatomy:bleeding_started` event payload structure
- **DO NOT** modify the severity classification logic (imported from `classifyDamageSeverity`)

## Implementation Details

### BleedApplicator API
```javascript
class BleedApplicator {
  #logger;
  #entityManager;

  constructor({ logger, entityManager }) {
    // Validate dependencies
  }

  /**
   * Apply bleed effect to a part.
   * @param {Object} params
   * @param {string} params.entityId - Owner entity ID
   * @param {string} params.partId - Target part ID
   * @param {string} params.severity - Damage severity ('minor', 'moderate', 'severe')
   * @param {Object} params.effectDefinition - Resolved effect definition
   * @param {Object} params.damageEntryConfig - Config from damageEntry.bleed
   * @param {IEventDispatchStrategy} params.dispatchStrategy - From DMGFXSVC-003
   * @param {Object} [params.sessionContext] - For dispatch strategy
   * @returns {Promise<{applied: boolean}>}
   */
  async apply(params) { ... }

  /**
   * Get tick damage for severity level.
   * @param {string} severity - 'minor', 'moderate', 'severe'
   * @param {Object} severityMap - Map of severity to { tickDamage } objects
   * @returns {number}
   */
  getTickDamageForSeverity(severity, severityMap) { ... }
}
```

### Key Logic to Extract
From `damageTypeEffectsService.js` lines 710-769:
1. Get severity from config (fallback to 'minor')
2. Get base duration from config or definition defaults: `baseDurationTurns` (default 2)
3. Get severity data from definition defaults or fallback to `BLEED_SEVERITY_MAP.minor`
4. Add `anatomy:bleeding` component to part: `{ severity, remainingTurns, tickDamage }`
5. Dispatch `anatomy:bleeding_started` event: `{ entityId, partId, severity, timestamp }`
6. Record effect in session if applicable

**Note**: The `currentHealth <= 0` skip check is performed by the caller in `applyEffectsForDamage`, not within `#applyBleedEffect`. The applicator itself does NOT check this condition.

### Severity Map Structure (from BLEED_SEVERITY_MAP constant)
```javascript
{
  minor: { tickDamage: 1 },
  moderate: { tickDamage: 3 },
  severe: { tickDamage: 5 }
}
```

### Effect Definition Defaults (from FALLBACK_EFFECT_DEFINITIONS.bleed)
```javascript
{
  id: 'bleeding',
  effectType: 'bleed',
  componentId: 'anatomy:bleeding',
  startedEventId: 'anatomy:bleeding_started',
  stoppedEventId: 'anatomy:bleeding_stopped',
  defaults: {
    baseDurationTurns: 2,
    severity: BLEED_SEVERITY_MAP
  }
}
```

### DI Token
Add to `tokens-core.js` (after `FractureApplicator`):
```javascript
BleedApplicator: 'BleedApplicator',
```

### Registration
Add to `worldAndEntityRegistrations.js` (after FractureApplicator registration):
```javascript
registrar.singletonFactory(tokens.BleedApplicator, (c) => {
  return new BleedApplicator({
    logger: c.resolve(tokens.ILogger),
    entityManager: c.resolve(tokens.IEntityManager),
  });
});
```

## Acceptance Criteria

### Tests That Must Pass

#### New Tests (bleedApplicator.test.js)
**Constructor**:
1. `validates logger dependency`
2. `validates entityManager dependency`
3. `creates instance with valid dependencies`

**apply()**:
1. `returns { applied: true } when effect is applied`
2. `adds anatomy:bleeding component with correct severity`
3. `uses config baseDurationTurns over definition defaults`
4. `uses definition defaults when config lacks baseDurationTurns`
5. `calculates correct tickDamage for minor severity`
6. `calculates correct tickDamage for moderate severity`
7. `calculates correct tickDamage for severe severity`
8. `falls back to minor tickDamage for unknown severity`
9. `dispatches event via strategy with correct payload`
10. `records effect via strategy when applied`
11. `uses config severity over default`
12. `uses custom componentId from effectDefinition`
13. `uses custom startedEventId from effectDefinition`

**getTickDamageForSeverity()**:
1. `returns correct value for minor severity`
2. `returns correct value for moderate severity`
3. `returns correct value for severe severity`
4. `returns minor value for unknown severity`
5. `handles custom severity maps from config`
6. `returns 0 when severity map is empty`

#### Existing Tests
- All 68 existing `damageTypeEffectsService.test.js` tests must pass unchanged

### Invariants That Must Remain True
- **INV-4**: Effect application adds exactly one component to entity/part
- **INV-5**: Effect application dispatches exactly one event
- Unknown severity falls back to 'minor' tick damage
- Component data structure: `{ severity, remainingTurns, tickDamage }`
- Event payload structure: `{ entityId, partId, severity, timestamp }`

## Verification Commands
```bash
# Run new tests
npm run test:unit -- tests/unit/anatomy/applicators/bleedApplicator.test.js

# Verify existing tests still pass
npm run test:unit -- tests/unit/anatomy/services/damageTypeEffectsService.test.js

# Verify DI registration compiles
npm run typecheck
```

## Size Estimate
- ~80 lines of implementation code
- ~250 lines of test code
- ~10 lines of DI registration

## Assumptions Correction Log
The following corrections were made to the original ticket after codebase analysis:

1. **Line numbers**: Original said "lines 700-760". Actual: lines 710-769.
2. **Registration file**: Original said `anatomyRegistrations.js`. Actual: `worldAndEntityRegistrations.js`.
3. **Severity map structure**: Original showed flat numbers `{ minor: 1 }`. Actual: nested `{ minor: { tickDamage: 1 } }`.
4. **Default duration**: Original said default 3. Actual: default 2.
5. **Health skip check**: Original included `currentHealth <= 0` skip logic. Actual: This check is done by the caller, not the bleed effect method itself.

## Outcome

### What Was Actually Changed vs Originally Planned

**Files Created (as planned):**
- `src/anatomy/applicators/bleedApplicator.js` (199 lines) - BleedApplicator class with severity-based tick damage logic
- `tests/unit/anatomy/applicators/bleedApplicator.test.js` (395 lines) - Comprehensive unit tests with 41 test cases

**Files Modified (as planned):**
- `src/dependencyInjection/tokens/tokens-core.js` - Added `BleedApplicator` token
- `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` - Added import and registration

**Test Results:**
- ✅ 41 new BleedApplicator tests pass
- ✅ 68 existing damageTypeEffectsService tests pass unchanged
- ✅ All invariants verified (INV-4, INV-5)

**New/Modified Tests with Rationale:**

| Test Category | Count | Rationale |
|---------------|-------|-----------|
| Constructor validation | 3 | Ensures dependency injection requirements are enforced |
| getTickDamageForSeverity | 10 | Thorough edge case coverage for severity map handling (null, empty, missing keys) |
| apply() basic behavior | 8 | Core functionality tests matching original damageTypeEffectsService behavior |
| apply() configuration priority | 6 | Ensures config → definition defaults → hardcoded defaults precedence |
| apply() custom definitions | 4 | Tests effectDefinition.componentId and startedEventId overrides |
| Exported constants | 4 | Validates exported constants match expected values |
| Invariants | 4 | Ensures architectural invariants (INV-4, INV-5) are maintained |

**Deviations from Plan:**
- None. Implementation followed the corrected ticket exactly.

**Additional Edge Cases Covered Beyond Original Acceptance Criteria:**
- `returns 0 when severity map is null`
- `returns 0 when severity map is undefined`
- `returns 0 when severity data has no tickDamage property`
- `returns 0 when unknown severity and no minor in map`
- `uses custom severity map from effectDefinition.defaults`
- `defaults to minor severity when no config severity`
- `includes all required component data fields`
- `includes all required event payload fields`
