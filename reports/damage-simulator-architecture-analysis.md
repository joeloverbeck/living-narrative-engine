# Damage Simulator Architecture Analysis Report

**Date**: January 4, 2026
**Status**: Investigation Complete - Recommendations Only

---

## Executive Summary

This report analyzes the damage simulator system architecture to identify:
1. **UI-to-Handler Parity Gap** - Parameters supported by `applyDamageHandler.js` but not exposed in the UI
2. **Fail-Fast Validation** - Mechanisms to detect capability drift between UI and schema
3. **Hardcoded Constants** - Gameplay logic that could be made data-driven

### Key Findings

| Priority | Issue | Impact |
|----------|-------|--------|
| **CRITICAL** | UI missing 5 handler parameters | Cannot test full damage capabilities |
| **HIGH** | No drift detection mechanism | Schema changes silently break UI parity |
| **HIGH** | Penetration parameter unused | Defined in schema/UI but has no mechanical effect |
| **MEDIUM** | 30+ hardcoded gameplay constants | Difficult to balance/mod without code changes |

### Recommendation Summary

1. **Add missing UI parameters**: `metadata`, `damage_tags`, `exclude_damage_types`, `hit_strategy`, `rng_ref`
2. **Implement schema-driven validation**: Runtime check that UI covers all schema-defined parameters
3. **Decide on penetration**: Either implement it in damage mechanics or remove from schema/UI
4. **Extract gameplay constants**: Move hardcoded values to config files or mod definitions

---

## 1. Architecture Overview

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ DAMAGE SIMULATOR UI (damage-simulator.html)                  │
│  ├─ #entity-select → Entity selection dropdown               │
│  ├─ #damage-type → Damage type select                        │
│  ├─ #damage-amount → Base damage slider (0-100)              │
│  ├─ Effect checkboxes → Bleed/Fracture/Burn/Poison/Dismember │
│  ├─ #target-mode → Random vs Specific targeting              │
│  ├─ #target-part → Specific part dropdown                    │
│  └─ #apply-damage-btn → Triggers damage application          │
└──────────────────────┬──────────────────────────────────────┘
                       │ click
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ DamageSimulatorUI.#handleApplyDamage()                       │
│  File: src/domUI/damage-simulator/DamageSimulatorUI.js:407   │
│  ├─ Gets DamageCapabilityComposer component                  │
│  ├─ Calls getDamageEntry() → damage entry object             │
│  ├─ Calls getDamageMultiplier() → number                     │
│  ├─ Gets target mode from radio buttons                      │
│  └─ Calls DamageExecutionService.applyDamage()               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ DamageExecutionService.applyDamage()                         │
│  File: src/domUI/damage-simulator/DamageExecutionService.js  │
│  ├─ Builds APPLY_DAMAGE operation object                     │
│  ├─ Parameters sent:                                         │
│  │   - entity_ref: string                                    │
│  │   - damage_entry: object                                  │
│  │   - damage_multiplier: number                             │
│  │   - part_ref: string|null                                 │
│  │   ❌ MISSING: metadata, damage_tags, hit_strategy,        │
│  │              exclude_damage_types, rng_ref                │
│  └─ Calls operationInterpreter.execute()                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ ApplyDamageHandler.execute()                                 │
│  File: src/logic/operationHandlers/applyDamageHandler.js     │
│  ├─ FULL parameter support:                                  │
│  │   ✅ entity_ref, part_ref, damage_entry                   │
│  │   ✅ damage_multiplier                                    │
│  │   ✅ metadata (sourceWeaponId, sourceActionId)            │
│  │   ✅ damage_tags (fire, ranged, magical, etc.)            │
│  │   ✅ exclude_damage_types (array)                         │
│  │   ✅ hit_strategy (reuse_cached, hint_part)               │
│  │   ✅ rng_ref (named RNG reference)                        │
│  └─ Delegates to DamageResolutionService.resolve()           │
└─────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
CommonBootstrapper.bootstrap()
  ↓
registerVisualizerComponents()     [Shared services]
  ↓
registerDamageSimulatorComponents() [Damage-specific]
  ↓
Initialize Child Components:
  1. DamageSimulatorUI           (main orchestrator)
  2. HierarchicalAnatomyRenderer (anatomy display)
  3. DamageCapabilityComposer    (form/damage configuration)
  4. DamageExecutionService      (execution bridge)
  5. DamageHistoryTracker        (history log)
  6. DamageAnalyticsPanel        (analytics)
```

### Key Files

| File | Purpose |
|------|---------|
| `damage-simulator.html` | UI structure and DOM elements |
| `src/damage-simulator.js` | Entry point, initialization |
| `src/domUI/damage-simulator/DamageCapabilityComposer.js` | Form composer with damage entry builder |
| `src/domUI/damage-simulator/DamageExecutionService.js` | Bridge between UI and operation system |
| `src/domUI/damage-simulator/DamageSimulatorUI.js` | Main UI orchestrator |
| `src/logic/operationHandlers/applyDamageHandler.js` | Core damage handler (426+ lines) |
| `data/schemas/operations/applyDamage.schema.json` | APPLY_DAMAGE operation schema |
| `data/schemas/damage-capability-entry.schema.json` | Damage entry structure schema |

---

## 2. UI-to-Handler Parity Analysis

### Parameters Currently Exposed in UI

| Parameter | UI Component | File Location | Status |
|-----------|--------------|---------------|--------|
| `entity_ref` | Entity dropdown (#entity-select) | DamageSimulatorUI.js | ✅ Working |
| `damage_entry.name` | Damage type select | DamageCapabilityComposer.js | ✅ Working |
| `damage_entry.amount` | Range slider (0-100) | DamageCapabilityComposer.js | ✅ Working |
| `damage_entry.penetration` | Range slider (0-1) | DamageCapabilityComposer.js:1063 | ⚠️ Exposed but UNUSED |
| `damage_entry.bleed` | Expandable section | DamageCapabilityComposer.js | ✅ Working |
| `damage_entry.fracture` | Expandable section | DamageCapabilityComposer.js | ✅ Working |
| `damage_entry.burn` | Expandable section | DamageCapabilityComposer.js | ✅ Working |
| `damage_entry.poison` | Expandable section | DamageCapabilityComposer.js | ✅ Working |
| `damage_entry.dismember` | Expandable section | DamageCapabilityComposer.js | ✅ Working |
| `damage_entry.flags` | Custom flags input | DamageCapabilityComposer.js | ✅ Working |
| `damage_multiplier` | Multiplier input | DamageCapabilityComposer.js | ✅ Working |
| `part_ref` | Target part dropdown | DamageSimulatorUI.js | ✅ Working |

### Parameters MISSING from UI (Handler Supports)

| Parameter | Schema Location | Handler Support | Use Case |
|-----------|-----------------|-----------------|----------|
| `metadata` | applyDamage.schema.json | Lines 468-480 | Track damage source (weapon ID, action ID, actor ID) |
| `damage_tags` | applyDamage.schema.json | Lines 481-495 | Enable conditional effects (fire, ranged, magical, holy, silver) |
| `exclude_damage_types` | applyDamage.schema.json | Lines 437-443 | Skip certain damage types in multi-hit scenarios |
| `hit_strategy` | applyDamage.schema.json | Lines 500-510 | Control hit location caching (`reuse_cached`, `hint_part`) |
| `rng_ref` | applyDamage.schema.json | Lines 515-520 | Named RNG reference for deterministic testing |

### Parameter Schema Definitions

From `data/schemas/operations/applyDamage.schema.json`:

```json
{
  "metadata": {
    "type": "object",
    "properties": {
      "sourceWeaponId": { "type": "string" },
      "sourceActionId": { "type": "string" },
      "sourceActorId": { "type": "string" }
    },
    "description": "Optional metadata about damage source for tracking"
  },
  "damage_tags": {
    "oneOf": [
      { "type": "array", "items": { "type": "string" } },
      { "$ref": "#/$defs/jsonLogic" }
    ],
    "description": "Tags for damage categorization (fire, ranged, magical)"
  },
  "exclude_damage_types": {
    "oneOf": [
      { "type": "array", "items": { "type": "string" } },
      { "$ref": "#/$defs/jsonLogic" }
    ],
    "description": "Damage types to skip in this operation"
  },
  "hit_strategy": {
    "type": "object",
    "properties": {
      "reuse_cached": { "type": "boolean" },
      "hint_part": { "type": "string" }
    },
    "description": "Strategy for hit location selection"
  },
  "rng_ref": {
    "type": "string",
    "description": "Named RNG reference for deterministic testing"
  }
}
```

### Impact of Missing Parameters

1. **`metadata`**: Cannot test damage tracking, tooltips showing "Damaged by [weapon]", or damage source attribution
2. **`damage_tags`**: Cannot test conditional effects that trigger on specific damage tags (e.g., fire resistance, holy vulnerability)
3. **`exclude_damage_types`**: Cannot test scenarios where certain damage types should be skipped
4. **`hit_strategy`**: Cannot test multi-hit scenarios with consistent hit locations or hinted targeting
5. **`rng_ref`**: Cannot perform deterministic damage testing with seeded RNG

---

## 3. Penetration Parameter Analysis

### Current State

The penetration parameter is:
- ✅ **Defined in schema**: `data/schemas/damage-capability-entry.schema.json`
- ✅ **Exposed in UI**: `DamageCapabilityComposer.js` (lines 1063-1065)
- ✅ **Stored in weapons**: longsword (0.3), rapier (0.6), practice stick (0)
- ❌ **NOT USED in mechanics**: Passed through but ignored

### Code Evidence

**DamageTypeEffectsService.js** (lines 140-145):
```javascript
/**
 * @param {object} params.damageEntry - Complete damage entry object from weapon
 * @param {number} [params.damageEntry.penetration] - Penetration value (0-1) // DEFINED
 * ...
 */
// But the method body never reads or uses params.damageEntry.penetration
```

**DamagePropagationService.js** (lines 323-337):
```javascript
// Uses damageTypeModifiers instead of penetration
let typeModifier = 1.0;
if (rule.damageTypeModifiers &&
    typeof rule.damageTypeModifiers === 'object' &&
    typeof rule.damageTypeModifiers[damageTypeId] === 'number') {
  typeModifier = rule.damageTypeModifiers[damageTypeId];
}
// No reference to penetration anywhere
```

### Weapon Definitions with Unused Penetration

| Weapon | File | Penetration | Effect |
|--------|------|-------------|--------|
| Vespera's Rapier (piercing) | fantasy/entities/definitions/vespera_rapier.entity.json | 0.6 | None |
| Vespera's Rapier (slashing) | fantasy/entities/definitions/vespera_rapier.entity.json | 0.1 | None |
| Melissa's Longsword | fantasy/entities/definitions/threadscar_melissa_longsword.entity.json | 0.3 | None |
| Rill's Practice Stick | fantasy/entities/definitions/rill_practice_stick.entity.json | (default 0) | None |

### Recommendations

**Option A: Implement Penetration Mechanics**
- Use penetration as a modifier for `damagePropagationService.js`
- Higher penetration = higher probability of damage reaching internal organs
- Formula: `propagationProbability = baseProbability * (1 + penetration * penetrationMultiplier)`

**Option B: Remove Penetration**
- Remove from schema `damage-capability-entry.schema.json`
- Remove from UI `DamageCapabilityComposer.js`
- Remove from weapon definitions
- Reduces confusion and maintenance burden

**Recommended**: Option A (implement) - The design intent appears to be that penetration affects internal damage, which is a valuable gameplay mechanic.

---

## 4. Fail-Fast Validation Recommendations

### Problem Statement

Currently, if the `applyDamage.schema.json` is extended with new parameters:
1. The handler will support them
2. The UI will NOT expose them
3. No warning or error is produced
4. UI/handler drift occurs silently

### Proposed Solution: Schema-Driven Validation

#### Approach 1: Runtime Schema Comparison

```javascript
// In DamageExecutionService.applyDamage()
const REQUIRED_UI_PARAMETERS = [
  'entity_ref', 'damage_entry', 'damage_multiplier', 'part_ref',
  'metadata', 'damage_tags', 'exclude_damage_types', 'hit_strategy', 'rng_ref'
];

validateUISchemaSync() {
  const schema = this.#schemaLoader.getSchema('applyDamage.schema.json');
  const schemaParams = Object.keys(schema.properties.parameters.properties);
  const unsupported = schemaParams.filter(p => !REQUIRED_UI_PARAMETERS.includes(p));

  if (unsupported.length > 0) {
    console.warn(`[DamageSimulator] UI missing schema parameters: ${unsupported.join(', ')}`);
    // Optional: throw error in strict mode
  }
}
```

#### Approach 2: Test-Based Validation

```javascript
// tests/integration/domUI/damage-simulator/uiSchemaParity.test.js
describe('Damage Simulator UI/Schema Parity', () => {
  it('should expose all APPLY_DAMAGE schema parameters', async () => {
    const schema = await loadSchema('operations/applyDamage.schema.json');
    const schemaParams = Object.keys(schema.properties.parameters.properties);

    const uiParams = ['entity_ref', 'damage_entry', 'damage_multiplier', 'part_ref'];
    // Add new params as they're implemented in UI

    const missing = schemaParams.filter(p => !uiParams.includes(p) && !OPTIONAL_PARAMS.includes(p));
    expect(missing).toEqual([]);
  });
});
```

#### Approach 3: Schema-Driven Form Generation (Long-term)

Generate UI form fields directly from schema:
- Read `applyDamage.schema.json` at initialization
- Generate form controls for each parameter based on type
- Automatic parity by construction

### Recommended Implementation

1. **Immediate**: Add test (Approach 2) that fails on schema/UI drift
2. **Short-term**: Add runtime warning (Approach 1) in development mode
3. **Long-term**: Consider schema-driven form generation (Approach 3)

---

## 5. Hardcoded Constants Catalog

### Category 1: Combat Probability System

**File**: `src/combat/services/ProbabilityCalculatorService.js`

| Constant | Line | Value | Purpose |
|----------|------|-------|---------|
| `DEFAULT_BOUNDS.min` | 45-46 | `5` | Minimum success probability (5%) |
| `DEFAULT_BOUNDS.max` | 45-47 | `95` | Maximum success probability (95%) |
| Logistic coefficient | 240 | `-0.1` | Bell-curve steepness in formula |
| Linear base | 253 | `50` | Base percentage for linear formula |
| Equal skills fallback | 221 | `50` | 50% when both skills = 0 |

**File**: `src/combat/services/OutcomeDeterminerService.js`

| Constant | Line | Value | Purpose |
|----------|------|-------|---------|
| `DEFAULT_THRESHOLDS.criticalSuccess` | 32-33 | `5` | Roll ≤5 = critical success |
| `DEFAULT_THRESHOLDS.criticalFailure` | 32-34 | `95` | Roll ≥95 = fumble |
| D100 range | 197-198 | `1-100` | Dice roll range |

### Category 2: Death System

**File**: `src/anatomy/services/deathCheckService.js`

| Constant | Line | Value | Purpose |
|----------|------|-------|---------|
| `CRITICAL_HEALTH_THRESHOLD` | 18 | `10` | Below 10% = dying state |
| `DEFAULT_DYING_TURNS` | 19 | `3` | Turns until death while dying |
| `DEFAULT_KILL_ON_DESTROY` | 20 | `true` | Vital organ destruction = instant death |

### Category 3: Hypoxia System

**File**: `src/breathing/services/hypoxiaTickSystem.js`

| Constant | Line | Value | Purpose |
|----------|------|-------|---------|
| `MODERATE_THRESHOLD` | 38 | `3` | Turn 3+ = moderate hypoxia |
| `SEVERE_THRESHOLD` | 39 | `5` | Turn 5+ = severe hypoxia |
| `UNCONSCIOUS_THRESHOLD` | 40 | `7` | Turn 7+ = unconsciousness |
| `BRAIN_DAMAGE_THRESHOLD` | 41 | `2` | 2+ turns unconscious = brain damage |
| `ANOXIC_DAMAGE_AMOUNT` | 44 | `5` | Damage per turn while unconscious |

### Category 4: Damage Propagation

**File**: `src/anatomy/services/damagePropagationService.js`

| Constant | Line | Value | Purpose |
|----------|------|-------|---------|
| Default `baseProbability` | 320 | `1.0` | 100% propagation if not configured |
| Default `damageFraction` | 364 | `0.5` | Child receives 50% of parent damage |
| Default `typeModifier` | 324 | `1.0` | No modification for unlisted types |

### Category 5: Damage Severity

**File**: `src/anatomy/constants/damageSeverity.js`

| Constant | Line | Value | Purpose |
|----------|------|-------|---------|
| `NEGLIGIBLE_DAMAGE_PERCENT_THRESHOLD` | 1 | `0.02` | 2% of max health |
| `NEGLIGIBLE_DAMAGE_ABSOLUTE_THRESHOLD` | 2 | `2` | Minimum 2 HP for non-negligible |

### Category 6: Modifier Stacking

**File**: `src/combat/services/ModifierCollectorService.js`

| Constant | Line | Value | Purpose |
|----------|------|-------|---------|
| Base percentage multiplier | 326 | `1.0` | Identity for multiplication |
| Stacking rule | 305 | Highest absolute | Same stackId: only highest kept |

### Category 7: Effect Defaults (Schema-Defined)

**File**: `data/schemas/damage-capability-entry.schema.json`

| Effect | Field | Default | Purpose |
|--------|-------|---------|---------|
| Penetration | `penetration` | `0` | No internal penetration |
| Bleed | `baseDurationTurns` | `2` | Bleeding duration |
| Fracture | `thresholdFraction` | `0.5` | 50% health required |
| Fracture | `stunChance` | `0.2` | 20% stun chance |
| Burn | `dps` | `1` | Damage per turn |
| Burn | `durationTurns` | `2` | Burn duration |
| Poison | `tickDamage` | `1` | Poison damage per turn |
| Poison | `durationTurns` | `3` | Poison duration |
| Dismember | `thresholdFraction` | `0.8` | 80% damage required |

### Category 8: Activity Grouping

**File**: `src/anatomy/services/grouping/activityGroupingSystem.js`

| Constant | Line | Value | Purpose |
|----------|------|-------|---------|
| `simultaneousPriorityThreshold` | 44 | `10` | Priority diff ≤10 = "while", >10 = "and" |

---

## 6. Data-Driven Recommendations

### High Priority (Should Move)

| Constants | Current Location | Recommended Location | Rationale |
|-----------|------------------|---------------------|-----------|
| Critical thresholds (5, 95) | OutcomeDeterminerService.js | `config/combat.json` | Game balance |
| Probability bounds (5, 95) | ProbabilityCalculatorService.js | `config/combat.json` | Game balance |
| Death thresholds (10%, 3 turns) | deathCheckService.js | `data/mods/anatomy/config/death.json` | Game balance |
| Hypoxia timeline (3,5,7,+2,5) | hypoxiaTickSystem.js | `data/mods/breathing/config/hypoxia.json` | Game balance |

### Medium Priority (Consider Moving)

| Constants | Current Location | Recommended Location | Rationale |
|-----------|------------------|---------------------|-----------|
| Logistic coefficient (-0.1) | ProbabilityCalculatorService.js | `config/formulas.json` | Tuning |
| Propagation defaults (1.0, 0.5) | damagePropagationService.js | Schema defaults | Already in schema |
| Modifier stacking rules | ModifierCollectorService.js | `config/modifiers.json` | Advanced modding |

### Low Priority (Leave in Code)

| Constants | Current Location | Rationale |
|-----------|------------------|-----------|
| D100 range (1-100) | OutcomeDeterminerService.js | Core mechanic, unlikely to change |
| Schema effect defaults | damage-capability-entry.schema.json | Already data-driven |
| Activity grouping threshold | activityGroupingSystem.js | Narrative formatting, not gameplay |

### Proposed Config File Structure

```
config/
  combat.json           # Combat probability and critical thresholds
  formulas.json         # Mathematical formula coefficients

data/mods/anatomy/
  config/
    death.json          # Death and dying thresholds

data/mods/breathing/
  config/
    hypoxia.json        # Hypoxia escalation timeline
```

### Example: `config/combat.json`

```json
{
  "probability": {
    "minimumChance": 5,
    "maximumChance": 95,
    "equalSkillsDefault": 50,
    "logisticCoefficient": -0.1
  },
  "criticals": {
    "criticalSuccessThreshold": 5,
    "criticalFailureThreshold": 95
  }
}
```

### Example: `data/mods/anatomy/config/death.json`

```json
{
  "dying": {
    "criticalHealthThreshold": 10,
    "turnsUntilDeath": 3
  },
  "vitalOrgans": {
    "killOnDestroy": true
  }
}
```

---

## 7. Priority Matrix

| Priority | Issue | Impact | Effort | Recommendation |
|----------|-------|--------|--------|----------------|
| **CRITICAL** | UI missing 5 parameters | Cannot test full damage capabilities | Medium | Add UI controls for metadata, damage_tags, hit_strategy, exclude_damage_types, rng_ref |
| **HIGH** | No drift detection | Schema changes silently break parity | Low | Add parity test + runtime warning |
| **HIGH** | Penetration unused | Confusing UI/schema, dead code | Medium | Implement in damagePropagationService OR remove entirely |
| **MEDIUM** | Death system hardcoded | Cannot mod death mechanics | Low | Move to config file |
| **MEDIUM** | Hypoxia hardcoded | Cannot mod suffocation mechanics | Low | Move to mod config |
| **MEDIUM** | Combat thresholds hardcoded | Cannot balance combat | Low | Move to config file |
| **LOW** | Logistic coefficient hardcoded | Advanced tuning only | Very Low | Move to formula config |
| **LOW** | Effect defaults | Already in schema | None | Document only |

---

## 8. Files Referenced

### UI Layer
- `damage-simulator.html` - DOM structure
- `src/damage-simulator.js` - Entry point
- `src/domUI/damage-simulator/DamageSimulatorUI.js` - Main orchestrator
- `src/domUI/damage-simulator/DamageCapabilityComposer.js` - Form builder
- `src/domUI/damage-simulator/DamageExecutionService.js` - Execution bridge

### Operation Layer
- `src/logic/operationHandlers/applyDamageHandler.js` - Core handler
- `data/schemas/operations/applyDamage.schema.json` - Operation schema
- `data/schemas/damage-capability-entry.schema.json` - Entry schema

### Damage Mechanics
- `src/anatomy/services/damagePropagationService.js` - Propagation logic
- `src/anatomy/services/damageTypeEffectsService.js` - Effect application
- `src/anatomy/services/deathCheckService.js` - Death thresholds
- `src/anatomy/constants/damageSeverity.js` - Severity classification

### Combat System
- `src/combat/services/OutcomeDeterminerService.js` - Critical hits
- `src/combat/services/ProbabilityCalculatorService.js` - Probability bounds
- `src/combat/services/ModifierCollectorService.js` - Modifier stacking

### Other Systems
- `src/breathing/services/hypoxiaTickSystem.js` - Hypoxia escalation
- `src/anatomy/services/grouping/activityGroupingSystem.js` - Narrative grouping

### Weapon Definitions
- `data/mods/fantasy/entities/definitions/vespera_rapier.entity.json`
- `data/mods/fantasy/entities/definitions/threadscar_melissa_longsword.entity.json`
- `data/mods/fantasy/entities/definitions/rill_practice_stick.entity.json`

---

## Appendix A: Complete Parameter Comparison

### APPLY_DAMAGE Schema vs UI Coverage

| Schema Parameter | Type | UI Exposed | Notes |
|------------------|------|------------|-------|
| `entity_ref` | string/jsonLogic | ✅ Yes | Entity dropdown |
| `part_ref` | string/jsonLogic | ✅ Yes | Target part dropdown |
| `damage_entry` | object | ✅ Yes | Full form |
| `damage_entry.name` | string | ✅ Yes | Damage type select |
| `damage_entry.amount` | number | ✅ Yes | Range slider |
| `damage_entry.penetration` | number | ✅ Yes | Range slider (UNUSED) |
| `damage_entry.bleed` | object | ✅ Yes | Expandable section |
| `damage_entry.fracture` | object | ✅ Yes | Expandable section |
| `damage_entry.burn` | object | ✅ Yes | Expandable section |
| `damage_entry.poison` | object | ✅ Yes | Expandable section |
| `damage_entry.dismember` | object | ✅ Yes | Expandable section |
| `damage_entry.flags` | array | ✅ Yes | Custom flags input |
| `damage_multiplier` | number | ✅ Yes | Multiplier input |
| `metadata` | object | ❌ No | **MISSING** |
| `damage_tags` | array | ❌ No | **MISSING** |
| `exclude_damage_types` | array | ❌ No | **MISSING** |
| `hit_strategy` | object | ❌ No | **MISSING** |
| `rng_ref` | string | ❌ No | **MISSING** |
| `amount` | number | N/A | Deprecated |
| `damage_type` | string | N/A | Deprecated |
| `propagatedFrom` | internal | N/A | Internal use only |

---

*Report generated by architecture analysis workflow*
