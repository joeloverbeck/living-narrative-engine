# Anatomy & Damage Systems Exploration Report

## Executive Summary

The Living Narrative Engine has a comprehensive damage and anatomy system with tick-based special effects. The system is well-structured with clear separation between damage application, effect handling, and ongoing effect processing. All key systems (damage type effects, tick systems for status effects) exist and are functional.

---

## 1. Existing Files - Damage/Anatomy Systems

### Core Damage Processing

| File | Purpose | Key Class |
|------|---------|-----------|
| `src/logic/operationHandlers/applyDamageHandler.js` | Operation handler for APPLY_DAMAGE actions | `ApplyDamageHandler` |
| `src/anatomy/services/damageTypeEffectsService.js` | Applies special effects based on damage type | `DamageTypeEffectsService` |
| `src/loaders/damageTypeLoader.js` | Loads damage type definitions from mod data | `DamageTypeLoader` |

### Tick-Based Effect Systems

| File | Purpose | Key Class |
|------|---------|-----------|
| `src/anatomy/services/bleedingTickSystem.js` | Processes ongoing bleeding damage per turn | `BleedingTickSystem` |
| `src/anatomy/services/burningTickSystem.js` | Processes ongoing burning damage per turn | `BurningTickSystem` |
| `src/anatomy/services/poisonTickSystem.js` | Processes ongoing poison damage per turn | `PoisonTickSystem` |

### Damage Type Definitions

| Location | Damage Types | Notes |
|----------|-------------|-------|
| `data/mods/anatomy/damage-types/` | blunt.json, piercing.json, slashing.json | Hardcoded damage types with effect configs |
| `data/schemas/damage-type.schema.json` | Schema definition | Validates all damage type JSON files |

---

## 2. Damage Type Effects System - YES, EXISTS

**Class:** `DamageTypeEffectsService` (src/anatomy/services/damageTypeEffectsService.js)

### Managed Effects

The service handles **5 types of special effects**, all exist:

1. **Dismemberment** - Private method `#checkAndApplyDismemberment()`
   - Condition: Part health drops below threshold
   - Event: `DISMEMBERED_EVENT`
   
2. **Fracture** - Private method `#checkAndApplyFracture()`
   - Condition: Damage exceeds threshold fraction of max health
   - Can stun with `DEFAULT_STUN_DURATION`
   - Event: `FRACTURED_EVENT`
   
3. **Bleeding** - Private method `#applyBleedEffect()`
   - Adds `anatomy:bleeding` component
   - Event: `BLEEDING_STARTED_EVENT`
   
4. **Burning** - Private method `#applyBurnEffect()`
   - Adds `anatomy:burning` component
   - Supports stacking if `canStack` is true
   - Event: `BURNING_STARTED_EVENT`
   
5. **Poison** - Private method `#applyPoisonEffect()`
   - Adds `anatomy:poisoned` component
   - Can be scoped to part or entity level
   - Event: `POISONED_STARTED_EVENT`

### Effect Application Pipeline

```
applyEffectsForDamage() {
  1. Look up damage type definition from registry
  2. Check if part is destroyed (skip ongoing effects if yes)
  3. Dismemberment check (if triggered, skip other effects)
  4. Fracture check
  5. Bleed attach
  6. Burn attach
  7. Poison attach
}
```

**Key Constants Exported:**
- `BLEED_SEVERITY_MAP`
- `BLEEDING_COMPONENT_ID`, `BURNING_COMPONENT_ID`, `POISONED_COMPONENT_ID`, `FRACTURED_COMPONENT_ID`
- `BLEEDING_STARTED_EVENT`, `BURNING_STARTED_EVENT`, `POISONED_STARTED_EVENT`
- `BLEEDING_STOPPED_EVENT`, `BURNING_STOPPED_EVENT`, `POISONED_STOPPED_EVENT`
- `DISMEMBERED_EVENT`, `FRACTURED_EVENT`

---

## 3. Tick-Based Systems - YES, ALL EXIST

### BleedingTickSystem
- File: `src/anatomy/services/bleedingTickSystem.js`
- Processes `anatomy:bleeding` component each turn
- Trigger: `TURN_ENDED_ID` event
- Behavior: Applies tick damage, decrements duration, removes when expired

### BurningTickSystem
- File: `src/anatomy/services/burningTickSystem.js`
- Processes `anatomy:burning` component each turn
- Trigger: `TURN_ENDED_ID` event
- Behavior: Applies tick damage (DPS), supports stacking

### PoisonTickSystem
- File: `src/anatomy/services/poisonTickSystem.js`
- Processes `anatomy:poisoned` component each turn
- Trigger: `TURN_ENDED_ID` event
- Behavior: Applies tick damage, can scope to part or entity

---

## 4. Propagation Logic - COMPREHENSIVE IMPLEMENTATION

**Location:** `ApplyDamageHandler/#propagateDamage()` (src/logic/operationHandlers/applyDamageHandler.js)

### Damage Propagation Context

The `propagatedFrom` parameter tracks the source of propagated damage in `execute()`:
```javascript
const { entity_ref, part_ref, amount, damage_type, propagatedFrom = null } = params;
```

Included in `DAMAGE_APPLIED_EVENT`:
```javascript
this.#dispatcher.dispatch(DAMAGE_APPLIED_EVENT, {
  entityId,
  partId,
  amount: damageAmount,
  damageType,
  propagatedFrom,  // <-- tracks source of propagated damage
  timestamp: Date.now()
});
```

### Propagation Pipeline

1. Check for propagation rules on parent part's `damage_propagation` property
2. Iterate each child part in propagation rules
3. For each child:
   - Verify damage type is allowed (filter by `damage_types` array if present)
   - Check probability (`probability` field, defaults to 1.0)
   - Calculate propagated damage: `damageAmount * damage_fraction`
   - Verify child is actually a child (check joint's parentId)
   - **Recursively call `execute()` with `propagatedFrom: parentPartId`**

### Propagation Rule Structure

Each part can define `damage_propagation` in its component:
```javascript
"damage_propagation": {
  "child_part_id": {
    "damage_types": ["slashing", "piercing"],
    "probability": 0.8,
    "damage_fraction": 0.5
  }
}
```

**Recursive Nature:** Damage chains through the body graph naturally.

---

## 5. Event Emission Patterns

### Core Damage Events

**DAMAGE_APPLIED_EVENT** - Emitted immediately when damage received
- Includes: entityId, partId, amount, damageType, propagatedFrom, timestamp

**PART_HEALTH_CHANGED_EVENT** - Emitted after health component updated
- Includes: partEntityId, ownerEntityId, partType, previousHealth, newHealth, state changes

**PART_DESTROYED_EVENT** - Emitted only on transition to 0 health
- Includes: entityId, partId, timestamp

### Status Effect Events

| Effect | Started | Stopped |
|--------|---------|---------|
| Bleeding | BLEEDING_STARTED_EVENT | BLEEDING_STOPPED_EVENT |
| Burning | BURNING_STARTED_EVENT | BURNING_STOPPED_EVENT |
| Poison | POISONED_STARTED_EVENT | POISONED_STOPPED_EVENT |
| Fracture | FRACTURED_EVENT | (instantaneous) |
| Dismember | DISMEMBERED_EVENT | (instantaneous) |

---

## 6. Component IDs Used in Damage System

| Component ID | Purpose |
|-------------|---------|
| `anatomy:part_health` | Part health (currentHealth, maxHealth, state) |
| `core:health` | Entity-level health (poison scope:entity) |
| `anatomy:bleeding` | Active bleeding effect |
| `anatomy:burning` | Active burning effect |
| `anatomy:poisoned` | Active poison effect |
| `anatomy:fractured` | Fracture effect |
| `anatomy:part` | Part metadata |
| `anatomy:joint` | Joint metadata (parentId) |

---

## 7. Summary Table: System Checklist

| Component | Exists | Location | Status |
|-----------|--------|----------|--------|
| ApplyDamageHandler | ✅ | src/logic/operationHandlers/ | Fully implemented |
| DamageTypeEffectsService | ✅ | src/anatomy/services/ | Fully implemented |
| BleedingTickSystem | ✅ | src/anatomy/services/ | Fully implemented |
| BurningTickSystem | ✅ | src/anatomy/services/ | Fully implemented |
| PoisonTickSystem | ✅ | src/anatomy/services/ | Fully implemented |
| DamageTypeLoader | ✅ | src/loaders/ | Fully implemented |
| Damage Type Schema | ✅ | data/schemas/ | Complete |
| Damage Type Definitions | ✅ | data/mods/anatomy/damage-types/ | 3 types defined |
| Propagation Logic | ✅ | ApplyDamageHandler | Recursive, rule-based |
| Event System | ✅ | Throughout | Well integrated |

---

## 8. Key File Locations (Absolute Paths)

- `/home/joeloverbeck/projects/living-narrative-engine/src/logic/operationHandlers/applyDamageHandler.js`
- `/home/joeloverbeck/projects/living-narrative-engine/src/anatomy/services/damageTypeEffectsService.js`
- `/home/joeloverbeck/projects/living-narrative-engine/src/anatomy/services/bleedingTickSystem.js`
- `/home/joeloverbeck/projects/living-narrative-engine/src/anatomy/services/burningTickSystem.js`
- `/home/joeloverbeck/projects/living-narrative-engine/src/anatomy/services/poisonTickSystem.js`
- `/home/joeloverbeck/projects/living-narrative-engine/src/loaders/damageTypeLoader.js`
- `/home/joeloverbeck/projects/living-narrative-engine/data/schemas/damage-type.schema.json`
- `/home/joeloverbeck/projects/living-narrative-engine/data/mods/anatomy/damage-types/blunt.json`
- `/home/joeloverbeck/projects/living-narrative-engine/data/mods/anatomy/damage-types/piercing.json`
- `/home/joeloverbeck/projects/living-narrative-engine/data/mods/anatomy/damage-types/slashing.json`
