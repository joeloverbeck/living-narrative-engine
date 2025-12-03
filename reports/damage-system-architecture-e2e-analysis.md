# Damage System Architecture & E2E Test Coverage Analysis

## Executive Summary

This report documents the complete damage system architecture in the Living Narrative Engine, identifies 5 distinct damage workflows, maps current test coverage, and proposes priority e2e tests to ensure system robustness.

**Key Findings:**
- 5 distinct damage workflows identified
- 3 e2e tests now exist (throw action + swing_at_target full flow + death mechanics)
- 24+ integration tests provide component-level coverage but no end-to-end validation
- Critical gaps remain in: damage effects, propagation
- Known bug: message ordering (damage appears before success message)

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DAMAGE SYSTEM ARCHITECTURE                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐     ┌──────────────────┐     ┌──────────────────────────┐
│   Action Layer   │────▶│   Event Layer    │────▶│   Rule Processing        │
│                  │     │                  │     │                          │
│ swing_at_target  │     │ attempt_action   │     │ handle_swing_at_target   │
│ .action.json     │     │ event            │     │ .rule.json               │
└──────────────────┘     └──────────────────┘     └──────────────────────────┘
                                                              │
                                                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OPERATION EXECUTION                                  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  RESOLVE_OUTCOME  ─▶  FOR_EACH damage_entry  ─▶  APPLY_DAMAGE       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                                              │
                                                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      APPLY_DAMAGE HANDLER EXECUTION                          │
│                                                                              │
│   1. Resolve entity_ref & part_ref (auto-select if missing)                 │
│   2. Resolve damage_entry (or legacy amount/damage_type)                    │
│   3. Apply damage_multiplier                                                │
│   4. Check exclude_damage_types list                                        │
│   5. Dispatch anatomy:damage_applied event                                  │
│   6. Update anatomy:part_health component                                   │
│   7. Dispatch anatomy:part_health_changed event                             │
│   8. [if destroyed] Dispatch anatomy:part_destroyed event                   │
│   9. Apply damage type effects (DamageTypeEffectsService)                   │
│  10. Propagate damage to children (DamagePropagationService)                │
│  11. Check death conditions (DeathCheckService) [top-level only]            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Service Dependency Map

```
                        ┌─────────────────────────┐
                        │   ApplyDamageHandler    │
                        │  (src/logic/operation   │
                        │   Handlers/)            │
                        └───────────┬─────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
            ▼                       ▼                       ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│ EntityManager     │   │ JsonLogicService  │   │SafeEventDispatcher│
│ (component CRUD)  │   │ (ref resolution)  │   │ (event dispatch)  │
└───────────────────┘   └───────────────────┘   └───────────────────┘
            │
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DOWNSTREAM SERVICES                                  │
│                                                                              │
│  ┌────────────────────────┐  ┌────────────────────────┐                     │
│  │  BodyGraphService      │  │  DamageTypeEffects     │                     │
│  │  (part hierarchy,      │  │  Service               │                     │
│  │   hit probability)     │  │  (bleed, burn, poison, │                     │
│  │                        │  │   fracture, dismember) │                     │
│  └────────────────────────┘  └────────────────────────┘                     │
│                                                                              │
│  ┌────────────────────────┐  ┌────────────────────────┐                     │
│  │  DamagePropagation     │  │  DeathCheckService     │                     │
│  │  Service               │  │  (vital organs,        │                     │
│  │  (internal damage,     │  │   dying state)         │                     │
│  │   recursive apply)     │  │                        │                     │
│  └────────────────────────┘  └────────────────────────┘                     │
│                                                                              │
│  ┌────────────────────────┐                                                  │
│  │  InjuryAggregation     │                                                  │
│  │  Service               │                                                  │
│  │  (health summary DTO)  │                                                  │
│  └────────────────────────┘                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Workflow 1: Direct Combat Damage (PRIMARY)

The main combat flow from action to damage resolution.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     WORKFLOW 1: DIRECT COMBAT DAMAGE                         │
└─────────────────────────────────────────────────────────────────────────────┘

Player selects "swing_at_target" action
            │
            ▼
┌──────────────────────────────────────┐
│  swing_at_target.action.json         │
│  ├─ Scope: wielded_cutting_weapons   │
│  ├─ Scope: actors_in_location        │
│  └─ Skill contest: melee vs defense  │
└──────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────┐
│  Event: core:attempt_action          │
│  ├─ actionId: weapons:swing_at_target│
│  ├─ actorId: (attacker)              │
│  ├─ primary: (weapon entity)         │
│  └─ secondary: (target entity)       │
└──────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────┐
│  Rule: handle_swing_at_target        │
│  ├─ RESOLVE_OUTCOME (skill contest)  │
│  ├─ IF CRITICAL_SUCCESS (≤5%)        │
│  │   └─ damage × 1.5                 │
│  ├─ IF SUCCESS                       │
│  │   └─ damage × 1.0                 │
│  ├─ IF FUMBLE (≥95%)                 │
│  │   └─ unwield + drop weapon        │
│  └─ IF FAILURE                       │
│      └─ no damage                    │
└──────────────────────────────────────┘
            │
            ▼ (on SUCCESS/CRITICAL_SUCCESS)
┌──────────────────────────────────────┐
│  FOR_EACH damage_entry in weapon     │
│  └─ APPLY_DAMAGE operation           │
│     ├─ entity_ref: "secondary"       │
│     ├─ damage_entry: (from context)  │
│     ├─ damage_multiplier: 1.0 or 1.5 │
│     └─ exclude_damage_types: piercing│
└──────────────────────────────────────┘
```

**Key Files:**
- `data/mods/weapons/actions/swing_at_target.action.json`
- `data/mods/weapons/rules/handle_swing_at_target.rule.json`
- `src/logic/operationHandlers/applyDamageHandler.js`

---

## Workflow 2: Damage Effect Application

Triggered after damage is applied, based on weapon damage configuration.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WORKFLOW 2: DAMAGE EFFECT APPLICATION                     │
└─────────────────────────────────────────────────────────────────────────────┘

APPLY_DAMAGE executes
            │
            ▼
┌──────────────────────────────────────┐
│  DamageTypeEffectsService            │
│  .applyEffectsForDamage()            │
│  ├─ entityId                         │
│  ├─ partId                           │
│  ├─ damageEntry (name, amount, etc.) │
│  ├─ maxHealth                        │
│  └─ currentHealth                    │
└──────────────────────────────────────┘
            │
    ┌───────┴───────┬───────────┬───────────┬───────────┐
    ▼               ▼           ▼           ▼           ▼
┌─────────┐   ┌─────────┐  ┌─────────┐ ┌─────────┐ ┌─────────┐
│DISMEMBER│   │FRACTURE │  │  BLEED  │ │  BURN   │ │ POISON  │
│         │   │         │  │         │ │         │ │         │
│threshold│   │threshold│  │severity │ │  dps    │ │ tick    │
│ ≥80%    │   │ ≥50%    │  │duration │ │duration │ │duration │
│maxHealth│   │maxHealth│  │         │ │canStack │ │ scope   │
└────┬────┘   └────┬────┘  └────┬────┘ └────┬────┘ └────┬────┘
     │             │            │           │           │
     ▼             ▼            ▼           ▼           ▼
 anatomy:      anatomy:     anatomy:    anatomy:    anatomy:
dismembered   fractured    bleeding_   burning_   poisoned_
  event        event       started     started     started
                           + anatomy:  + anatomy:  + anatomy:
                           bleeding    burning     poisoned
                           component   component   component
```

**Effect Configuration (from damage_capabilities):**

| Effect | Trigger Condition | Component Added | Event |
|--------|-------------------|-----------------|-------|
| Dismember | damage ≥ threshold × maxHealth | Part removed | anatomy:dismembered |
| Fracture | damage ≥ threshold × maxHealth | anatomy:fractured | anatomy:fractured |
| Bleed | Always (if enabled) | anatomy:bleeding | anatomy:bleeding_started |
| Burn | Always (if enabled) | anatomy:burning | anatomy:burning_started |
| Poison | Always (if enabled) | anatomy:poisoned | anatomy:poisoned_started |

**Key File:** `src/anatomy/services/damageTypeEffectsService.js`

---

## Workflow 3: Internal Damage Propagation

Handles damage spreading to child body parts (e.g., torso → heart).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   WORKFLOW 3: INTERNAL DAMAGE PROPAGATION                    │
└─────────────────────────────────────────────────────────────────────────────┘

APPLY_DAMAGE to parent part
            │
            ▼
┌──────────────────────────────────────┐
│  DamagePropagationService            │
│  .propagateDamage()                  │
│  ├─ parentPartId                     │
│  ├─ damageAmount                     │
│  ├─ damageTypeId                     │
│  ├─ ownerEntityId                    │
│  └─ propagationRules (from part)     │
└──────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────┐
│  For each propagation rule:          │
│  ├─ Check damage type filter         │
│  │   (whitelist semantics)           │
│  ├─ Roll probability × modifier      │
│  │   ├─ baseProbability: 0.8         │
│  │   └─ damageTypeModifiers:         │
│  │       { "piercing": 1.5 }         │
│  ├─ Calculate propagated amount      │
│  │   = damage × damageFraction       │
│  └─ Verify child via joint check     │
└──────────────────────────────────────┘
            │
            ▼ (for each child that passes)
┌──────────────────────────────────────┐
│  anatomy:internal_damage_propagated  │
│  event dispatched                    │
│                                      │
│  RECURSIVE: APPLY_DAMAGE to child    │
│  (with propagated=true flag)         │
└──────────────────────────────────────┘
```

**Propagation Rule Example:**
```
{
  childSocketId: "heart_socket",
  baseProbability: 0.8,
  damageFraction: 0.5,
  damageTypeModifiers: { "piercing": 1.5, "blunt": 0.5 }
}
```

**Key File:** `src/anatomy/services/damagePropagationService.js`

---

## Workflow 4: Death Resolution

Handles vital organ destruction and dying state management.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       WORKFLOW 4: DEATH RESOLUTION                           │
└─────────────────────────────────────────────────────────────────────────────┘

APPLY_DAMAGE completes (top-level only)
            │
            ▼
┌──────────────────────────────────────┐
│  DeathCheckService                   │
│  .checkDeathConditions()             │
│  ├─ entityId                         │
│  └─ damageCauserId                   │
└──────────────────────────────────────┘
            │
            ├─────────────────┐
            ▼                 ▼
┌──────────────────┐  ┌──────────────────┐
│ Already Dead?    │  │ Vital Organ      │
│ (anatomy:dead)   │  │ Destroyed?       │
│                  │  │ (brain/heart/    │
│ YES → return     │  │  spine health≤0) │
└──────────────────┘  └────────┬─────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
           ┌─────────────┐       ┌─────────────────┐
           │ YES →       │       │ NO →            │
           │ Immediate   │       │ Check overall   │
           │ Death       │       │ health < 10%    │
           │             │       │                 │
           │ Add:        │       └────────┬────────┘
           │anatomy:dead │                │
           │             │       ┌────────┴────────┐
           │ Event:      │       ▼                 ▼
           │anatomy:     │  ┌─────────┐     ┌─────────────┐
           │entity_died  │  │ YES →   │     │ NO →        │
           └─────────────┘  │ Enter   │     │ No change   │
                            │ Dying   │     └─────────────┘
                            │ State   │
                            │         │
                            │ Add:    │
                            │anatomy: │
                            │dying    │
                            │(3 turns)│
                            │         │
                            │ Event:  │
                            │anatomy: │
                            │entity_  │
                            │dying    │
                            └─────────┘
                                 │
                                 ▼ (each turn)
                        ┌─────────────────┐
                        │ Countdown -1    │
                        │ If 0 → Death    │
                        │ Unless stabilized│
                        └─────────────────┘
```

**Vital Organs:** brain, heart, spine
**Dying State:** 3 turns to be stabilized or die
**Overall Health Calculation:** Weighted average (torso weight 3, vitals 0.5, limbs 1); dropping below 10% usually requires multiple heavily damaged parts.

**Key File:** `src/anatomy/services/deathCheckService.js`

---

## Workflow 5: Critical/Fumble Outcomes

Handles attack outcome variations.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   WORKFLOW 5: CRITICAL/FUMBLE OUTCOMES                       │
└─────────────────────────────────────────────────────────────────────────────┘

RESOLVE_OUTCOME operation
(skill contest: actor melee vs target defense)
            │
            ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          OUTCOME DETERMINATION                            │
├──────────────────┬──────────────────┬───────────────┬────────────────────┤
│ CRITICAL_SUCCESS │     SUCCESS      │   FAILURE     │       FUMBLE       │
│   (roll ≤ 5%)    │  (roll < thresh) │(roll ≥ thresh)│    (roll ≥ 95%)    │
├──────────────────┼──────────────────┼───────────────┼────────────────────┤
│                  │                  │               │                    │
│ damage × 1.5     │ damage × 1.0     │ no damage     │ no damage          │
│ multiplier       │ (normal)         │               │                    │
│                  │                  │               │ UNWIELD operation  │
│ "devastating     │ "cutting their   │ "fails to     │ DROP_ITEM_AT_      │
│  blow"           │  flesh"          │  connect"     │ LOCATION           │
│                  │                  │               │                    │
│ FOR_EACH damage  │ FOR_EACH damage  │ End turn      │ "loses grip on     │
│ → APPLY_DAMAGE   │ → APPLY_DAMAGE   │ (failure msg) │  their weapon"     │
│                  │                  │               │                    │
│ End turn         │ End turn         │               │ End turn           │
│ (success msg)    │ (success msg)    │               │ (failure msg)      │
└──────────────────┴──────────────────┴───────────────┴────────────────────┘
```

**Key File:** `data/mods/weapons/rules/handle_swing_at_target.rule.json`

---

## Event Sequence Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EVENT SEQUENCE (SUCCESS)                            │
└─────────────────────────────────────────────────────────────────────────────┘

Time ─────────────────────────────────────────────────────────────────────────▶

1. core:attempt_action
   └─ Player initiates swing_at_target

2. anatomy:damage_applied (BEFORE health update)
   └─ Contains: entityName, partType, orientation, damageAmount, damageType

3. anatomy:part_health_changed
   └─ Contains: previousHealth, newHealth, healthPercentage, state transition

4. [CONDITIONAL] anatomy:part_destroyed
   └─ Only if health reached 0

5. [CONDITIONAL] anatomy:bleeding_started / anatomy:fractured / etc.
   └─ Based on weapon damage configuration

6. [CONDITIONAL] anatomy:internal_damage_propagated
   └─ For each child part receiving propagated damage

7. [CONDITIONAL] anatomy:entity_dying
   └─ If overall health < 10%

8. [CONDITIONAL] anatomy:entity_died
   └─ If vital organ destroyed OR dying countdown expired

9. core:action_completed
   └─ Action execution finished
```

---

## Weapon Entity Analysis

Four weapon entities analyzed with damage configurations:

| Weapon | Type | Damage | Penetration | Effects |
|--------|------|--------|-------------|---------|
| Vespera Rapier | Slashing | 3 | 0.3 | Bleed (moderate), Dismember (0.8 threshold) |
| Vespera Main Gauche | Piercing | 2 | 0.8 | Bleed (minor) |
| Threadscar Melissa Longsword | Slashing | 4 | 0.3 | Bleed (moderate), Dismember (0.7 threshold) |
| Rill Practice Stick | Blunt | 1 | — | Fracture (0.7 threshold, 0.1 stun) |

**Key Files:**
- `data/mods/fantasy/entities/definitions/vespera_rapier.entity.json`
- `data/mods/fantasy/entities/definitions/vespera_main_gauche.entity.json`
- `data/mods/fantasy/entities/definitions/threadscar_melissa_longsword.entity.json`
- `data/mods/fantasy/entities/definitions/rill_practice_stick.entity.json`

---

## Current Test Coverage

### E2E Tests (3 total)

| File | Coverage | Notes |
|------|----------|-------|
| `tests/e2e/actions/realRuleExecution.e2e.test.js` | Tests throw action | Does NOT test combat damage |
| `tests/e2e/actions/swingAtTargetFullFlow.e2e.test.js` | Full swing_at_target flow | Covers damage, bleed trigger, piercing exclusion, critical multiplier, fumble drop |
| `tests/e2e/actions/deathMechanics.e2e.test.js` | Death & dying resolution | Vital organ destruction → death, weighted overall-health <10% → dying, 3-turn countdown → bleeding_out death, `anatomy:entity_died` payload |

### Integration Tests (24+ in weapons/)

| Area | Test Count | Coverage Level |
|------|-----------|----------------|
| Weapon wielding | 11 | Comprehensive |
| Entity resolution | 2+ | Good |
| Damage application | 7+ | Good (component level) |
| Outcome branching | 2+ | Good (rule structure) |
| Message rendering | 1 | Partial (known bug) |

### Critical Coverage Gaps

| Area | Current | Risk |
|------|---------|------|
| Full swing_at_target → damage → effects e2e | ✅ Covered by swingAtTargetFullFlow.e2e.test.js | MEDIUM (variants like multi-target/propagation still untested) |
| Bleed effect triggering | ~5% | HIGH |
| Burn effect triggering | 0% | HIGH |
| Poison effect triggering | 0% | HIGH |
| Fracture effect triggering | 0% | HIGH |
| Dismemberment triggering | 0% | HIGH |
| Damage propagation to internal parts | ~5% | HIGH |
| Death via vital organ destruction | ✅ Covered by deathMechanics.e2e.test.js | LOW |
| Multi-turn combat with dying state | ✅ Countdown covered in deathMechanics.e2e.test.js | MEDIUM (stabilization/turn hooks untested) |
| Critical success 1.5x multiplier execution | ~5% | MEDIUM |
| Fumble weapon drop execution | ~5% | MEDIUM |

---

## Known Bugs

### Message Ordering Bug

**Location:** `tests/integration/mods/weapons/damageMessageOrdering.integration.test.js`

**Issue:** Damage messages appear BEFORE success messages due to `queueMicrotask` in `DamageEventMessageRenderer`.

**Expected Order:**
1. "{Actor} swings rapier at {Target}... ✓"
2. "Bertram's torso suffers a deep gash..."

**Actual Order:**
1. "Bertram's torso suffers a deep gash..."
2. "{Actor} swings rapier at {Target}... ✓"

**Root Cause:** `queueMicrotask()` defers damage message rendering, causing it to execute after the action success message.

---

## Proposed E2E Tests

### Test Suite 1: swingAtTargetFullFlow.e2e.test.js (CRITICAL)

**Purpose:** Validate complete combat flow from action to damage resolution

**Scenarios:**
1. Complete swing → damage → health update → message sequence
2. Slashing damage with rapier applies bleed
3. Piercing damage exclusion on swing (only slashing applies)
4. Critical success 1.5x multiplier actual execution
5. Fumble weapon drop mechanics

**Status:** Implemented at `tests/e2e/actions/swingAtTargetFullFlow.e2e.test.js` using real APPLY_DAMAGE + DamageTypeEffectsService for bleed. Notes:
- Fumble branch requires the actor to own the item in `items:inventory.items` **and** wield via `positioning:wielding.wielded_item_ids` (not `itemIds`) for UNWIELD + DROP to succeed.
- Outcomes are forced per scenario for determinism; damage/effects stay production-accurate.

### Test Suite 2: deathMechanics.e2e.test.js (CRITICAL)

**Purpose:** Validate death conditions and dying state

**Scenarios:**
1. Heart destruction → immediate death
2. Brain destruction → immediate death
3. Overall health < 10% → dying state (3 turns)
4. Dying countdown expiration → death
5. anatomy:entity_died event payload verification

**Status:** Implemented at `tests/e2e/actions/deathMechanics.e2e.test.js`. Notes:
- Dying state is triggered by **weighted overall health** < 10%; with torso weight 3 and vital organs weight 0.5, multiple parts must be heavily damaged before entering dying.
- Vital organ destruction emits `anatomy:entity_died` with `causeOfDeath: vital_organ_destroyed`, `vitalOrganDestroyed`, `killedBy`, `entityName`, `finalMessage`, and `timestamp`.
- Dying countdown starts at 3 turns and expires to `causeOfDeath: bleeding_out` when not stabilized.

### Test Suite 3: damageEffectsTriggers.e2e.test.js (HIGH)

**Purpose:** Validate damage effect triggering from weapon configs

**Scenarios:**
1. Bleed effect triggered by slashing (rapier/longsword)
2. Fracture effect triggered by blunt (practice stick)
3. Dismemberment triggered on high damage threshold
4. Effect component attachment verification
5. Effect event dispatching

### Test Suite 4: damagePropagationFlow.e2e.test.js (HIGH)

**Purpose:** Validate internal damage propagation

**Scenarios:**
1. Torso damage propagates to heart (piercing high penetration)
2. Head damage propagates to brain
3. Propagation probability verification
4. Recursive damage application

### Test Suite 5: multiTurnCombatScenario.e2e.test.js (HIGH)

**Purpose:** Validate sustained combat scenarios

**Scenarios:**
1. Multiple attacks accumulating damage
2. Bleeding tick damage over turns
3. Dying countdown progression
4. Message ordering validation (regression test for known bug)

---

## File Reference

### Core Files

| File | Purpose |
|------|---------|
| `src/logic/operationHandlers/applyDamageHandler.js` | APPLY_DAMAGE operation |
| `src/anatomy/services/damageTypeEffectsService.js` | Effect application |
| `src/anatomy/services/damagePropagationService.js` | Internal damage |
| `src/anatomy/services/deathCheckService.js` | Death conditions |
| `src/anatomy/bodyGraphService.js` | Body part hierarchy |

### Schema Files

| File | Purpose |
|------|---------|
| `data/schemas/operations/applyDamage.schema.json` | Operation schema |
| `data/schemas/damage-capability-entry.schema.json` | Damage config schema |
| `data/schemas/damage-type.schema.json` | Damage type schema |

### Mod Files

| File | Purpose |
|------|---------|
| `data/mods/weapons/actions/swing_at_target.action.json` | Combat action |
| `data/mods/weapons/rules/handle_swing_at_target.rule.json` | Rule handler |
| `data/mods/damage-types/components/damage_capabilities.component.json` | Damage config |

---

## Recommendations

1. **Immediate Priority:** Implement damageEffectsTriggers.e2e.test.js to validate effect system
2. **High Priority:** Implement damagePropagationFlow.e2e.test.js and multiTurnCombatScenario.e2e.test.js
3. **Bug Fix:** Address message ordering issue in DamageEventMessageRenderer

---

*Report generated: 2025-12-03*
*Analysis scope: Damage system architecture from swing_at_target action to death resolution*
