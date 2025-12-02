# Anatomy and Damage System Exploration Report

## Executive Summary

The Living Narrative Engine has a sophisticated anatomy system with support for damage types, health states, and status effects (bleeding, burning, poisoned, fractured, stunned). Currently, damage is applied through **APPLY_DAMAGE** and **MODIFY_PART_HEALTH** operations, but there is **NO DamageTypeEffectsSystem** - status effects are not processed on a per-turn basis. The system is ready for implementation of turn-based damage type effects processing.

---

## 1. Current System Architecture

### 1.1 Systems Directory Structure
- **src/anatomy/** - Anatomy-specific services (visualization, body graph, blueprints, recipes)
- **src/combat/services/** - Combat support services (chance calculation, outcome determination, probability)
- **src/turns/** - Turn management (TurnManager, RoundManager, TurnCycle)
- **NO src/systems/** directory exists - no centralized "systems" pattern currently

### 1.2 Key Finding: Modular Architecture
- No traditional ECS "Systems" directory
- Functionality organized by domain (anatomy, combat, turns, logic)
- Operation handlers (in `src/logic/operationHandlers/`) process game logic
- Events dispatched via event bus for inter-system communication

---

## 2. Damage System Components

### 2.1 Damage Type Definitions
**Location:** `data/mods/anatomy/damage-types/`

**Three damage types currently defined:**
1. **blunt.json** - Blunt Force
   - `penetration: 0.1`
   - `fracture.enabled: true` (50% threshold, 20% stun chance)
   - Causes bruising and fractures

2. **piercing.json** - Piercing
   - `penetration: 0.8`
   - `bleed.enabled: true` (minor, 2 turn baseline duration)
   - Causes bleeding

3. **slashing.json** - Slashing
   - `penetration: 0.3`
   - `bleed.enabled: true` (moderate, 3 turn baseline duration)
   - `dismember.enabled: true` (80% threshold)
   - Causes bleeding and can dismember

**Schema location:** `data/schemas/operations/damage-type.schema.json` (inferred)

### 2.2 Damage Loader
- **File:** `src/loaders/damageTypeLoader.js`
- Extends `SimpleItemLoader`
- Loads damage types from mod manifests
- Content type: `damageTypes`

---

## 3. Status Effect Components

**Location:** `data/mods/anatomy/components/`

### 3.1 Active Status Effects

1. **bleeding.component.json**
   - Schema: `anatomy:bleeding`
   - Fields:
     - `severity`: "minor" | "moderate" | "severe"
     - `remainingTurns`: integer (0+)
     - `tickDamage`: number (damage per turn)
   - Function: Damage over time with severity levels

2. **burning.component.json**
   - Schema: `anatomy:burning`
   - Fields:
     - `remainingTurns`: integer (0+)
     - `tickDamage`: number (damage per turn)
     - `stackedCount`: integer (1+) - tracks stacking
   - Function: Fire damage with stacking mechanics

3. **poisoned.component.json**
   - Schema: `anatomy:poisoned`
   - Fields:
     - `remainingTurns`: integer (0+)
     - `tickDamage`: number (damage per turn)
   - Function: Poison damage over time

4. **fractured.component.json**
   - Schema: `anatomy:fractured`
   - Fields:
     - `sourceDamageType`: string (damage type ID that caused fracture)
     - `appliedAtHealth`: number (health when fracture occurred)
   - Function: Tracks bone fractures (no tick damage, but affects mechanics)

5. **stunned.component.json**
   - Schema: `anatomy:stunned`
   - Fields:
     - `remainingTurns`: integer (0+) - duration of stun
     - `sourcePartId`: string (optional - which body part caused stun)
   - Function: Prevents action for specified turns

### 3.2 Supporting Components

- **part_health.component.json** - Tracks part health with states:
  - healthy (76-100%)
  - bruised (51-75%)
  - wounded (26-50%)
  - badly_damaged (1-25%)
  - destroyed (0%)
  - Fields: `currentHealth`, `maxHealth`, `state`, `turnsInState`

---

## 4. Damage Application Operations

### 4.1 APPLY_DAMAGE Operation
**File:** `src/logic/operationHandlers/applyDamageHandler.js`

**Purpose:** Apply direct damage to a body part

**Parameters:**
- `entity_ref`: Entity to damage
- `part_ref`: Body part to damage (optional - auto-selects random if missing)
- `amount`: Damage amount (numeric or JSON Logic)
- `damage_type`: Type of damage (string ID like "blunt", "piercing", "slashing")
- `propagatedFrom`: Optional tracking of damage propagation

**Execution Flow:**
1. Resolves entity and part references
2. If part not specified, selects random part using hit probability weights
3. Dispatches `anatomy:damage_applied` event
4. Updates `anatomy:part_health` component (clamps to 0)
5. Calculates new health state
6. Dispatches `anatomy:part_health_changed` event
7. Dispatches `anatomy:part_destroyed` event if health reaches 0
8. Propagates damage to child parts (if propagation rules exist)

**Events Dispatched:**
- `anatomy:damage_applied` - When damage starts
- `anatomy:part_health_changed` - When health value changes
- `anatomy:part_destroyed` - When part health reaches 0

**Integration Point:** Operation registry maps `APPLY_DAMAGE` to `ApplyDamageHandler`

### 4.2 MODIFY_PART_HEALTH Operation
**File:** `src/logic/operationHandlers/modifyPartHealthHandler.js`

**Purpose:** Change part health by delta (damage or healing)

**Parameters:**
- `part_entity_ref`: Body part to modify
- `delta`: Health change (negative = damage, positive = healing)
- `clamp_to_bounds`: Whether to clamp to [0, maxHealth] (default: true)

**Execution Flow:**
1. Validates parameters
2. Resolves part entity reference
3. Gets current health component
4. Calculates new health: `currentHealth + delta`
5. Clamps to bounds if enabled
6. Updates `turnsInState` counter
7. Updates `part_health` component
8. Dispatches `anatomy:part_health_changed` event

**Events Dispatched:**
- `anatomy:part_health_changed` - Complete health change info

### 4.3 UPDATE_PART_HEALTH_STATE Operation
**File:** `src/logic/operationHandlers/updatePartHealthStateHandler.js`

**Purpose:** Recalculate health state from current health percentage

**Parameters:**
- `part_entity_ref`: Body part to update

**Execution Flow:**
1. Gets current health and max health
2. Calculates health percentage
3. Maps to state: healthy → bruised → wounded → badly_damaged → destroyed
4. Updates `turnsInState` (increment if same state, reset if changed)
5. Dispatches `anatomy:part_state_changed` event only if state changed

**Events Dispatched:**
- `anatomy:part_state_changed` - Only on state transitions

---

## 5. Event System

### 5.1 Anatomy Events
**Location:** `data/mods/anatomy/events/`

1. **part_health_changed** - `anatomy:part_health_changed`
   - Fires on ANY health change
   - Payload includes: previous/new health, health percentage, previous/new state, delta
   - Use for: tracking all health modifications

2. **part_state_changed** - `anatomy:part_state_changed`
   - Fires ONLY when state crosses threshold
   - Payload includes: previous/new state, turns in state, health percentage, isDeterioration
   - Use for: narrative state transitions

3. **limb_detached** - `anatomy:limb_detached`
   - Fires when part is detached from parent
   - Payload includes: detached entity ID, parent, socket, count, reason
   - Use for: tracking amputation/dismemberment

4. **anatomy_generated** - `anatomy:anatomy_generated`
   - Fires when character anatomy is generated
   - Use for: initialization hooks

### 5.2 Event Dispatcher Pattern
- Central event bus: `src/events/eventBus.js`
- Safe dispatcher: `ISafeEventDispatcher` interface
- All events go through validation

---

## 6. Turn System Architecture

### 6.1 Turn Management
**File:** `src/turns/turnManager.js`

**Key Components:**
- `TurnManager` - Orchestrates turn advancement
- `RoundManager` - Manages round initialization and success tracking
- `TurnCycle` - Wraps turn order service

**Turn Flow:**
1. `start()` - Initializes turn management, subscribes to turn-ended events
2. `advanceTurn()` - Gets next actor from turn queue
3. Handler's `startTurn()` - Actor performs their turn
4. Waits for `core:turn_ended` event
5. Cleanup and schedule next turn

**Integration Point:** This is where turn-based effects would hook in

### 6.2 Turn Cycle
**File:** `src/turns/turnCycle.js`

- Gets next participating actor
- Checks `participation` component for `participating: true`
- Returns null when queue empty (triggers round restart)
- Skips non-participating actors

---

## 7. Operation Registry & Mapping

**File:** `src/dependencyInjection/registrations/interpreterRegistrations.js`

**Current Damage-Related Registrations:**
```javascript
registry.register('APPLY_DAMAGE', bind(tokens.ApplyDamageHandler));
registry.register('MODIFY_PART_HEALTH', bind(tokens.ModifyPartHealthHandler));
registry.register('UPDATE_PART_HEALTH_STATE', bind(tokens.UpdatePartHealthStateHandler));
registry.register('END_TURN', bind(tokens.EndTurnHandler));
```

**Token Pattern:** Operations map to handler tokens (no "I" prefix)
**Token Location:** `src/dependencyInjection/tokens/tokens-core.js`
**Handler Registration:** `src/dependencyInjection/registrations/operationHandlerRegistrations.js`

---

## 8. Violence & Combat Integration

### 8.1 Violence Mod
**Location:** `data/mods/violence/rules/`

Contains rules for:
- handle_slap.rule.json
- handle_sucker_punch.rule.json
- handle_grab_neck.rule.json
- handle_squeeze_neck_with_both_hands.rule.json
- handle_tear_out_throat.rule.json

These rules likely use APPLY_DAMAGE operations internally.

### 8.2 Damage Type Component
**Location:** `data/mods/damage-types/components/can_cut.component.json`
- Marker component indicating entity can deal cutting damage
- Schema: `damage-types:can_cut`

---

## 9. Missing Pieces: What Needs Implementation

### 9.1 Turn-Based Status Effect Processing
**Currently Missing:**
- No system to process tick damage each turn
- No component to remove status effects when remainingTurns reaches 0
- No stun effect blocking (stun prevents actors from taking turns but not implemented)
- No fracture impact on mechanics

**Would Need:**
1. A system/service to process status effects at end of turn
2. Rules or operations to:
   - Decrement `remainingTurns` for all status effects
   - Apply `tickDamage` via MODIFY_PART_HEALTH
   - Remove component when duration expires
   - Handle stun effect blocking (prevent turn start)
3. Integration hook in TurnManager's turn cycle

### 9.2 Damage Type Effect Application
**Currently Missing:**
- No automatic application of status effects when APPLY_DAMAGE is called
- No mapping of damage type → status effects
- No probability/threshold evaluation for fractures/dismemberment

**Would Need:**
1. DamageTypeEffectsSystem to:
   - Evaluate damage type effects (bleed, burn probability)
   - Apply status effect components based on damage properties
   - Handle special mechanics (fracture at threshold, stun chance, dismemberment)
2. Integration into APPLY_DAMAGE operation flow
3. Rules for stun effect application and turn blocking

### 9.3 Stun Effect Mechanics
**Currently Missing:**
- Stun component exists but nothing checks `participation: false` or stun status
- No logic to prevent stunned actors from taking turns

**Would Need:**
1. Integration in TurnCycle.nextActor() to check for stun
2. Automatic stun removal when remainingTurns reaches 0
3. Optional component to lock action during stun

---

## 10. Integration Architecture for DamageTypeEffectsSystem

### 10.1 Recommended Location
`src/anatomy/damageTypeEffectsSystem.js` or `src/combat/services/damageTypeEffectsSystem.js`

### 10.2 Integration Points

**Point 1: After APPLY_DAMAGE Operation**
- Hook into damage applied event: `anatomy:damage_applied`
- Evaluate damage type configuration
- Apply status effects based on type and damage amount

**Point 2: Turn End Processing**
- Subscribe to `core:turn_ended` event
- Process all active status effects
- Decrement remainingTurns
- Apply tick damage
- Remove expired effects

**Point 3: Turn Start (Stun Block)**
- Before handler.startTurn() in TurnManager.advanceTurn()
- Check for active stun component
- If stunned, skip turn or set participation: false

### 10.3 Data Flow

```
APPLY_DAMAGE operation
  ↓
applyDamageHandler executes
  ├─ Updates part_health
  └─ Dispatches anatomy:damage_applied
      ↓
  DamageTypeEffectsSystem listener
    ├─ Reads damage type config (blunt/piercing/slashing)
    ├─ Evaluates effect conditions (bleed probability, fracture threshold)
    └─ Applies status effect components
        ├─ anatomy:bleeding
        ├─ anatomy:burning
        ├─ anatomy:poisoned
        ├─ anatomy:fractured
        └─ anatomy:stunned

Turn cycle
  ├─ TurnManager.advanceTurn()
  ├─ Resolve next actor
  ├─ Check for stun (should skip or set participating: false)
  └─ Call handler.startTurn()

Turn end
  ├─ core:turn_ended event
      ↓
  DamageTypeEffectsSystem listener
    ├─ For each entity with active status effects
    ├─ Decrement remainingTurns
    ├─ Apply tickDamage via MODIFY_PART_HEALTH
    ├─ Remove component if remainingTurns = 0
    └─ Dispatch status:effect_expired event
```

---

## 11. Schema and Validation

### 11.1 Operation Schemas
- Must add to: `data/schemas/operations/`
- Reference from: `data/schemas/operation.schema.json`
- Pre-validation whitelist: `src/utils/preValidationUtils.js` (KNOWN_OPERATION_TYPES)

### 11.2 Component Schemas
- Already defined in: `data/mods/anatomy/components/`
- Validation via AJV in: `src/validation/`

### 11.3 Damage Type Schema
- Already defined in: `data/schemas/damage-type.schema.json` (inferred)
- Loaded via: `DamageTypeLoader`

---

## 12. Key Code Locations Summary

| Component | Location | Purpose |
|-----------|----------|---------|
| Damage Handler | `src/logic/operationHandlers/applyDamageHandler.js` | Apply damage to parts |
| Health Modifier | `src/logic/operationHandlers/modifyPartHealthHandler.js` | Change health by delta |
| State Updater | `src/logic/operationHandlers/updatePartHealthStateHandler.js` | Recalculate health state |
| Turn Manager | `src/turns/turnManager.js` | Main turn cycle orchestrator |
| Round Manager | `src/turns/roundManager.js` | Round initialization and tracking |
| Damage Types | `data/mods/anatomy/damage-types/` | Type definitions (blunt, piercing, slashing) |
| Status Effects | `data/mods/anatomy/components/` | Component schemas (bleeding, burning, etc.) |
| Events | `data/mods/anatomy/events/` | Event definitions |
| Loaders | `src/loaders/damageTypeLoader.js` | Loads damage type data |
| Combat Services | `src/combat/services/` | Hit chance, outcome determination |
| DI Registration | `src/dependencyInjection/registrations/` | Handler and service registration |

---

## 13. Dependency Injection Pattern

**Operation Handler Pattern:**
```javascript
// Token definition
tokens.DamageTypeEffectsSystemHandler = 'DamageTypeEffectsSystem'

// Handler registration
registrar.singletonFactory(
  tokens.DamageTypeEffectsSystem,
  (c) => new DamageTypeEffectsSystem({
    logger: c.resolve(tokens.ILogger),
    entityManager: c.resolve(tokens.IEntityManager),
    dispatcher: c.resolve(tokens.ISafeEventDispatcher),
    dataRegistry: c.resolve(tokens.IDataRegistry),
    operationInterpreter: c.resolve(tokens.OperationInterpreter),
  })
)
```

---

## 14. Event Hook Examples

**Subscribe to damage application:**
```javascript
dispatcher.subscribe('anatomy:damage_applied', (event) => {
  const { entityId, partId, amount, damageType } = event.payload;
  // Evaluate and apply status effects
});
```

**Subscribe to turn end:**
```javascript
dispatcher.subscribe('core:turn_ended', (event) => {
  const { entityId, success } = event.payload;
  // Process tick damage for all entities with status effects
});
```

---

## 15. Testing Locations

- Unit tests: `tests/unit/` (mirror src structure)
- Integration tests: `tests/integration/`
- Mod testing: `tests/` with ModTestFixture
- Test helpers: `tests/common/`

---

## Conclusion

The anatomy and damage system is **well-structured but incomplete**. Status effect components exist and are properly defined, but there's no turn-based processing system to:

1. Decrement effect durations each turn
2. Apply tick damage from ongoing effects
3. Remove effects when expired
4. Apply status effects from damage types
5. Block stunned actors from taking turns

A **DamageTypeEffectsSystem** would hook into:
- `anatomy:damage_applied` events to apply initial effects
- `core:turn_ended` events to process tick damage
- `TurnManager.advanceTurn()` to check for stuns

This system would act as a mediator between the damage application layer and the turn/status effect management layer.
