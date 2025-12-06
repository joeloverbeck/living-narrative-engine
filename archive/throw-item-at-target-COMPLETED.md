# Throw Item at Target - Feature Specification

## Overview

This specification defines a new **ranged attack action** that allows actors to throw portable items at targets. The action will be a **non-deterministic** (chance-based) action with four possible outcomes: CRITICAL_SUCCESS, SUCCESS, FAILURE, and FUMBLE.

## Requirements Summary

| Aspect               | Requirement                                                  |
| -------------------- | ------------------------------------------------------------ |
| **Mod**              | New `ranged` mod                                             |
| **Action ID**        | `ranged:throw_item_at_target`                                |
| **Template**         | `throw {throwable} at {target} ({chance}% chance)`           |
| **Primary Target**   | Throwable items (wielded OR inventory with `items:portable`) |
| **Secondary Target** | Actors in location (`core:actors_in_location`)               |
| **Skill**            | `skills:ranged_skill` vs `skills:defense_skill`              |
| **Damage Source**    | `GET_DAMAGE_CAPABILITIES` operation handler                  |

---

## 1. New Mod: `ranged`

### 1.1 Mod Manifest

**File**: `data/mods/ranged/mod-manifest.json`

```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "ranged",
  "version": "1.0.0",
  "name": "Ranged Combat",
  "description": "Ranged combat actions including throwing items at targets",
  "dependencies": ["core", "items", "skills", "damage-types", "positioning"]
}
```

---

## 2. New Scope: `ranged:throwable_items`

### 2.1 Scope Definition

**File**: `data/mods/ranged/scopes/throwable_items.scope`

```
// Scope: ranged:throwable_items
// Description: Returns all portable items that can be thrown - both wielded items AND non-wielded inventory items
// Pattern: Union of wielded items and inventory items, filtered by items:portable component

ranged:throwable_items := actor.components.positioning:wielding.wielded_item_ids[][{"has_component": ["items:portable"]}] | actor.components.items:inventory.items[][{"has_component": ["items:portable"]}]
```

**Rationale**:

- Union (`|`) combines wielded items AND inventory items
- Filter `{"has_component": ["items:portable"]}` ensures only portable items are included
- All weapons have `items:portable`, so they're automatically included
- Regular inventory items with `items:portable` are also included

---

## 3. Action Definition

### 3.1 Action JSON

**File**: `data/mods/ranged/actions/throw_item_at_target.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "ranged:throw_item_at_target",
  "name": "Throw at Target",
  "description": "Throw a portable item at a target",
  "template": "throw {throwable} at {target} ({chance}% chance)",
  "generateCombinations": true,
  "required_components": {
    "actor": [],
    "primary": ["items:portable"]
  },
  "forbidden_components": {
    "actor": [
      "positioning:hugging",
      "positioning:giving_blowjob",
      "positioning:doing_complex_performance",
      "positioning:bending_over",
      "positioning:being_restrained",
      "positioning:restraining",
      "positioning:fallen"
    ]
  },
  "targets": {
    "primary": {
      "scope": "ranged:throwable_items",
      "placeholder": "throwable",
      "description": "Item to throw"
    },
    "secondary": {
      "scope": "core:actors_in_location",
      "placeholder": "target",
      "description": "Target to throw at"
    }
  },
  "chanceBased": {
    "enabled": true,
    "contestType": "opposed",
    "actorSkill": {
      "component": "skills:ranged_skill",
      "property": "value",
      "default": 10
    },
    "targetSkill": {
      "component": "skills:defense_skill",
      "property": "value",
      "default": 0,
      "targetRole": "secondary"
    },
    "formula": "ratio",
    "bounds": {
      "min": 5,
      "max": 95
    },
    "outcomes": {
      "criticalSuccessThreshold": 5,
      "criticalFailureThreshold": 95
    }
  }
}
```

**Key Differences from Melee Actions**:

- `required_components.actor`: Empty (no wielding requirement)
- `required_components.primary`: Only `items:portable` (not `weapons:weapon` or `damage-types:damage_capabilities`)
- `actorSkill.component`: `skills:ranged_skill` (not `skills:melee_skill`)

---

## 4. Condition Definition

### 4.1 Event Condition

**File**: `data/mods/ranged/conditions/event-is-action-throw-item-at-target.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "ranged:event-is-action-throw-item-at-target",
  "description": "Checks if the current event is a throw_item_at_target action",
  "rule": {
    "==": [{ "var": "event.payload.actionId" }, "ranged:throw_item_at_target"]
  }
}
```

---

## 5. New Operation Handler: `PICK_RANDOM_ENTITY`

### 5.1 Purpose

The FUMBLE outcome requires picking a random entity from the location that is:

- NOT the acting actor
- NOT the intended target
- Preferably a non-actor entity (furniture, items on ground)
- Falls back to "miss by a long shot" if no candidates exist

### 5.2 Operation Schema

**File**: `data/schemas/operations/pickRandomEntity.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/pickRandomEntity.schema.json",
  "title": "PICK_RANDOM_ENTITY Operation",
  "description": "Picks a random entity from a location with optional exclusions and component filters",
  "allOf": [
    { "$ref": "../base-operation.schema.json" },
    {
      "type": "object",
      "properties": {
        "type": {
          "const": "PICK_RANDOM_ENTITY"
        },
        "parameters": {
          "type": "object",
          "properties": {
            "location_id": {
              "description": "Location to search for entities",
              "oneOf": [{ "type": "string" }, { "type": "object" }]
            },
            "exclude_entities": {
              "description": "Array of entity IDs to exclude from selection",
              "type": "array",
              "items": {
                "oneOf": [{ "type": "string" }, { "type": "object" }]
              },
              "default": []
            },
            "require_components": {
              "description": "Entity must have ALL these components",
              "type": "array",
              "items": { "type": "string" },
              "default": []
            },
            "exclude_components": {
              "description": "Entity must NOT have ANY of these components",
              "type": "array",
              "items": { "type": "string" },
              "default": []
            },
            "result_variable": {
              "description": "Variable name to store the selected entity ID (or null if none)",
              "type": "string"
            }
          },
          "required": ["location_id", "result_variable"],
          "additionalProperties": false
        }
      }
    }
  ]
}
```

### 5.3 Handler Implementation

**File**: `src/logic/operationHandlers/pickRandomEntityHandler.js`

**Behavior**:

1. Get all entities at `location_id` via `entityManager.getEntitiesInLocation()`
2. Filter out entities in `exclude_entities`
3. Filter for entities having ALL `require_components`
4. Filter out entities having ANY `exclude_components`
5. If candidates remain: pick one at random and store in `result_variable`
6. If no candidates: store `null` in `result_variable`

**Registration Requirements**:

1. **Token**: Add `PickRandomEntityHandler: 'PickRandomEntityHandler'` to `src/dependencyInjection/tokens/tokens-core.js`
2. **Handler Factory**: Add factory to `src/dependencyInjection/registrations/operationHandlerRegistrations.js`
3. **Interpreter Mapping**: Add `registry.register('PICK_RANDOM_ENTITY', bind(tokens.PickRandomEntityHandler))` to `src/dependencyInjection/registrations/interpreterRegistrations.js`
4. **Pre-validation**: Add `'PICK_RANDOM_ENTITY'` to `KNOWN_OPERATION_TYPES` in `src/utils/preValidationUtils.js`
5. **Schema Reference**: Add `$ref` to `data/schemas/operation.schema.json`

---

## 6. Rule Definition

### 6.1 Rule JSON

**File**: `data/mods/ranged/rules/handle_throw_item_at_target.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_throw_item_at_target",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "ranged:event-is-action-throw-item-at-target"
  },
  "actions": [
    {
      "type": "GET_NAME",
      "parameters": { "entity_ref": "actor", "result_variable": "actorName" }
    },
    {
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "secondary",
        "result_variable": "targetName"
      }
    },
    {
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "primary",
        "result_variable": "throwableName"
      }
    },
    {
      "type": "QUERY_COMPONENT",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "core:position",
        "result_variable": "actorPosition"
      }
    },
    {
      "type": "GET_DAMAGE_CAPABILITIES",
      "comment": "Gets damage capabilities if present, otherwise calculates blunt damage from weight",
      "parameters": {
        "entity_ref": "primary",
        "output_variable": "throwableDamage"
      }
    },
    {
      "type": "RESOLVE_OUTCOME",
      "parameters": {
        "actor_skill_component": "skills:ranged_skill",
        "target_skill_component": "skills:defense_skill",
        "actor_skill_default": 10,
        "target_skill_default": 0,
        "formula": "ratio",
        "result_variable": "attackResult"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "locationId",
        "value": "{context.actorPosition.locationId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "perceptionType",
        "value": "action_target_general"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "targetId",
        "value": "{event.payload.secondaryId}"
      }
    },
    {
      "type": "IF",
      "comment": "Handle CRITICAL_SUCCESS outcome",
      "parameters": {
        "condition": {
          "==": [{ "var": "context.attackResult.outcome" }, "CRITICAL_SUCCESS"]
        },
        "then_actions": [{ "macro": "ranged:handleThrowCritical" }]
      }
    },
    {
      "type": "IF",
      "comment": "Handle SUCCESS outcome",
      "parameters": {
        "condition": {
          "==": [{ "var": "context.attackResult.outcome" }, "SUCCESS"]
        },
        "then_actions": [{ "macro": "ranged:handleThrowHit" }]
      }
    },
    {
      "type": "IF",
      "comment": "Handle FUMBLE outcome",
      "parameters": {
        "condition": {
          "==": [{ "var": "context.attackResult.outcome" }, "FUMBLE"]
        },
        "then_actions": [{ "macro": "ranged:handleThrowFumble" }]
      }
    },
    {
      "type": "IF",
      "comment": "Handle FAILURE outcome",
      "parameters": {
        "condition": {
          "==": [{ "var": "context.attackResult.outcome" }, "FAILURE"]
        },
        "then_actions": [{ "macro": "ranged:handleThrowMiss" }]
      }
    }
  ]
}
```

**Key Differences from Melee Rules**:

- Uses `GET_DAMAGE_CAPABILITIES` instead of `QUERY_COMPONENT` for damage
- Uses `skills:ranged_skill` instead of `skills:melee_skill`
- References `ranged:` macros instead of `weapons:` macros

---

## 7. Macro Definitions

### 7.1 Critical Success Macro

**File**: `data/mods/ranged/macros/handleThrowCritical.macro.json`

```json
{
  "$schema": "schema://living-narrative-engine/macro.schema.json",
  "id": "ranged:handleThrowCritical",
  "description": "Handles CRITICAL_SUCCESS outcome for thrown item attacks with 1.5x damage multiplier. Drops the thrown item.",
  "actions": [
    {
      "type": "UNWIELD_ITEM",
      "comment": "If item was wielded, unwield it first (idempotent)",
      "parameters": {
        "actorEntity": "{event.payload.actorId}",
        "itemEntity": "{event.payload.primaryId}"
      }
    },
    {
      "type": "DROP_ITEM_AT_LOCATION",
      "comment": "Thrown item lands at location",
      "parameters": {
        "actorEntity": "{event.payload.actorId}",
        "itemEntity": "{event.payload.primaryId}",
        "locationId": "{context.actorPosition.locationId}"
      }
    },
    {
      "type": "DISPATCH_PERCEPTIBLE_EVENT",
      "parameters": {
        "location_id": "{context.actorPosition.locationId}",
        "description_text": "{context.actorName} throws {context.throwableName} at {context.targetName}, and it lands a devastating blow!",
        "perception_type": "action_target_general",
        "actor_id": "{event.payload.actorId}",
        "target_id": "{event.payload.secondaryId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} throws {context.throwableName} at {context.targetName}, and it lands a devastating blow!"
      }
    },
    {
      "type": "DISPATCH_EVENT",
      "parameters": {
        "eventType": "core:display_successful_action_result",
        "payload": { "message": "{context.logMessage}" }
      }
    },
    {
      "type": "FOR_EACH",
      "parameters": {
        "collection": "context.throwableDamage",
        "item_variable": "dmgEntry",
        "actions": [
          {
            "type": "APPLY_DAMAGE",
            "parameters": {
              "entity_ref": "secondary",
              "damage_entry": { "var": "context.dmgEntry" },
              "damage_multiplier": 1.5
            }
          }
        ]
      }
    },
    {
      "macro": "core:endTurnOnly"
    }
  ]
}
```

### 7.2 Success Macro

**File**: `data/mods/ranged/macros/handleThrowHit.macro.json`

```json
{
  "$schema": "schema://living-narrative-engine/macro.schema.json",
  "id": "ranged:handleThrowHit",
  "description": "Handles SUCCESS outcome for thrown item attacks with normal damage. Drops the thrown item.",
  "actions": [
    {
      "type": "UNWIELD_ITEM",
      "comment": "If item was wielded, unwield it first (idempotent)",
      "parameters": {
        "actorEntity": "{event.payload.actorId}",
        "itemEntity": "{event.payload.primaryId}"
      }
    },
    {
      "type": "DROP_ITEM_AT_LOCATION",
      "comment": "Thrown item lands at location",
      "parameters": {
        "actorEntity": "{event.payload.actorId}",
        "itemEntity": "{event.payload.primaryId}",
        "locationId": "{context.actorPosition.locationId}"
      }
    },
    {
      "type": "DISPATCH_PERCEPTIBLE_EVENT",
      "parameters": {
        "location_id": "{context.actorPosition.locationId}",
        "description_text": "{context.actorName} throws {context.throwableName} at {context.targetName}, and it hits the target.",
        "perception_type": "action_target_general",
        "actor_id": "{event.payload.actorId}",
        "target_id": "{event.payload.secondaryId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} throws {context.throwableName} at {context.targetName}, and it hits the target."
      }
    },
    {
      "type": "DISPATCH_EVENT",
      "parameters": {
        "eventType": "core:display_successful_action_result",
        "payload": { "message": "{context.logMessage}" }
      }
    },
    {
      "type": "FOR_EACH",
      "parameters": {
        "collection": "context.throwableDamage",
        "item_variable": "dmgEntry",
        "actions": [
          {
            "type": "APPLY_DAMAGE",
            "parameters": {
              "entity_ref": "secondary",
              "damage_entry": { "var": "context.dmgEntry" }
            }
          }
        ]
      }
    },
    {
      "macro": "core:endTurnOnly"
    }
  ]
}
```

### 7.3 Failure (Miss) Macro

**File**: `data/mods/ranged/macros/handleThrowMiss.macro.json`

```json
{
  "$schema": "schema://living-narrative-engine/macro.schema.json",
  "id": "ranged:handleThrowMiss",
  "description": "Handles FAILURE outcome for thrown item attacks - misses target, item is dropped.",
  "actions": [
    {
      "type": "UNWIELD_ITEM",
      "comment": "If item was wielded, unwield it first (idempotent)",
      "parameters": {
        "actorEntity": "{event.payload.actorId}",
        "itemEntity": "{event.payload.primaryId}"
      }
    },
    {
      "type": "DROP_ITEM_AT_LOCATION",
      "comment": "Thrown item lands at location",
      "parameters": {
        "actorEntity": "{event.payload.actorId}",
        "itemEntity": "{event.payload.primaryId}",
        "locationId": "{context.actorPosition.locationId}"
      }
    },
    {
      "type": "DISPATCH_PERCEPTIBLE_EVENT",
      "parameters": {
        "location_id": "{context.actorPosition.locationId}",
        "description_text": "{context.actorName} throws {context.throwableName} at {context.targetName}, but the {context.throwableName} flies past the target.",
        "perception_type": "action_target_general",
        "actor_id": "{event.payload.actorId}",
        "target_id": "{event.payload.secondaryId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} throws {context.throwableName} at {context.targetName}, but the {context.throwableName} flies past the target."
      }
    },
    {
      "macro": "core:logFailureOutcomeAndEndTurn"
    }
  ]
}
```

### 7.4 Fumble Macro

**File**: `data/mods/ranged/macros/handleThrowFumble.macro.json`

This macro handles the special FUMBLE case where the thrown item might hit an unintended entity:

```json
{
  "$schema": "schema://living-narrative-engine/macro.schema.json",
  "id": "ranged:handleThrowFumble",
  "description": "Handles FUMBLE outcome for thrown item attacks - may hit unintended target or miss completely.",
  "actions": [
    {
      "type": "UNWIELD_ITEM",
      "comment": "If item was wielded, unwield it first (idempotent)",
      "parameters": {
        "actorEntity": "{event.payload.actorId}",
        "itemEntity": "{event.payload.primaryId}"
      }
    },
    {
      "type": "DROP_ITEM_AT_LOCATION",
      "comment": "Thrown item lands at location",
      "parameters": {
        "actorEntity": "{event.payload.actorId}",
        "itemEntity": "{event.payload.primaryId}",
        "locationId": "{context.actorPosition.locationId}"
      }
    },
    {
      "type": "PICK_RANDOM_ENTITY",
      "comment": "Try to find a random non-actor entity at location (excluding actor and target)",
      "parameters": {
        "location_id": "{context.actorPosition.locationId}",
        "exclude_entities": [
          "{event.payload.actorId}",
          "{event.payload.secondaryId}"
        ],
        "exclude_components": ["core:actor"],
        "result_variable": "fumbleVictim"
      }
    },
    {
      "type": "IF",
      "comment": "If we found a non-actor entity to hit",
      "parameters": {
        "condition": { "!!": { "var": "context.fumbleVictim" } },
        "then_actions": [
          {
            "type": "GET_NAME",
            "parameters": {
              "entity_ref": { "var": "context.fumbleVictim" },
              "result_variable": "fumbleVictimName"
            }
          },
          {
            "type": "DISPATCH_PERCEPTIBLE_EVENT",
            "parameters": {
              "location_id": "{context.actorPosition.locationId}",
              "description_text": "{context.actorName} throws {context.throwableName} wildly at {context.targetName}, but the {context.throwableName} flies past the target and hits {context.fumbleVictimName} instead!",
              "perception_type": "action_target_general",
              "actor_id": "{event.payload.actorId}",
              "target_id": "{event.payload.secondaryId}"
            }
          },
          {
            "type": "SET_VARIABLE",
            "parameters": {
              "variable_name": "logMessage",
              "value": "{context.actorName} throws {context.throwableName} wildly at {context.targetName}, but the {context.throwableName} flies past the target and hits {context.fumbleVictimName} instead!"
            }
          }
        ],
        "else_actions": [
          {
            "type": "DISPATCH_PERCEPTIBLE_EVENT",
            "comment": "No entity to hit - complete miss",
            "parameters": {
              "location_id": "{context.actorPosition.locationId}",
              "description_text": "{context.actorName} throws {context.throwableName} wildly at {context.targetName}, but the throw misses by a long shot!",
              "perception_type": "action_target_general",
              "actor_id": "{event.payload.actorId}",
              "target_id": "{event.payload.secondaryId}"
            }
          },
          {
            "type": "SET_VARIABLE",
            "parameters": {
              "variable_name": "logMessage",
              "value": "{context.actorName} throws {context.throwableName} wildly at {context.targetName}, but the throw misses by a long shot!"
            }
          }
        ]
      }
    },
    {
      "macro": "core:logFailureOutcomeAndEndTurn"
    }
  ]
}
```

**FUMBLE Behavior**:

1. Item is always dropped (unwielded then dropped)
2. Attempts to find a random non-actor entity at the location (furniture, items on ground, etc.)
3. If found: Message indicates item hit that entity (no damage to inanimate objects)
4. If not found: Message indicates "miss by a long shot"

---

## 8. Testing Requirements

### 8.1 Action Discovery Tests

**File**: `tests/integration/mods/ranged/throw_item_at_target_action_discovery.test.js`

Tests should cover:

1. Action has correct ID (`ranged:throw_item_at_target`)
2. Action has correct template (`throw {throwable} at {target} ({chance}% chance)`)
3. Action has no required actor components
4. Action requires `items:portable` on primary target
5. Action has correct forbidden components (same as melee actions)
6. Primary scope uses `ranged:throwable_items`
7. Secondary scope uses `core:actors_in_location`
8. ChanceBased configuration uses `skills:ranged_skill`
9. Action is discoverable when actor has portable item in inventory
10. Action is discoverable when actor has portable item wielded
11. Action is NOT discoverable when actor has no portable items
12. Action is NOT discoverable when actor has forbidden component

### 8.2 Rule Execution Tests

**File**: `tests/integration/mods/ranged/throw_item_at_target_rule_execution.test.js`

Tests should cover:

1. **CRITICAL_SUCCESS outcome**:
   - Item is removed from inventory/wielded
   - Item is placed at location
   - Target receives damage with 1.5x multiplier
   - Correct message displayed

2. **SUCCESS outcome**:
   - Item is removed from inventory/wielded
   - Item is placed at location
   - Target receives damage with 1.0x multiplier
   - Correct message displayed

3. **FAILURE outcome**:
   - Item is removed from inventory/wielded
   - Item is placed at location
   - No damage applied
   - Correct message displayed

4. **FUMBLE outcome with collateral entity**:
   - Item is removed from inventory/wielded
   - Item is placed at location
   - Random entity is selected and named
   - Message references the collateral entity
   - No damage applied (non-actor target)

5. **FUMBLE outcome without collateral entity**:
   - Item is removed from inventory/wielded
   - Item is placed at location
   - "Miss by a long shot" message displayed

6. **Damage calculation**:
   - Weapon with damage_capabilities uses those values
   - Item without damage_capabilities uses weight-based blunt damage

### 8.3 Operation Handler Tests

**File**: `tests/unit/logic/operationHandlers/pickRandomEntityHandler.test.js`

Tests should cover:

1. Returns random entity from location
2. Excludes specified entities
3. Filters by required components
4. Excludes entities with specified components
5. Returns null when no candidates match
6. Handles empty location
7. Handles invalid location_id
8. Stores result in correct context variable

---

## 9. File Summary

### New Files to Create

| File                                                                              | Type      | Description              |
| --------------------------------------------------------------------------------- | --------- | ------------------------ |
| `data/mods/ranged/mod-manifest.json`                                              | Config    | Mod manifest             |
| `data/mods/ranged/scopes/throwable_items.scope`                                   | Scope     | Union of throwable items |
| `data/mods/ranged/actions/throw_item_at_target.action.json`                       | Action    | Main action definition   |
| `data/mods/ranged/conditions/event-is-action-throw-item-at-target.condition.json` | Condition | Event condition          |
| `data/mods/ranged/rules/handle_throw_item_at_target.rule.json`                    | Rule      | Main rule handler        |
| `data/mods/ranged/macros/handleThrowCritical.macro.json`                          | Macro     | Critical success handler |
| `data/mods/ranged/macros/handleThrowHit.macro.json`                               | Macro     | Success handler          |
| `data/mods/ranged/macros/handleThrowMiss.macro.json`                              | Macro     | Failure handler          |
| `data/mods/ranged/macros/handleThrowFumble.macro.json`                            | Macro     | Fumble handler           |
| `data/schemas/operations/pickRandomEntity.schema.json`                            | Schema    | Operation schema         |
| `src/logic/operationHandlers/pickRandomEntityHandler.js`                          | Handler   | Operation handler        |
| `tests/integration/mods/ranged/throw_item_at_target_action_discovery.test.js`     | Test      | Action discovery tests   |
| `tests/integration/mods/ranged/throw_item_at_target_rule_execution.test.js`       | Test      | Rule execution tests     |
| `tests/unit/logic/operationHandlers/pickRandomEntityHandler.test.js`              | Test      | Handler unit tests       |

### Files to Modify

| File                                                                     | Modification                            |
| ------------------------------------------------------------------------ | --------------------------------------- |
| `src/dependencyInjection/tokens/tokens-core.js`                          | Add `PickRandomEntityHandler` token     |
| `src/dependencyInjection/registrations/operationHandlerRegistrations.js` | Add handler factory                     |
| `src/dependencyInjection/registrations/interpreterRegistrations.js`      | Add operation mapping                   |
| `src/utils/preValidationUtils.js`                                        | Add `'PICK_RANDOM_ENTITY'` to whitelist |
| `data/schemas/operation.schema.json`                                     | Add `$ref` to pickRandomEntity schema   |
| `data/game.json`                                                         | Add `"ranged"` to mods array            |

---

## 10. Reference Files

### Melee Attack Patterns

- `data/mods/weapons/actions/swing_at_target.action.json` - Action structure
- `data/mods/weapons/rules/handle_swing_at_target.rule.json` - Rule structure
- `data/mods/weapons/macros/handleMeleeCritical.macro.json` - Critical macro pattern
- `data/mods/weapons/macros/handleMeleeFumble.macro.json` - Fumble macro pattern

### Drop Item Patterns

- `data/mods/items/rules/handle_drop_item.rule.json` - Item dropping pattern
- `data/mods/items/scopes/wielded_items.scope` - Wielded items scope
- `data/mods/items/scopes/non_wielded_inventory_items.scope` - Inventory items scope

### Damage System

- `src/logic/operationHandlers/getDamageCapabilitiesHandler.js` - Damage calculation
- `data/schemas/operations/getDamageCapabilities.schema.json` - Operation schema

### Testing Patterns

- `tests/integration/mods/weapons/swing_at_target_action_discovery.test.js` - Action test pattern
- `tests/integration/mods/weapons/swingAtTargetOutcomeResolution.test.js` - Outcome test pattern
