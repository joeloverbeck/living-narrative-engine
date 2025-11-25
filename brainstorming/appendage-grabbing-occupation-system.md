# Brainstorming: Appendage Grabbing/Occupation Tracking System

> **Document Type**: Brainstorming/Design Exploration
> **Context**: Building on the `wield_threateningly.action.json` implementation as the foundation for weapon mechanics, attack types, and action gating based on available grabbing appendages.

### Design Decisions (User Confirmed)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Track item-appendage mapping | **YES** | Enables "drop what's in left hand" commands; store `heldItemId` on each `can_grab` component |
| `requires_grabbing` location | **anatomy mod** | Groups related components together (`can_grab` + `requires_grabbing`) |
| Implement grip strength | **NOW** | Add `gripStrength` to appendages and `minGripStrength` to items for weight-based restrictions |

---

## 1. Problem Statement

The Living Narrative Engine needs to track how many grabbing-capable appendages (hands, tentacles, claws, etc.) are currently occupied. This affects action availability:

- **Example**: An actor holding a longsword (two-handed) cannot hug someone
- **Example**: An actor wielding a dagger (one-handed) could still perform actions requiring one free hand
- **Example**: An actor already wielding a dagger cannot wield a longsword because one hand is already occupied

Without this system, actions like hugging, grabbing objects, or wielding additional weapons would be available even when anatomically impossible.

---

## 2. Existing System Analysis

### 2.1 Current Lock-Based Components

The engine already implements **POSIX-style locks** for gating actions:

#### `core:mouth_engagement` Component
```json
{
  "id": "core:mouth_engagement",
  "dataSchema": {
    "properties": {
      "locked": { "type": "boolean", "default": false },
      "forcedOverride": { "type": "boolean", "default": false }
    },
    "required": ["locked"]
  }
}
```
- **Usage**: Gates oral actions (kissing, biting, speaking with full mouth, etc.)
- **Attached to**: Mouth body parts
- **Checked via**: `hasPartOfTypeWithComponentValue` operator

#### `core:movement` Component
```json
{
  "id": "core:movement",
  "dataSchema": {
    "properties": {
      "locked": { "type": "boolean", "default": false },
      "forcedOverride": { "type": "boolean", "default": false }
    },
    "required": ["locked"]
  }
}
```
- **Usage**: Gates movement actions (go, follow, teleport)
- **Attached to**: Leg body parts
- **Checked via**: `hasPartWithComponentValue` operator

### 2.2 Lock/Unlock Operation Handlers

Four handlers manage these locks:

| Handler | Operation Type | Purpose |
|---------|---------------|---------|
| `LockMovementHandler` | `LOCK_MOVEMENT` | Sets `locked: true` on movement components |
| `UnlockMovementHandler` | `UNLOCK_MOVEMENT` | Sets `locked: false` on movement components |
| `LockMouthEngagementHandler` | `LOCK_MOUTH_ENGAGEMENT` | Sets `locked: true` on mouth engagement |
| `UnlockMouthEngagementHandler` | `UNLOCK_MOUTH_ENGAGEMENT` | Sets `locked: false` on mouth engagement |

**Common Pattern**:
1. Accept `actor_id` parameter
2. Find body parts with the relevant component
3. Update the `locked` boolean via utility function
4. Dispatch success/error events

### 2.3 Condition Checking Pattern

**Condition Definition** (`movement:actor-can-move`):
```json
{
  "logic": {
    "hasPartWithComponentValue": ["actor", "core:movement", "locked", false]
  }
}
```

**Action Prerequisite** (`movement:go`):
```json
{
  "prerequisites": [{
    "logic": { "condition_ref": "movement:actor-can-move" },
    "failure_message": "You cannot move without functioning legs."
  }]
}
```

### 2.4 Key Limitation

**Current locks are binary** (locked/unlocked). The grabbing system requires **counting** - tracking how many of N appendages are occupied.

---

## 3. Proposed System Design

### 3.1 Core Concept: Countable Locks

Instead of a single boolean lock, we need:
1. **Component on grabbing appendages** marking them as occupied/free
2. **Component on items** specifying how many grabbing appendages they require
3. **Operation handlers** that lock/unlock a specific count of appendages
4. **Operators** that check if enough free appendages exist

### 3.2 New Components

#### 3.2.1 `anatomy:can_grab` Component

**Location**: `data/mods/anatomy/components/can_grab.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "anatomy:can_grab",
  "description": "Marks a body part as capable of grabbing/holding items. Contains a lock that indicates whether this appendage is currently occupied.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "locked": {
        "description": "If true, this grabbing appendage is currently occupied (holding something). If false, it's available.",
        "type": "boolean",
        "default": false
      },
      "heldItemId": {
        "description": "Optional: The entity ID of the item currently held by this appendage. Null if not holding anything.",
        "type": ["string", "null"],
        "default": null
      },
      "gripStrength": {
        "description": "Optional: The strength of grip this appendage provides. Can be used for weight limits or skill checks.",
        "type": "number",
        "default": 1.0
      }
    },
    "required": ["locked"],
    "additionalProperties": false
  }
}
```

**Applied to**: Body parts that can grab things
- `anatomy:human_hand` → add `anatomy:can_grab`
- `anatomy:squid_tentacle` → add `anatomy:can_grab`
- `anatomy:crab_claw` → add `anatomy:can_grab`
- etc.

#### 3.2.2 `anatomy:requires_grabbing` Component

**Location**: `data/mods/anatomy/components/requires_grabbing.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "anatomy:requires_grabbing",
  "description": "Specifies how many grabbing appendages are needed to hold/wield this item.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "handsRequired": {
        "description": "Number of grabbing appendages required to hold this item (e.g., 1 for dagger, 2 for longsword, 0 for rings).",
        "type": "integer",
        "minimum": 0,
        "default": 1
      },
      "minGripStrength": {
        "description": "Optional: Minimum total grip strength required. If set, the sum of gripStrength from all assigned appendages must meet this threshold.",
        "type": "number",
        "minimum": 0
      }
    },
    "required": ["handsRequired"],
    "additionalProperties": false
  }
}
```

**Applied to**: Weapons, instruments, tools, heavy items (component ID: `anatomy:requires_grabbing`)
- `fantasy:vespera_rapier` → `handsRequired: 1`
- `fantasy:vespera_main_gauche` → `handsRequired: 1`
- `fantasy:vespera_hybrid_lute_viol` → `handsRequired: 2`
- Longsword → `handsRequired: 2`
- Shield → `handsRequired: 1`
- Ring → `handsRequired: 0` (worn, not held)

### 3.3 New Operation Handlers

#### 3.3.1 `LOCK_GRABBING` Operation

**Schema**: `data/schemas/operations/lockGrabbing.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/lockGrabbing.schema.json",
  "title": "LOCK_GRABBING Operation",
  "allOf": [
    { "$ref": "../base-operation.schema.json" },
    {
      "properties": {
        "type": { "const": "LOCK_GRABBING" },
        "parameters": { "$ref": "#/$defs/Parameters" }
      }
    }
  ],
  "$defs": {
    "Parameters": {
      "type": "object",
      "properties": {
        "actor_id": {
          "type": "string",
          "description": "The ID of the actor whose appendages to lock"
        },
        "count": {
          "type": "integer",
          "minimum": 1,
          "description": "Number of grabbing appendages to lock"
        },
        "item_id": {
          "type": "string",
          "description": "Optional: The ID of the item being held. Will be stored in heldItemId."
        }
      },
      "required": ["actor_id", "count"],
      "additionalProperties": false
    }
  }
}
```

**Handler Logic** (`src/logic/operationHandlers/lockGrabbingHandler.js`):
1. Find all body parts with `anatomy:can_grab` component where `locked: false`
2. Verify at least `count` free appendages exist (fail if not)
3. Lock exactly `count` appendages (set `locked: true`, optionally set `heldItemId`)
4. Dispatch success event with which appendages were locked

#### 3.3.2 `UNLOCK_GRABBING` Operation

**Schema**: `data/schemas/operations/unlockGrabbing.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/unlockGrabbing.schema.json",
  "title": "UNLOCK_GRABBING Operation",
  "allOf": [
    { "$ref": "../base-operation.schema.json" },
    {
      "properties": {
        "type": { "const": "UNLOCK_GRABBING" },
        "parameters": { "$ref": "#/$defs/Parameters" }
      }
    }
  ],
  "$defs": {
    "Parameters": {
      "type": "object",
      "properties": {
        "actor_id": {
          "type": "string",
          "description": "The ID of the actor whose appendages to unlock"
        },
        "count": {
          "type": "integer",
          "minimum": 1,
          "description": "Number of grabbing appendages to unlock"
        },
        "item_id": {
          "type": "string",
          "description": "Optional: Unlock appendages holding this specific item"
        }
      },
      "required": ["actor_id", "count"],
      "additionalProperties": false
    }
  }
}
```

**Handler Logic** (`src/logic/operationHandlers/unlockGrabbingHandler.js`):
1. Find body parts with `anatomy:can_grab` where `locked: true`
2. If `item_id` provided, filter to those with `heldItemId === item_id`
3. Unlock exactly `count` appendages (set `locked: false`, clear `heldItemId`)
4. Dispatch success event

### 3.4 New Operators

#### 3.4.1 `hasFreeGrabbingAppendages` Operator

**Location**: `src/logic/operators/hasFreeGrabbingAppendagesOperator.js`

**Usage in JSON Logic**:
```json
{
  "hasFreeGrabbingAppendages": ["actor", 2]
}
```
Returns `true` if actor has at least 2 unlocked `anatomy:can_grab` appendages.

**Implementation Pattern**:
```javascript
class HasFreeGrabbingAppendagesOperator extends BaseEquipmentOperator {
  evaluateInternal(entityId, params, context) {
    const [requiredCount] = params;

    // Get anatomy body component
    const bodyComponent = this.entityManager.getComponentData(entityId, 'anatomy:body');
    if (!bodyComponent?.body?.parts) return false;

    // Count free appendages
    let freeCount = 0;
    for (const partId of Object.values(bodyComponent.body.parts)) {
      const canGrab = this.entityManager.getComponentData(partId, 'anatomy:can_grab');
      if (canGrab && !canGrab.locked) {
        freeCount++;
      }
    }

    return freeCount >= requiredCount;
  }
}
```

#### 3.4.2 `getRequiredGrabbingCount` Operator (Optional)

**Usage**: Get the `handsRequired` value from an item to use in dynamic checks.

```json
{
  "hasFreeGrabbingAppendages": [
    "actor",
    { "getRequiredGrabbingCount": [{ "var": "target" }] }
  ]
}
```

### 3.5 Utility Functions

**Location**: `src/utils/grabbingUtils.js`

```javascript
/**
 * Count free grabbing appendages for an entity
 */
export function countFreeGrabbingAppendages(entityManager, entityId) { ... }

/**
 * Lock N grabbing appendages, optionally associating with an item
 */
export async function lockGrabbingAppendages(entityManager, entityId, count, itemId = null) { ... }

/**
 * Unlock N grabbing appendages, optionally filtering by held item
 */
export async function unlockGrabbingAppendages(entityManager, entityId, count, itemId = null) { ... }

/**
 * Get list of items currently held by an entity's appendages
 */
export function getHeldItems(entityManager, entityId) { ... }
```

---

## 4. Integration Points

### 4.1 Body Part Entity Updates

Add `anatomy:can_grab` component to grabbing-capable body parts:

**`data/mods/anatomy/entities/definitions/human_hand.entity.json`**:
```json
{
  "id": "anatomy:human_hand",
  "components": {
    "anatomy:part": { "subType": "hand" },
    "core:name": { "text": "hand" },
    "anatomy:can_grab": { "locked": false, "heldItemId": null, "gripStrength": 1.0 }
  }
}
```

**`data/mods/anatomy/entities/definitions/squid_tentacle.entity.json`**:
```json
{
  "id": "anatomy:squid_tentacle",
  "components": {
    "anatomy:part": { "subType": "tentacle" },
    "core:name": { "text": "tentacle" },
    "anatomy:can_grab": { "locked": false, "heldItemId": null, "gripStrength": 0.8 }
  }
}
```

### 4.2 Weapon/Item Entity Updates

Add `anatomy:requires_grabbing` component to holdable items:

**`data/mods/fantasy/entities/definitions/vespera_rapier.entity.json`**:
```json
{
  "components": {
    // ... existing components ...
    "anatomy:requires_grabbing": { "handsRequired": 1 }
  }
}
```

**Longsword Example**:
```json
{
  "components": {
    "anatomy:requires_grabbing": { "handsRequired": 2 }
  }
}
```

### 4.3 Condition Definitions

**`anatomy:actor-has-free-hands.condition.json`**:
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "anatomy:actor-has-free-hands",
  "description": "Checks if the actor has at least one free grabbing appendage",
  "logic": {
    "hasFreeGrabbingAppendages": ["actor", 1]
  }
}
```

**`anatomy:actor-can-wield-item.condition.json`**:
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "anatomy:actor-can-wield-item",
  "description": "Checks if the actor has enough free hands to wield the target item",
  "logic": {
    "or": [
      {
        "!": { "has_component": ["target", "anatomy:requires_grabbing"] }
      },
      {
        "hasFreeGrabbingAppendages": [
          "actor",
          { "var": "target.components.anatomy:requires_grabbing.handsRequired" }
        ]
      }
    ]
  }
}
```

### 4.4 Action Updates

**`weapons:wield_threateningly.action.json`** (updated):
```json
{
  "id": "weapons:wield_threateningly",
  "prerequisites": [
    {
      "logic": { "condition_ref": "anatomy:actor-can-wield-item" },
      "failure_message": "You don't have enough free hands to wield this weapon."
    }
  ]
  // ... rest of action
}
```

**`affection:hug.action.json`** (example):
```json
{
  "id": "affection:hug",
  "prerequisites": [
    {
      "logic": { "hasFreeGrabbingAppendages": ["actor", 2] },
      "failure_message": "You need both hands free to hug someone."
    }
  ]
}
```

### 4.5 Rule Updates for Wielding

When an actor wields a weapon, the rule should lock the appropriate appendages:

```json
{
  "operations": [
    {
      "type": "LOCK_GRABBING",
      "parameters": {
        "actor_id": { "var": "event.payload.actorId" },
        "count": { "var": "event.payload.target.components.anatomy:requires_grabbing.handsRequired" },
        "item_id": { "var": "event.payload.targetId" }
      }
    }
  ]
}
```

---

## 5. Example Scenarios

### Scenario 1: Wield Dagger (One-Handed)
1. Actor has 2 free hands
2. Dagger has `handsRequired: 1`
3. Prerequisite check: `hasFreeGrabbingAppendages(actor, 1)` → **PASS**
4. After wielding: `LOCK_GRABBING(actor, 1, dagger_id)`
5. Actor now has 1 free hand

### Scenario 2: Wield Longsword While Holding Dagger
1. Actor has 1 free hand (dagger in other)
2. Longsword has `handsRequired: 2`
3. Prerequisite check: `hasFreeGrabbingAppendages(actor, 2)` → **FAIL**
4. Action blocked: "You don't have enough free hands to wield this weapon."

### Scenario 3: Drop Dagger, Then Wield Longsword
1. Actor drops dagger: `UNLOCK_GRABBING(actor, 1, dagger_id)`
2. Actor now has 2 free hands
3. Longsword `handsRequired: 2`
4. Prerequisite check: `hasFreeGrabbingAppendages(actor, 2)` → **PASS**
5. After wielding: `LOCK_GRABBING(actor, 2, longsword_id)`

### Scenario 4: Tentacle Creature with 8 Appendages
1. Creature has 8 tentacles, each with `anatomy:can_grab`
2. Can hold multiple items simultaneously
3. Each wield action locks the appropriate number
4. More flexible than humanoids!

### Scenario 5: Hug Action Blocked
1. Actor is wielding longsword (2 hands occupied)
2. Hug requires 2 free hands
3. Prerequisite check: `hasFreeGrabbingAppendages(actor, 2)` → **FAIL**
4. Hug action not available in action list

---

## 6. Design Considerations

### 6.1 Which Appendage Gets Locked?

**Option A: First Available (Simple)**
- Lock the first N free appendages found
- Easy to implement
- May not respect handedness (dominant hand)

**Option B: Preference System (Complex)**
- Add `preferredHand` property to items
- Add `dominantHand` property to actors
- Match preferences when locking
- More realistic but complex

**Recommendation**: Start with Option A, add preferences later if needed.

### 6.2 Grip Strength and Weight

**Implementing Now**:
- `gripStrength` on appendages (default 1.0)
- `minGripStrength` on items
- Calculate total grip strength of locked appendages
- Fail if insufficient for heavy items

**Example**: A heavy greataxe might require `minGripStrength: 2.0`, so a creature with weak tentacles (`gripStrength: 0.5` each) would need 4 tentacles to wield it.

### 6.3 Dual-Wield vs Two-Handed

The system naturally handles both:
- **Dual-wield**: Two items each with `handsRequired: 1` → locks 2 appendages
- **Two-handed**: One item with `handsRequired: 2` → locks 2 appendages

### 6.4 Items That Don't Require Hands

Some items are worn, not held:
- Rings: `handsRequired: 0`
- Cloaks: `handsRequired: 0` (uses clothing system)
- Amulets: `handsRequired: 0`

### 6.5 What About Feet?

Some creatures might hold things with feet (monkeys, certain fantasy creatures):
- Create `anatomy:can_grab` variants or use flags
- Add `footGrab: true` to mark foot-capable grabbing
- Most actions would still require hand-type grabbing

---

## 7. Implementation Checklist

### Phase 1: Core Components
- [ ] Create `anatomy:can_grab` component schema
- [ ] Create `anatomy:requires_grabbing` component schema
- [ ] Add `can_grab` to hand entity definitions
- [ ] Add `requires_grabbing` to existing weapon entities

### Phase 2: Operation Handlers
- [ ] Create `lockGrabbing.schema.json`
- [ ] Create `unlockGrabbing.schema.json`
- [ ] Implement `LockGrabbingHandler.js`
- [ ] Implement `UnlockGrabbingHandler.js`
- [ ] Create `grabbingUtils.js` utility functions
- [ ] Register handlers in DI system
- [ ] Add to `preValidationUtils.js` whitelist

### Phase 3: Operators
- [ ] Implement `hasFreeGrabbingAppendagesOperator.js`
- [ ] Register operator in `jsonLogicCustomOperators.js`
- [ ] Create condition files (`actor-has-free-hands`, `actor-can-wield-item`)

### Phase 4: Integration
- [ ] Update `wield_threateningly.action.json` with prerequisites
- [ ] Create wield/unwield rules with lock/unlock operations
- [ ] Update actions requiring free hands (hug, grab, etc.)

### Phase 5: Testing
- [ ] Unit tests for handlers
- [ ] Unit tests for operator
- [ ] Integration tests for wield scenarios
- [ ] Edge case tests (no hands, many hands, etc.)

---

## 8. Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `data/mods/anatomy/components/can_grab.component.json` | Grabbing capability component |
| `data/mods/anatomy/components/requires_grabbing.component.json` | Item handling requirements |
| `data/schemas/operations/lockGrabbing.schema.json` | Lock operation schema |
| `data/schemas/operations/unlockGrabbing.schema.json` | Unlock operation schema |
| `src/logic/operationHandlers/lockGrabbingHandler.js` | Lock handler |
| `src/logic/operationHandlers/unlockGrabbingHandler.js` | Unlock handler |
| `src/logic/operators/hasFreeGrabbingAppendagesOperator.js` | Count operator |
| `src/utils/grabbingUtils.js` | Utility functions |
| `data/mods/anatomy/conditions/actor-has-free-hands.condition.json` | Condition |
| `data/mods/anatomy/conditions/actor-can-wield-item.condition.json` | Condition |

### Modified Files
| File | Change |
|------|--------|
| `data/mods/anatomy/entities/definitions/human_hand.entity.json` | Add `can_grab` |
| `data/mods/anatomy/entities/definitions/squid_tentacle.entity.json` | Add `can_grab` |
| `data/mods/fantasy/entities/definitions/vespera_*.entity.json` | Add `requires_grabbing` |
| `data/mods/weapons/actions/wield_threateningly.action.json` | Add prerequisites |
| `src/logic/jsonLogicCustomOperators.js` | Register new operator |
| `src/dependencyInjection/tokens/tokens-core.js` | Add handler tokens |
| `src/dependencyInjection/registrations/operationHandlerRegistrations.js` | Register handlers |
| `src/dependencyInjection/registrations/interpreterRegistrations.js` | Map operations |
| `src/utils/preValidationUtils.js` | Add operation types to whitelist |
| `data/schemas/operation.schema.json` | Add schema references |

---

## 9. Open Questions

1. **How do we handle items being forcibly removed?** (e.g., disarmed)
   - Should unlock the appropriate appendages
   - Need event listener or direct handler call

2. **What about actions that temporarily use hands but don't "hold" anything?**
   - Example: Climbing (uses both hands temporarily)
   - Could use the same lock system with a virtual "activity" instead of item

3. **How to handle sheathing/holstering?**
   - Sheathed weapon shouldn't occupy hands
   - Need separate "equipped but not wielded" state
   - Might need `items:sheathed` component or similar

---

## 10. Summary

This design extends the existing POSIX-style lock pattern to support **countable appendage locks**. The key additions are:

1. **`anatomy:can_grab`** - Boolean lock on body parts that can grab (with `heldItemId` tracking and `gripStrength`)
2. **`anatomy:requires_grabbing`** - Numeric requirement on items (with optional `minGripStrength`)
3. **`LOCK_GRABBING` / `UNLOCK_GRABBING`** - Operations with count parameter
4. **`hasFreeGrabbingAppendages`** - Operator for prerequisite checks

This maintains consistency with existing patterns (`mouth_engagement`, `movement`) while adding the counting capability needed for multi-appendage scenarios.
