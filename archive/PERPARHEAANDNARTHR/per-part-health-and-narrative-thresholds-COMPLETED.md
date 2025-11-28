# Per-Part Health and Narrative Thresholds - Iteration 1

## Overview

This specification defines the **first iteration** of a per-part health system for the Living Narrative Engine. The scope is intentionally constrained to establish foundational data structures, state management, and basic health modification capabilities.

### Document Type

This is a **requirements specification** focusing on what should be built and why. Detailed JSON schemas and code implementation will be developed during the implementation phase following established project patterns.

---

## Scope

### In Scope (This Iteration)

1. **Per-Part Health Component** - Track `currentHealth` and `maxHealth` on body part entities
2. **Narrative Thresholds** - Map health percentages to narrative state labels (Healthy, Bruised, Wounded, Badly Damaged, Destroyed)
3. **Health Modification Operation** - Change health values on parts (damage or healing)
4. **State Update Operation** - Recalculate narrative state from health percentage
5. **Events** - Notify other systems of health changes and state transitions

### Out of Scope (Future Iterations)

- Damage types (cutting, blunt, piercing, fire, etc.)
- Damage application with hit distribution and targeting
- Bleeding and status effects
- Healing mechanics beyond basic health modification
- Death logic (brain destruction, heart failure, overall health threshold)
- Armor and protection calculations
- Irrecoverable injuries and permanent damage
- Automatic limb detachment when destroyed
- Pain and shock mechanics
- Damage propagation to connected parts

---

## Design Decisions

### 1. Component Design: Separate Health from State

The `anatomy:part_health` component tracks both numeric health values AND narrative state. This follows the established `metabolism:hunger_state` pattern which combines `energyPercentage` with `state`.

**Rationale**: Keeps related data together, simplifies queries, matches existing patterns.

### 2. Extension Strategy: Composition Over Modification

Future features (bleeding, damage types, armor) will add **new components** rather than modifying the health component.

**Rationale**: Prevents schema bloat, enables clean feature isolation, avoids migration scripts.

**Example**: Future bleeding will use `anatomy:bleeding` component, not a `bleeding` field in `part_health`.

### 3. Event Separation: Health Changed vs State Changed

Two separate events:
- `anatomy:part_health_changed` - Fires on ANY health value change
- `anatomy:part_state_changed` - Fires ONLY when crossing threshold boundaries

**Rationale**: Different systems need different granularity. UI may need every health tick; narrative rules only care about state transitions.

### 4. Threshold Configuration: External Lookup File

Health state thresholds are defined in a lookup file, not hardcoded in the handler.

**Rationale**: Enables modders to adjust thresholds, supports future per-part-type thresholds.

### 5. Destroyed State: Label Only

When a part reaches 0% health (destroyed state), the system does NOT automatically trigger limb detachment. This is purely a narrative label.

**Rationale**: Death logic and limb detachment require additional considerations (vital organs, cascading effects) that belong in future iterations.

### 6. Event Payloads: Extensible with additionalProperties

Event schemas use `additionalProperties: true` to allow future iterations to add fields (like `damageType`, `source`) without breaking existing consumers.

---

## Requirements

### REQ-1: Part Health Component

**Component ID**: `anatomy:part_health`

**Purpose**: Track health status of a body part entity.

**Required Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `currentHealth` | number (>= 0) | Current health points |
| `maxHealth` | number (>= 1) | Maximum health capacity |
| `state` | enum | Narrative health state |
| `turnsInState` | integer (>= 0) | Consecutive turns in current state |

**Health States** (enum values):
- `healthy` - 76-100% of max health
- `bruised` - 51-75% of max health
- `wounded` - 26-50% of max health
- `badly_damaged` - 1-25% of max health
- `destroyed` - 0% (exactly zero)

**Behavior**:
- Component can be added to any entity with `anatomy:part` component
- `currentHealth` must not exceed `maxHealth`
- `currentHealth` must not be negative (clamped to 0)
- `turnsInState` resets to 0 when state changes, increments otherwise

---

### REQ-2: Health Thresholds Lookup

**File**: `data/mods/anatomy/lookups/part_health_thresholds.json`

**Purpose**: Reference data for threshold-to-state mapping.

**Required Structure**:

```
{
  "defaultThresholds": [
    { "state": "healthy", "minPercentage": 76, "maxPercentage": 100 },
    { "state": "bruised", "minPercentage": 51, "maxPercentage": 75 },
    { "state": "wounded", "minPercentage": 26, "maxPercentage": 50 },
    { "state": "badly_damaged", "minPercentage": 1, "maxPercentage": 25 },
    { "state": "destroyed", "minPercentage": 0, "maxPercentage": 0 }
  ]
}
```

**Extension Points**:
- `partTypeOverrides` object for future per-part-type thresholds
- `creatureTypeOverrides` for creature-specific thresholds

---

### REQ-3: MODIFY_PART_HEALTH Operation

**Operation Type**: `MODIFY_PART_HEALTH`

**Purpose**: Change a body part's health value by a delta amount.

**Required Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `part_entity_ref` | string or object | Reference to part entity |
| `delta` | number | Health change (negative = damage, positive = healing) |

**Optional Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `clamp_to_bounds` | boolean | true | Clamp result to [0, maxHealth] |

**Behavior**:
1. Resolve `part_entity_ref` to entity ID
2. Get current `anatomy:part_health` component
3. Calculate new health: `newHealth = currentHealth + delta`
4. If `clamp_to_bounds`: clamp to [0, maxHealth]
5. Update component with new `currentHealth`
6. Dispatch `anatomy:part_health_changed` event
7. Call UPDATE_PART_HEALTH_STATE to recalculate state

**Error Conditions**:
- Entity not found
- Entity missing `anatomy:part_health` component
- Invalid delta (non-numeric)

---

### REQ-4: UPDATE_PART_HEALTH_STATE Operation

**Operation Type**: `UPDATE_PART_HEALTH_STATE`

**Purpose**: Recalculate narrative health state from current health percentage.

**Required Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `part_entity_ref` | string or object | Reference to part entity |

**Behavior**:
1. Resolve `part_entity_ref` to entity ID
2. Get current `anatomy:part_health` component
3. Calculate percentage: `(currentHealth / maxHealth) * 100`
4. Map percentage to state using threshold rules
5. If state changed:
   - Reset `turnsInState` to 0
   - Dispatch `anatomy:part_state_changed` event
6. If state unchanged:
   - Increment `turnsInState`
7. Update component

**State Calculation Logic**:
```
if percentage > 75: return "healthy"
if percentage > 50: return "bruised"
if percentage > 25: return "wounded"
if percentage > 0: return "badly_damaged"
return "destroyed"
```

---

### REQ-5: Part Health Changed Event

**Event ID**: `anatomy:part_health_changed`

**Purpose**: Notify systems when a part's health value changes.

**Trigger**: Dispatched by MODIFY_PART_HEALTH on any health change.

**Required Payload Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `partEntityId` | string | Entity ID of the affected part |
| `ownerEntityId` | string | Entity ID of the character (if determinable) |
| `partType` | string | The subType of the part (e.g., "arm", "head") |
| `previousHealth` | number | Health before change |
| `newHealth` | number | Health after change |
| `maxHealth` | number | Maximum health of the part |
| `healthPercentage` | number | Current percentage (0-100) |
| `delta` | number | Amount changed |
| `timestamp` | integer | Game turn or timestamp |

**Extensibility**: Schema should allow additional properties for future fields like `damageType`, `source`.

---

### REQ-6: Part State Changed Event

**Event ID**: `anatomy:part_state_changed`

**Purpose**: Notify systems when a part crosses a health state threshold.

**Trigger**: Dispatched by UPDATE_PART_HEALTH_STATE only when state actually changes.

**Required Payload Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `partEntityId` | string | Entity ID of the affected part |
| `ownerEntityId` | string | Entity ID of the character |
| `partType` | string | The subType of the part |
| `previousState` | string | State before transition |
| `newState` | string | State after transition |
| `turnsInPreviousState` | integer | Duration in previous state |
| `healthPercentage` | number | Current percentage |
| `isDeterioration` | boolean | True if moving to worse state |
| `timestamp` | integer | Game turn or timestamp |

**Extensibility**: Schema should allow additional properties.

---

## Integration Points

### Existing System Dependencies

| System | Integration |
|--------|-------------|
| Anatomy System | Parts are entities with `anatomy:part` component |
| Entity Manager | Component CRUD via `batchAddComponentsOptimized` |
| Event System | Dispatch via `SafeEventDispatcher` |
| Operation Registry | Follow standard operation registration pattern |

### Files to Reference

| File | Purpose |
|------|---------|
| `src/logic/operationHandlers/updateHungerStateHandler.js` | Pattern for state update handler |
| `data/mods/metabolism/components/hunger_state.component.json` | Pattern for component schema |
| `data/mods/metabolism/lookups/hunger_thresholds.json` | Pattern for threshold lookup |
| `data/mods/anatomy/events/limb_detached.event.json` | Pattern for anatomy events |
| `src/utils/preValidationUtils.js` | Operation type whitelist |

### Registration Checklist

Per CLAUDE.md "Adding New Operations" section:

1. Create operation schemas in `data/schemas/operations/`
2. Add schema references to `data/schemas/operation.schema.json`
3. Define DI tokens in `src/dependencyInjection/tokens/tokens-core.js`
4. Register factories in `operationHandlerRegistrations.js`
5. Map operations in `interpreterRegistrations.js`
6. **CRITICAL**: Add to `KNOWN_OPERATION_TYPES` in `preValidationUtils.js`
7. Update `data/mods/anatomy/mod-manifest.json`

---

## Test Requirements

### Unit Tests

| Handler | Test Cases |
|---------|------------|
| UpdatePartHealthStateHandler | State calculation at each threshold boundary |
| UpdatePartHealthStateHandler | turnsInState increment/reset logic |
| UpdatePartHealthStateHandler | Event dispatch only on state change |
| UpdatePartHealthStateHandler | Error handling for missing components |
| ModifyPartHealthHandler | Positive delta (healing) |
| ModifyPartHealthHandler | Negative delta (damage) |
| ModifyPartHealthHandler | Clamping to [0, maxHealth] |
| ModifyPartHealthHandler | Event dispatch with correct payload |

### Integration Tests

| Scenario | Validation |
|----------|------------|
| Full lifecycle | Create part, add health, modify, verify state |
| State transitions | Damage through all states, verify events |
| Multiple parts | Verify operations work on different parts |
| Edge cases | 0%, 100%, exact threshold boundaries |

---

## Future Iteration Hooks

This iteration establishes extension points for future features:

| Future Feature | Extension Mechanism |
|----------------|---------------------|
| Damage types | Add optional `damageType` param to MODIFY_PART_HEALTH |
| Bleeding | New `anatomy:bleeding` component + rules |
| Healing | New healing actions using MODIFY_PART_HEALTH |
| Death logic | Rules listening to `part_state_changed` on vital parts |
| Armor | Check armor component before MODIFY_PART_HEALTH |
| Limb detachment | Rules triggered by `destroyed` state |

---

## Success Criteria

1. Body part entities can have health tracked via `anatomy:part_health` component
2. Health values can be modified via `MODIFY_PART_HEALTH` operation
3. State labels update automatically based on health percentage
4. `anatomy:part_health_changed` event fires on any health modification
5. `anatomy:part_state_changed` event fires only on threshold crossings
6. All operations follow established DI and registration patterns
7. Unit and integration tests pass with 80%+ coverage
8. No breaking changes to existing anatomy system
