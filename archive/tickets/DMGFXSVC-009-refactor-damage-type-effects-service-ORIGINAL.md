# DMGFXSVC-009: Refactor DamageTypeEffectsService to Use Extracted Services

## Summary
Refactor `DamageTypeEffectsService` to use all extracted services from tickets 001-008, transforming it from a monolithic 937-line file into a lean orchestrator.

## Motivation
- Original file has 937 lines with 80.18% branch coverage
- Unreachable branches exist due to cascading defensive fallbacks
- After extraction, the service should be ~200 lines focused on orchestration
- Target branch coverage: 95%+

## Dependencies
**This ticket requires completion of:**
- DMGFXSVC-001 (WarningTracker)
- DMGFXSVC-002 (EffectDefinitionResolver)
- DMGFXSVC-003 (EventDispatchStrategy)
- DMGFXSVC-004 (DismembermentApplicator)
- DMGFXSVC-005 (FractureApplicator)
- DMGFXSVC-006 (BleedApplicator)
- DMGFXSVC-007 (BurnApplicator)
- DMGFXSVC-008 (PoisonApplicator)

## Files to Touch

### Modify
- `src/anatomy/services/damageTypeEffectsService.js` - Refactor to use extracted services
- `src/dependencyInjection/registrations/anatomyRegistrations.js` - Update DI registration

### Do NOT Create
- No new files in this ticket (all new files created in 001-008)

## Out of Scope
- **DO NOT** change the public API signature of `applyEffectsForDamage`
- **DO NOT** change the constructor's external contract (though internal dependencies change)
- **DO NOT** change event payloads or component data structures
- **DO NOT** modify the extracted services (001-008)
- **DO NOT** change the exported constants (component IDs, event types)

## Implementation Details

### New Constructor Signature
```javascript
constructor({
  logger,
  entityManager,
  safeEventDispatcher,
  statusEffectRegistry,       // Still optional for backwards compatibility
  rngProvider,                // Still optional
  // New injected services:
  effectDefinitionResolver,   // From DMGFXSVC-002
  warningTracker,             // From DMGFXSVC-001
  dismembermentApplicator,    // From DMGFXSVC-004
  fractureApplicator,         // From DMGFXSVC-005
  bleedApplicator,            // From DMGFXSVC-006
  burnApplicator,             // From DMGFXSVC-007
  poisonApplicator,           // From DMGFXSVC-008
})
```

### Refactored applyEffectsForDamage
```javascript
async applyEffectsForDamage(params) {
  const { damageEntry, damageSession, rng } = params;

  // Early validation
  if (!damageEntry) {
    this.#logger.warn('applyEffectsForDamage: damageEntry is null/undefined');
    return { severity: 'none' };
  }

  // Create dispatch strategy for this call
  const dispatchStrategy = createDispatchStrategy(
    this.#dispatcher,
    this.#logger,
    damageSession
  );
  const sessionContext = { damageSession };

  // Resolve effect apply order
  const applyOrder = this.#effectDefinitionResolver.resolveApplyOrder();
  const activeRng = rng ?? this.#rngProvider ?? Math.random;

  // Process effects in order
  for (const effectId of applyOrder) {
    const result = await this.#applyEffect(effectId, params, dispatchStrategy, sessionContext, activeRng);

    // Dismemberment short-circuits all other effects
    if (effectId === 'dismembered' && result?.triggered) {
      return { severity: 'catastrophic' };
    }
  }

  return { severity: classifyDamageSeverity(params.damageEntry.damageAmount, params.maxHealth) };
}
```

### Refactored #applyEffect (Internal Orchestrator)
```javascript
async #applyEffect(effectId, params, dispatchStrategy, sessionContext, rng) {
  const { damageEntry, entityId, partId, currentHealth } = params;

  const effectType = this.#mapEffectIdToType(effectId);
  if (!damageEntry[effectType]?.enabled) {
    return { triggered: false, applied: false };
  }

  const effectDefinition = this.#effectDefinitionResolver.resolveEffectDefinition(effectType);
  const damageEntryConfig = damageEntry[effectType];

  const applicatorParams = {
    ...params,
    effectDefinition,
    damageEntryConfig,
    dispatchStrategy,
    sessionContext,
    rng,
  };

  switch (effectType) {
    case 'dismember':
      return this.#dismembermentApplicator.apply(applicatorParams);
    case 'fracture':
      return this.#fractureApplicator.apply(applicatorParams);
    case 'bleed':
      return this.#bleedApplicator.apply(applicatorParams);
    case 'burn':
      return this.#burnApplicator.apply(applicatorParams);
    case 'poison':
      return this.#poisonApplicator.apply(applicatorParams);
    default:
      this.#warningTracker.warnOnce('unknownEffect', effectId, `Unknown effect ID: ${effectId}`);
      return { triggered: false, applied: false };
  }
}
```

### Updated DI Registration
```javascript
registrar.singletonFactory(tokens.DamageTypeEffectsService, (c) => {
  return new DamageTypeEffectsService({
    logger: c.resolve(tokens.ILogger),
    entityManager: c.resolve(tokens.IEntityManager),
    safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
    statusEffectRegistry: c.resolve(tokens.StatusEffectRegistry),
    effectDefinitionResolver: c.resolve(tokens.EffectDefinitionResolver),
    warningTracker: c.resolve(tokens.WarningTracker),
    dismembermentApplicator: c.resolve(tokens.DismembermentApplicator),
    fractureApplicator: c.resolve(tokens.FractureApplicator),
    bleedApplicator: c.resolve(tokens.BleedApplicator),
    burnApplicator: c.resolve(tokens.BurnApplicator),
    poisonApplicator: c.resolve(tokens.PoisonApplicator),
  });
});
```

### Code to Remove
- `FALLBACK_EFFECT_DEFINITIONS` constant (moved to DMGFXSVC-002)
- `FALLBACK_APPLY_ORDER` constant (moved to DMGFXSVC-002)
- `mergeDefaults` function (moved to DMGFXSVC-002)
- `#resolveEffectDefinition` method (now in resolver)
- `#getApplyOrder` method (now in resolver)
- `#missingDefinitionWarnings` Set (now in WarningTracker)
- `#missingOrderWarnings` Set (now in WarningTracker)
- `#checkAndApplyDismemberment` method (now in applicator)
- `#checkAndApplyFracture` method (now in applicator)
- `#applyBleedEffect` method (now in applicator)
- `#applyBurnEffect` method (now in applicator)
- `#applyPoisonEffect` method (now in applicator)
- All `if (damageSession) { ... } else { ... }` blocks (now in strategy)

## Acceptance Criteria

### Tests That Must Pass

#### All 68 Existing Tests
Every test in `damageTypeEffectsService.test.js` must pass unchanged. The tests are:
- Constructor validation (lines 39-94)
- Dismemberment tests (lines 144-295)
- Fracture tests (lines 297-442)
- Bleed tests (lines 444-549)
- Burn tests (lines 551-671)
- Poison tests (lines 673-768)
- Processing order tests (lines 770-880)
- Registry defaults tests (lines 882-964)
- Session integration tests (lines 966-1331)
- Registry signaling tests (lines 1334-1375)
- Multi-mod registry tests (lines 1544-1723)
- Warning suppression tests (lines 1727-1846)

#### Coverage Requirements
- Branch coverage must be ≥95% (up from 80.18%)
- The remaining 5% should be genuinely defensive code, not architecturally unreachable

### Invariants That Must Remain True
- **INV-1**: Dismemberment is always checked before other effects
- **INV-2**: Fracture is always checked before bleed/burn/poison
- **INV-3**: Custom applyOrder from registry is respected when provided
- **INV-4**: Every effect application adds exactly one component
- **INV-5**: Every effect application dispatches exactly one event
- **INV-6**: Merged defaults always contain all required fields
- **INV-7**: Warn-once caches accumulate but never shrink
- **INV-8**: Registry definitions override (deep merge), not replace fallbacks

### API Stability Checks
- Public method `applyEffectsForDamage` signature unchanged
- All exported constants unchanged:
  - `BLEEDING_COMPONENT_ID`
  - `BURNING_COMPONENT_ID`
  - `POISONED_COMPONENT_ID`
  - `DISMEMBERED_COMPONENT_ID`
  - `BLEEDING_STOPPED_EVENT`
  - `BURNING_STOPPED_EVENT`
  - `POISONED_STOPPED_EVENT`

## Verification Commands
```bash
# Run all existing tests
npm run test:unit -- tests/unit/anatomy/services/damageTypeEffectsService.test.js

# Verify coverage improvement
npm run test:unit -- tests/unit/anatomy/services/damageTypeEffectsService.test.js --coverage

# Verify all new services work together
npm run test:unit -- tests/unit/anatomy/

# Verify DI registration compiles
npm run typecheck

# Verify no eslint errors
npx eslint src/anatomy/services/damageTypeEffectsService.js
```

## Size Estimate
- ~200 lines of refactored code (down from 937)
- ~50 lines of test updates (mocking new dependencies)
- ~20 lines of DI registration updates
