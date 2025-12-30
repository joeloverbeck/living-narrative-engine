# DMGFXSVC-002: Extract EffectDefinitionResolver Service

## Status
Completed

## Summary
Extract defaults resolution logic from `DamageTypeEffectsService` into a standalone, injectable `EffectDefinitionResolver` service, including the `mergeDefaults` function and fallback effect definitions.

## Motivation
Current issues (from spec):
- `mergeDefaults` is a pure function that cannot be injected or mocked for testing
- Optional `StatusEffectRegistry` creates dual execution paths requiring duplicated test coverage
- Three-level defaults hierarchy (static → registry → runtime) has implicit merge semantics
- Tests at lines 798-964, 1334-1375, 1544-1723 all test the same resolution logic through different paths

## Corrections to Assumptions & Scope
- DI registration for damage/anatomy services lives in `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` (not `anatomyRegistrations.js`).
- `StatusEffectRegistry.getApplyOrder()` returns an array (empty when unset); it does not return `null` per `src/anatomy/services/statusEffectRegistry.js`.
- `DamageTypeEffectsService` retains its internal fallback constants in this ticket. The new constants file is used by the resolver only; integration into `DamageTypeEffectsService` remains in DMGFXSVC-009.
- `WarningTracker` already exists and is registered in worldAndEntityRegistrations; the resolver uses it for warn-once behavior.

## Files to Touch

### Create
- `src/anatomy/services/effectDefinitionResolver.js` - New service class
- `src/anatomy/constants/fallbackEffectDefinitions.js` - Fallback definitions for the resolver
- `tests/unit/anatomy/services/effectDefinitionResolver.test.js` - Unit tests

### Modify
- `src/dependencyInjection/tokens/tokens-core.js` - Add `EffectDefinitionResolver` token
- `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` - Register service

## Out of Scope
- **DO NOT** modify `damageTypeEffectsService.js` in this ticket (integration is DMGFXSVC-009)
- **DO NOT** modify existing `damageTypeEffectsService.test.js` tests
- **DO NOT** change the structure of `FALLBACK_EFFECT_DEFINITIONS` values
- **DO NOT** change the merge semantics (deep merge for objects, shallow copy for arrays/primitives)
- **DO NOT** modify `StatusEffectRegistry` interface

## Implementation Details

### EffectDefinitionResolver API
```javascript
import { FALLBACK_EFFECT_DEFINITIONS, FALLBACK_APPLY_ORDER } from '../constants/fallbackEffectDefinitions.js';

class EffectDefinitionResolver {
  #statusEffectRegistry;
  #fallbackDefinitions;
  #fallbackApplyOrder;
  #warningTracker;

  constructor({
    statusEffectRegistry = null,
    fallbackDefinitions = FALLBACK_EFFECT_DEFINITIONS,
    fallbackApplyOrder = FALLBACK_APPLY_ORDER,
    warningTracker,
  }) { ... }

  resolveEffectDefinition(effectType) { ... }
  resolveApplyOrder() { ... }
  mergeDefaults(fallbackDefaults, registryDefaults) { ... }
}
```

### Extracted Constant File (fallbackEffectDefinitions.js)
```javascript
export const FALLBACK_EFFECT_DEFINITIONS = {
  dismember: { id: 'dismembered', effectType: 'dismember', componentId: 'anatomy:dismembered', ... },
  fracture: { id: 'fractured', effectType: 'fracture', componentId: 'anatomy:fractured', ... },
  bleed: { id: 'bleeding', effectType: 'bleed', componentId: 'anatomy:bleeding', stoppedEventId: 'anatomy:bleeding_stopped', ... },
  burn: { id: 'burning', effectType: 'burn', componentId: 'anatomy:burning', stoppedEventId: 'anatomy:burning_stopped', ... },
  poison: { id: 'poisoned', effectType: 'poison', componentId: 'anatomy:poisoned', stoppedEventId: 'anatomy:poisoned_stopped', ... },
};

export const FALLBACK_APPLY_ORDER = ['dismembered', 'fractured', 'bleeding', 'burning', 'poisoned'];
```

### Apply Order Resolution Notes
- If the registry is absent or `getApplyOrder()` returns an empty array, return the fallback apply order.
- For IDs not in the damage definitions, check `statusEffectRegistry.get(id)`:
  - If the registry contains the ID, skip silently (non-damage effects).
  - If the registry does not contain the ID, warn once.

## Acceptance Criteria

### New Tests (effectDefinitionResolver.test.js)
**resolveEffectDefinition**:
1. `returns fallback definition when registry is absent`
2. `returns fallback definition when registry has no matching effect`
3. `merges registry defaults with fallback defaults`
4. `warns once when definition is missing`

**resolveApplyOrder**:
1. `returns fallback order when registry is absent`
2. `returns fallback order when registry order is empty`
3. `returns registry order when it already includes all fallback ids`
4. `appends missing fallback ids to registry order`
5. `skips non-damage ids in registry order without warning`
6. `warns for unknown ids missing from registry`

**mergeDefaults**:
1. `performs deep merge for nested objects`
2. `performs shallow copy for arrays`
3. `preserves fallback keys when registry is empty`
4. `registry values take precedence over fallback values`

### Existing Tests
- All 68 existing `damageTypeEffectsService.test.js` tests must pass unchanged

### Invariants That Must Remain True
- **INV-6**: Merged defaults always contain all required fields from fallbacks
- **INV-8**: Registry definitions override fallback definitions, not replace them (deep merge)
- Effect definitions returned always have:
  - `id` (string)
  - `effectType` (string)
  - `componentId` (string)
  - `startedEventId` (string)
  - `defaults` (object with effect-specific defaults)

## Verification Commands
```bash
# Run new tests
npm run test:unit -- tests/unit/anatomy/services/effectDefinitionResolver.test.js

# Verify existing tests still pass
npm run test:unit -- tests/unit/anatomy/services/damageTypeEffectsService.test.js

# Verify DI registration compiles
npm run typecheck
```

## Outcome
- Added `EffectDefinitionResolver`, its fallback constants file, DI token/registration, and focused unit tests.
- Left `DamageTypeEffectsService` unchanged; integration with the new resolver and constant deduplication remains deferred to DMGFXSVC-009.
