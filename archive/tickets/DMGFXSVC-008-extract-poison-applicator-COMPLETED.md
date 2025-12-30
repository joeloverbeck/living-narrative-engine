# DMGFXSVC-008: Extract PoisonApplicator

## Summary
Extract the poison effect logic from `DamageTypeEffectsService` into a standalone `PoisonApplicator` class.

## Motivation
- Poison logic is ~57 lines in `#applyPoisonEffect` (lines 876-933)
- Has unique logic: scope-aware application (part vs entity)
- Entity-scope poison targets a different entity than part-scope

## Files to Touch

### Create
- `src/anatomy/applicators/poisonApplicator.js` - Applicator class
- `tests/unit/anatomy/applicators/poisonApplicator.test.js` - Unit tests

### Modify
- `src/dependencyInjection/tokens/tokens-core.js` - Add `PoisonApplicator` token
- `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` - Register applicator

## Out of Scope
- **DO NOT** modify `damageTypeEffectsService.js` in this ticket (integration is DMGFXSVC-009)
- **DO NOT** modify existing `damageTypeEffectsService.test.js` tests
- **DO NOT** change the `anatomy:poisoned` component schema
- **DO NOT** change the `anatomy:poisoned_started` event payload structure
- **DO NOT** modify entity-level vs part-level targeting logic (just extract it)

## Implementation Details

### PoisonApplicator API
```javascript
class PoisonApplicator {
  #logger;
  #entityManager;

  constructor({ logger, entityManager }) {
    // Validate dependencies
  }

  /**
   * Apply poison effect to a part or entity.
   * NOTE: The currentHealth <= 0 check is performed by the caller (applyEffectsForDamage).
   * @param {Object} params
   * @param {string} params.entityId - Owner entity ID
   * @param {string} params.partId - Target part ID (used when scope is 'part')
   * @param {Object} params.effectDefinition - Resolved effect definition
   * @param {Object} params.damageEntryConfig - Config from damageEntry.poison
   * @param {IEventDispatchStrategy} params.dispatchStrategy - From DMGFXSVC-003
   * @param {Object} [params.sessionContext] - For dispatch strategy
   * @returns {Promise<{applied: boolean, scope: string, targetId: string}>}
   */
  async apply(params) { ... }
}
```

### Key Logic to Extract
From `damageTypeEffectsService.js` lines 876-933:
1. Get tick damage from config (`poison.tick`) or definition defaults (`tickDamage`) - default 1
2. Get duration from config or definition defaults (`durationTurns`) - default 3
3. Get scope from config or definition defaults - default 'part'
4. Determine target ID:
   - If `scope === 'entity'`: target is `entityId`
   - If `scope === 'part'`: target is `partId`
5. Add `anatomy:poisoned` component to target: `{ remainingTurns, tickDamage }`
6. Dispatch `anatomy:poisoned_started` event:
   - `entityId` always included
   - `partId` included only when `scope === 'part'`
   - `scope` field indicates targeting mode
   - `timestamp`
7. Record effect in session via dispatchStrategy

### Scope Configuration Structure (from defaults)
```javascript
{
  defaults: {
    tickDamage: 1,
    durationTurns: 3,
    scope: 'part'  // 'part' or 'entity'
  }
}
```

### Event Payload Differences by Scope
```javascript
// Part scope
{ entityId, partId, scope: 'part', timestamp }

// Entity scope
{ entityId, partId: undefined, scope: 'entity', timestamp }
```

### DI Token
Add to `tokens-core.js`:
```javascript
PoisonApplicator: 'PoisonApplicator',
```

### Registration
Add to `worldAndEntityRegistrations.js` (after BurnApplicator):
```javascript
// Register PoisonApplicator
registrar.singletonFactory(tokens.PoisonApplicator, (c) => {
  return new PoisonApplicator({
    logger: c.resolve(tokens.ILogger),
    entityManager: c.resolve(tokens.IEntityManager),
  });
});
```

## Acceptance Criteria

### Tests That Must Pass

#### New Tests (poisonApplicator.test.js)
**Constructor**:
1. `validates logger dependency`
2. `validates entityManager dependency`
3. `creates instance with valid dependencies`

**apply()**:
1. `returns { applied: true, scope: 'part' } for part-scope poison`
2. `returns { applied: true, scope: 'entity' } for entity-scope poison`
3. `adds anatomy:poisoned component to part when scope is 'part'`
4. `adds anatomy:poisoned component to entity when scope is 'entity'`
5. `uses config tick over definition defaults for tickDamage`
6. `uses config durationTurns over definition defaults`
7. `uses config scope over definition defaults`
8. `uses definition defaults when config lacks values`
9. `uses hardcoded defaults when no config or definition`
10. `dispatches event via strategy with partId when part-scope`
11. `dispatches event via strategy without partId when entity-scope`
12. `dispatches event via strategy with correct scope field`
13. `records effect via strategy when applied`
14. `uses custom componentId from effectDefinition`
15. `uses custom startedEventId from effectDefinition`

**Invariants**:
1. `INV-4: adds exactly one component to target`
2. `INV-5: dispatches exactly one event`
3. `component data structure matches expected format`
4. `event payload structure matches expected format for part-scope`
5. `event payload structure matches expected format for entity-scope`

#### Existing Tests
- All 68 existing `damageTypeEffectsService.test.js` tests must pass unchanged

### Invariants That Must Remain True
- **INV-4**: Effect application adds exactly one component to entity/part
- **INV-5**: Effect application dispatches exactly one event
- Entity-scope poison targets the owner entity, not the part
- Part-scope poison targets the part
- Component data structure: `{ remainingTurns, tickDamage }`
- Event payload includes `scope` field

## Verification Commands
```bash
# Run new tests
npm run test:unit -- tests/unit/anatomy/applicators/poisonApplicator.test.js

# Verify existing tests still pass
npm run test:unit -- tests/unit/anatomy/services/damageTypeEffectsService.test.js

# Verify DI registration compiles
npm run typecheck
```

## Size Estimate
- ~60 lines of implementation code
- ~250 lines of test code
- ~10 lines of DI registration

## Outcome

### Status: COMPLETED

### Files Created
- `src/anatomy/applicators/poisonApplicator.js` (183 lines) - PoisonApplicator class following established BleedApplicator/BurnApplicator patterns
- `tests/unit/anatomy/applicators/poisonApplicator.test.js` (582 lines) - Comprehensive unit tests with 41 test cases

### Files Modified
- `src/dependencyInjection/tokens/tokens-core.js` - Added `PoisonApplicator: 'PoisonApplicator'` token
- `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` - Added PoisonApplicator import and singleton factory registration

### Test Results
- **New tests**: 41 passed (poisonApplicator.test.js)
- **Existing tests**: 68 passed (damageTypeEffectsService.test.js) - unchanged

### Verification
```bash
# New tests passed
NODE_ENV=test npx jest tests/unit/anatomy/applicators/poisonApplicator.test.js
# Result: 41 passed

# Existing tests unchanged
NODE_ENV=test npx jest tests/unit/anatomy/services/damageTypeEffectsService.test.js
# Result: 68 passed
```

### Invariants Preserved
- **INV-4**: Verified - exactly one component added per apply() call
- **INV-5**: Verified - exactly one event dispatched per apply() call
- Entity-scope vs part-scope targeting logic extracted unchanged
- Component data structure: `{ remainingTurns, tickDamage }`
- Event payload includes `scope` field as required

### Notes
- Implementation follows exact patterns from BleedApplicator and BurnApplicator
- Supports custom componentId and startedEventId from effectDefinition for extensibility
- Handles all edge cases: null/undefined config, zero values, empty objects
- DamageTypeEffectsService NOT modified per ticket scope - integration deferred to DMGFXSVC-009
