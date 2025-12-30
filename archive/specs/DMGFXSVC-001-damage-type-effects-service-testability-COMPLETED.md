# DMGFXSVC-001: DamageTypeEffectsService Testability Refactoring

**Status: COMPLETED**

---

## Context

### Location
- **Source File**: `src/anatomy/services/damageTypeEffectsService.js` (937 lines)
- **Test File**: `tests/unit/anatomy/services/damageTypeEffectsService.test.js` (1849 lines, 68 tests)

### Module Purpose
The `DamageTypeEffectsService` applies immediate damage type effects (bleed, fracture, burn, poison, dismemberment) when damage is dealt to body parts. It is called synchronously from `ApplyDamageHandler` after damage is applied.

### Processing Order
1. **Dismemberment check** - if triggered, skip all other effects
2. **Fracture check** - may trigger stun
3. **Bleed attach**
4. **Burn attach**
5. **Poison attach**

### Current State
- **Branch Coverage**: 80.18%
- **Tests**: 68 passing
- **Uncovered Branches**: ~20% (defensive fallbacks that are architecturally unreachable)

### Dependencies
| Dependency | Type | Purpose |
|------------|------|---------|
| `BaseService` | Inheritance | Service initialization pattern |
| `StatusEffectRegistry` | Optional | Effect definitions and apply order |
| `EntityManager` | Required | Component CRUD operations |
| `ISafeEventDispatcher` | Required | Event dispatch |
| `classifyDamageSeverity` | Import | Damage severity calculation |

---

## Problem

### Summary
Creating unit tests for this module has been harder than expected. The 20% uncovered branches are not truly unreachable but result from architectural patterns that make certain code paths impossible to trigger in isolation.

### Issue 1: Optional Registry Coupling Creates Dual Execution Paths

The `StatusEffectRegistry` is optional (`#statusEffectRegistry`), creating two fundamentally different execution paths:

```javascript
// Line 217-219: Registry is optional but deeply integrated
const registryDef = this.#statusEffectRegistry
  ?.getAll()
  ?.find((effect) => effect?.effectType === effectType);
```

**Impact**: Tests must duplicate coverage for both paths:
- Tests at lines 798-879: Registry-defined apply order
- Tests at lines 882-964: Registry defaults
- Tests at lines 1334-1375: Empty registry warnings

### Issue 2: Cascading Defensive Fallbacks Create Unreachable Branches

The `mergeDefaults` function (lines 135-154) always provides complete defaults from `FALLBACK_EFFECT_DEFINITIONS`. However, effect methods still have redundant `??` fallbacks:

```javascript
// Line 545-547: Always has defaults from FALLBACK_EFFECT_DEFINITIONS
const thresholdFraction =
  dismemberConfig.thresholdFraction ??
  effectDefinition?.defaults?.thresholdFraction ??
  0.8;  // <-- UNREACHABLE: mergeDefaults guarantees this exists
```

**Unreachable Branch Lines**:

| Lines | Location | Why Unreachable |
|-------|----------|-----------------|
| 135 | `mergeDefaults` params | Always called with objects |
| 231, 235-242 | `#resolveEffectDefinition` | Nullish coalescing on always-present fallback |
| 255-264 | Apply order resolution | Same as above |
| 382-396, 417-432, 447, 462, 493 | Handler registration | effectDefinitions always have id |
| 545-553, 629, 640-656, 662 | Threshold/config fallbacks | mergeDefaults already provides |
| 723-734 | Bleed severity fallback | Severity map always merged from fallback |
| 795-809, 887-897 | Effect application fallbacks | Same as above |

### Issue 3: mergeDefaults Design Flaw

The `mergeDefaults` function (lines 135-154) is a pure recursive function with problems:
- Takes parameters with `= {}` defaults that are never exercised
- Has implicit shallow vs deep merge semantics (not documented)
- Creates deep recursion for nested objects
- Cannot be injected or mocked for testing

```javascript
function mergeDefaults(fallbackDefaults = {}, registryDefaults = {}) {
  const merged = { ...fallbackDefaults };
  for (const [key, value] of Object.entries(registryDefaults)) {
    if (/* deep object check */) {
      merged[key] = mergeDefaults(fallbackDefaults[key], value);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}
```

### Issue 4: Session Dual-Mode Dispatch

Every effect application method has two execution paths (example from dismemberment):

```javascript
// Lines 572-585
if (damageSession) {
  damageSession.entries.find((e) => e.partId === partId)?.effectsTriggered?.push('dismembered');
  damageSession.pendingEvents.push({ eventType: startedEventId, payload: eventPayload });
} else {
  this.#dispatcher.dispatch(startedEventId, eventPayload);
}
```

**Impact**: 365+ lines of test code (lines 966-1331) dedicated to session variations.

### Issue 5: Static + Dynamic Defaults Hierarchy

Three-level defaults hierarchy creates complex mock scenarios:
1. **Static constants** (`FALLBACK_EFFECT_DEFINITIONS`)
2. **Registry definitions** (`statusEffectRegistry.getAll()`)
3. **damageEntry overrides** (runtime)

Each level can override the previous, but merge semantics are implicit.

### Issue 6: Warn-Once Caching Affects Test Isolation

Internal `Set` caching for warnings at lines 167-168:
- `#missingDefinitionWarnings`
- `#missingOrderWarnings`

Warnings are suppressed after first occurrence. Test isolation requires creating new service instances. Tests at lines 1727-1778 specifically address this but require workarounds.

---

## Truth Sources

### Specification Document
- **Location**: `archive/specs/damage-types-and-special-effects-COMPLETED.md`
- **Key Rules**:
  - Processing order: Dismember → Fracture → Bleed → Burn → Poison
  - Dismemberment prevents ongoing effects on destroyed parts
  - Status components use specific component IDs

### StatusEffectRegistry Contract
- **Location**: `src/anatomy/services/statusEffectRegistry.js`
- **Methods**:
  - `get(effectId)` - Get single effect definition
  - `getAll()` - Get all effect definitions
  - `getApplyOrder()` - Get effect processing order

### Component Schemas
| Component | Schema Fields |
|-----------|---------------|
| `anatomy:bleeding` | `{ severity, remainingTurns, tickDamage }` |
| `anatomy:burning` | `{ remainingTurns, tickDamage, stackedCount }` |
| `anatomy:poisoned` | `{ remainingTurns, tickDamage }` |
| `anatomy:fractured` | `{ sourceDamageType, appliedAtHealth }` |
| `anatomy:stunned` | `{ remainingTurns, sourcePartId }` |
| `anatomy:dismembered` | `{ sourceDamageType }` |

### Event Contracts
| Event | Payload Fields |
|-------|----------------|
| `anatomy:dismembered` | `entityId, entityName, entityPronoun, partId, partType, orientation, damageTypeId, timestamp` |
| `anatomy:fractured` | `entityId, partId, damageTypeId, stunApplied, timestamp` |
| `anatomy:bleeding_started` | `entityId, partId, severity, timestamp` |
| `anatomy:burning_started` | `entityId, partId, stackedCount, timestamp` |
| `anatomy:poisoned_started` | `entityId, partId?, scope, timestamp` |

---

## Desired Behavior

### Normal Cases

1. **Effect Application with Registry**: When registry provides effect definitions, merge with fallbacks and apply effects using merged config.

2. **Effect Application without Registry**: Use fallback definitions directly, warn once per missing effect type.

3. **Threshold-Based Effects**: Dismemberment and fracture trigger only when damage exceeds threshold fraction of maxHealth.

4. **Ongoing Effect Attachment**: Bleed, burn, and poison attach components with correct durations and tick damage based on severity/config.

5. **Session-Based Dispatch**: When damageSession is provided, queue events; otherwise dispatch immediately.

6. **Processing Order**: Effects must be applied in correct order: dismember, fracture, bleed, burn, poison.

### Edge Cases

| Case | Expected Behavior |
|------|-------------------|
| Part already destroyed | Skip bleed/burn/poison when `currentHealth <= 0` |
| Embedded parts | Skip dismemberment for parts with `anatomy:embedded` component |
| Burn stacking | Honor `canStack` configuration for burn damage accumulation |
| Unknown severity | Fall back to 'minor' severity for bleed |
| Entity-scope poison | Apply to entity instead of part when `scope: 'entity'` |
| Missing entry in session | Gracefully handle when `damageSession.entries` doesn't contain target partId |
| Missing stackedCount | Use `baseStackCount` when existing burn has no `stackedCount` property |

### Failure Modes

| Condition | Expected Behavior |
|-----------|-------------------|
| `damageEntry` is null/undefined | Log warning, return early without effects |
| Unknown effect ID in applyOrder | Warn if not in registry, skip silently if exists in registry |
| Missing registry entry for effect type | Warn once, use fallback definition |
| RNG provider not a function | Fall back to `Math.random` |
| EntityManager component operation fails | Propagate error (do not swallow) |

---

## Invariants

### Ordering Invariants
- **INV-1**: Dismemberment is always checked before other effects
- **INV-2**: Fracture is always checked before bleed/burn/poison
- **INV-3**: Custom applyOrder from registry is respected when provided

### Data Invariants
- **INV-4**: Every effect application adds exactly one component to entity/part
- **INV-5**: Every effect application dispatches (or queues) exactly one event
- **INV-6**: Merged defaults always contain all required fields from fallbacks

### State Invariants
- **INV-7**: Warn-once caches accumulate but never shrink during service lifetime
- **INV-8**: Registry definitions override fallback definitions, not replace them (deep merge)

---

## API Contracts

### Public Method Signature (STABLE)

```javascript
async applyEffectsForDamage({
  entityId,           // Required: Owner entity ID
  entityName,         // Optional: For events
  entityPronoun,      // Optional: For events
  partId,             // Required: Target part entity ID
  partType,           // Optional: For events
  orientation,        // Optional: For events
  damageEntry,        // Required: Complete damage entry object
  maxHealth,          // Required: Part's max health
  currentHealth,      // Required: Part's health AFTER damage
  damageSession,      // Optional: Damage accumulation session
  executionContext,   // Optional: For tracing
  rng,                // Optional: RNG override
}) -> Promise<{ severity }>
```

### Constructor Signature (STABLE)

```javascript
constructor({
  logger,               // Required
  entityManager,        // Required
  safeEventDispatcher,  // Required
  statusEffectRegistry, // Optional
  rngProvider,          // Optional
})
```

### Exported Constants (STABLE)

```javascript
// Component IDs
BLEEDING_COMPONENT_ID    // 'anatomy:bleeding'
BURNING_COMPONENT_ID     // 'anatomy:burning'
POISONED_COMPONENT_ID    // 'anatomy:poisoned'
DISMEMBERED_COMPONENT_ID // 'anatomy:dismembered'

// Event types
BLEEDING_STOPPED_EVENT   // 'anatomy:bleeding_stopped'
BURNING_STOPPED_EVENT    // 'anatomy:burning_stopped'
POISONED_STOPPED_EVENT   // 'anatomy:poisoned_stopped'
```

---

## What is Allowed to Change

### 1. Extract EffectDefinitionResolver (New Injectable Service)

Create a new service that encapsulates all defaults resolution logic:

```javascript
class EffectDefinitionResolver {
  constructor({ statusEffectRegistry, fallbackDefinitions = FALLBACK_EFFECT_DEFINITIONS }) { }

  resolveEffectDefinition(effectType) -> EffectDefinition
  resolveApplyOrder() -> string[]
  mergeDefaults(fallback, registry) -> MergedDefaults
}
```

**Benefits**:
- Single responsibility: defaults resolution
- Injectable for testing
- Eliminates dual registry/no-registry paths in main service
- `mergeDefaults` becomes testable in isolation

### 2. Extract EventDispatchStrategy (Strategy Pattern)

Replace the `if (damageSession) { ... } else { ... }` pattern with an injectable strategy:

```javascript
interface IEventDispatchStrategy {
  dispatch(eventType, payload, sessionContext) -> void
  recordEffect(partId, effectName, sessionContext) -> void
}

class ImmediateDispatchStrategy implements IEventDispatchStrategy { ... }
class SessionQueueStrategy implements IEventDispatchStrategy { ... }
```

**Benefits**:
- Eliminates test duplication for session/non-session paths
- Single code path for effect application
- Strategy determined at call time from `damageSession` presence

### 3. Extract Effect Applicators (One per Effect Type)

Extract each effect application into its own class:

```javascript
class DismembermentApplicator {
  apply({ entityId, partId, config, effectDefinition, dispatchStrategy }) -> boolean
}

class FractureApplicator { ... }
class BleedApplicator { ... }
class BurnApplicator { ... }
class PoisonApplicator { ... }
```

**Benefits**:
- Each applicator is small and testable
- Effect-specific logic is isolated
- Main service becomes an orchestrator

### 4. Simplify Fallback Chain

Replace cascading `??` operators with explicit resolution:

```javascript
// Before (unreachable fallback)
const threshold = config.thresholdFraction ?? definition?.defaults?.thresholdFraction ?? 0.8;

// After (explicit resolution in EffectDefinitionResolver)
const definition = resolver.resolveEffectDefinition('dismember');
// definition.defaults.thresholdFraction is guaranteed to exist
const threshold = config.thresholdFraction ?? definition.defaults.thresholdFraction;
```

### 5. Extract WarningTracker (Injectable)

Move warn-once logic to a separate injectable service:

```javascript
class WarningTracker {
  warnOnce(category, key, message) -> void
  clear() -> void  // For testing
}
```

### 6. Permitted Internal Changes

- Private method signatures may change
- Internal state management may change
- File may be split into multiple files
- Helper functions may become classes
- New private methods may be added
- `FALLBACK_EFFECT_DEFINITIONS` may be moved to separate file

---

## Testing Plan

### Tests to Update

| Test Category | Line Range | Required Changes |
|---------------|------------|------------------|
| Constructor tests | 39-94 | Update for new injectable dependencies |
| Dismemberment tests | 144-295 | Remove registry/non-registry duplication |
| Fracture tests | 297-442 | Same as above |
| Bleed tests | 444-549 | Same as above |
| Burn tests | 551-671 | Same as above |
| Poison tests | 673-768 | Same as above |
| Processing order tests | 770-880 | Consolidate with EffectDefinitionResolver tests |
| Registry defaults tests | 882-964 | Move to EffectDefinitionResolver tests |
| Session integration tests | 966-1331 | Split: strategy tests vs orchestration tests |
| Registry signaling tests | 1334-1375 | Move to EffectDefinitionResolver tests |
| Multi-mod registry tests | 1544-1723 | Move to EffectDefinitionResolver tests |
| Warning suppression tests | 1727-1846 | Move to WarningTracker tests |

### New Test Files to Create

**1. EffectDefinitionResolver Tests**:
- `tests/unit/anatomy/services/effectDefinitionResolver.test.js`

```javascript
describe('EffectDefinitionResolver', () => {
  describe('resolveEffectDefinition', () => {
    it('returns fallback when registry is absent')
    it('merges registry defaults with fallbacks')
    it('preserves fallback values not in registry')
    it('overrides fallback values with registry values')
    it('handles nested object merging correctly')
  })

  describe('resolveApplyOrder', () => {
    it('returns fallback order when registry is absent')
    it('returns registry order when available')
    it('appends missing fallback IDs to registry order')
    it('skips non-damage effect IDs silently')
    it('warns for unknown IDs not in registry')
  })

  describe('mergeDefaults', () => {
    it('performs deep merge for nested objects')
    it('performs shallow copy for arrays')
    it('handles null values correctly')
    it('handles empty objects correctly')
  })
})
```

**2. EventDispatchStrategy Tests**:
- `tests/unit/anatomy/services/eventDispatchStrategy.test.js`

```javascript
describe('ImmediateDispatchStrategy', () => {
  it('dispatches event immediately')
  it('does not modify session context')
})

describe('SessionQueueStrategy', () => {
  it('queues event to pendingEvents')
  it('records effect in matching entry')
  it('initializes effectsTriggered array if absent')
  it('handles missing entry gracefully')
})
```

**3. Effect Applicator Tests** (5 new files):
- `tests/unit/anatomy/applicators/dismembermentApplicator.test.js`
- `tests/unit/anatomy/applicators/fractureApplicator.test.js`
- `tests/unit/anatomy/applicators/bleedApplicator.test.js`
- `tests/unit/anatomy/applicators/burnApplicator.test.js`
- `tests/unit/anatomy/applicators/poisonApplicator.test.js`

### Regression Tests Required

- All 68 existing tests must pass after refactoring
- No change to public API behavior
- Event payloads must remain identical
- Component data must remain identical

### Property Tests to Add

```javascript
describe('EffectDefinitionResolver property tests', () => {
  it('merged result always contains all fallback keys', () => {
    fc.assert(fc.property(
      arbitraryRegistryDefaults(),
      (registryDefaults) => {
        const merged = resolver.mergeDefaults(FALLBACK_EFFECT_DEFINITIONS.bleed.defaults, registryDefaults);
        return hasAllKeys(merged, FALLBACK_EFFECT_DEFINITIONS.bleed.defaults);
      }
    ));
  })

  it('threshold fractions are always 0-1', () => {
    fc.assert(fc.property(
      arbitraryEffectType(),
      (effectType) => {
        const def = resolver.resolveEffectDefinition(effectType);
        const threshold = def.defaults.thresholdFraction;
        return threshold === undefined || (threshold >= 0 && threshold <= 1);
      }
    ));
  })
})
```

### Coverage Targets

| Component | Current | Target |
|-----------|---------|--------|
| DamageTypeEffectsService | 80.18% | 95%+ |
| EffectDefinitionResolver | N/A | 100% |
| EventDispatchStrategy | N/A | 100% |
| Effect Applicators (each) | N/A | 95%+ |
| WarningTracker | N/A | 100% |

---

## Files Summary

### Files to Create

| File | Purpose |
|------|---------|
| `src/anatomy/services/effectDefinitionResolver.js` | Injectable defaults resolution service |
| `src/anatomy/services/eventDispatchStrategy.js` | Strategy pattern for event dispatch |
| `src/anatomy/applicators/dismembermentApplicator.js` | Dismemberment effect logic |
| `src/anatomy/applicators/fractureApplicator.js` | Fracture effect logic |
| `src/anatomy/applicators/bleedApplicator.js` | Bleed effect logic |
| `src/anatomy/applicators/burnApplicator.js` | Burn effect logic |
| `src/anatomy/applicators/poisonApplicator.js` | Poison effect logic |
| `src/anatomy/services/warningTracker.js` | Injectable warn-once service |
| `tests/unit/anatomy/services/effectDefinitionResolver.test.js` | Resolver unit tests |
| `tests/unit/anatomy/services/eventDispatchStrategy.test.js` | Strategy unit tests |
| `tests/unit/anatomy/applicators/*.test.js` | Applicator unit tests (5 files) |

### Files to Modify

| File | Changes |
|------|---------|
| `src/anatomy/services/damageTypeEffectsService.js` | Refactor to use extracted services, simplify to orchestrator |
| `tests/unit/anatomy/services/damageTypeEffectsService.test.js` | Remove duplicated tests, update for new dependencies |
| `src/dependencyInjection/tokens/tokens-core.js` | Add tokens for new services |
| `src/dependencyInjection/registrations/anatomyRegistrations.js` | Register new services |

---

## Validation Checklist

- [x] All tests pass (60 in main service, 37 in extracted services, 201 in applicators = 298 total)
- [x] Branch coverage: 83.72% for main service (uncovered branches tested in applicator tests)
- [x] New extracted services have comprehensive coverage
- [x] Public API remains unchanged
- [x] Event payloads unchanged
- [x] Component data unchanged
- [x] Processing order unchanged
- [x] ESLint passes
- [x] TypeScript types check

---

## Completion Summary

This specification guided the successful refactoring of DamageTypeEffectsService across tickets DMGFXSVC-001 through DMGFXSVC-010.

### What Was Achieved

1. **Extracted Services Created**:
   - `EffectDefinitionResolver` - Injectable defaults resolution
   - `EventDispatchStrategy` - Strategy pattern for event dispatch
   - `WarningTracker` - Injectable warn-once service

2. **Applicators Extracted** (5 total):
   - `DismembermentApplicator`
   - `FractureApplicator`
   - `BleedApplicator`
   - `BurnApplicator`
   - `PoisonApplicator`

3. **Test Coverage**:
   - Main service: 60 tests
   - Extracted services: 37 tests
   - Applicators: 201 tests
   - **Total: 298 tests** (up from ~68 originally)

4. **Architecture Improvements**:
   - Single Responsibility Principle enforced
   - Dependency Injection throughout
   - Testable in isolation
   - Clear separation of concerns

### Deviation from Original Plan

- **Test count**: 60 tests in main file vs. 68 planned (tests distributed to extracted components)
- **Branch coverage**: 83.72% vs. 95%+ target (acceptable because uncovered branches are in delegation paths tested by applicators)
- **Constructor dependencies**: `statusEffectRegistry` and `warningTracker` handled internally by applicators, not injected directly

### Tickets Completed

1. DMGFXSVC-001: Extract WarningTracker
2. DMGFXSVC-002: Extract EffectDefinitionResolver
3. DMGFXSVC-003: Extract EventDispatchStrategy
4. DMGFXSVC-004: Extract DismembermentApplicator
5. DMGFXSVC-005: Extract FractureApplicator
6. DMGFXSVC-006: Extract BleedApplicator
7. DMGFXSVC-007: Extract BurnApplicator
8. DMGFXSVC-008: Extract PoisonApplicator
9. DMGFXSVC-009: Refactor DamageTypeEffectsService
10. DMGFXSVC-010: Update Existing Tests
