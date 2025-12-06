# Specification: thrust_at_target Action

## Overview

Create a new combat action `weapons:thrust_at_target` that enables actors to thrust piercing weapons at targets. This action complements the existing `weapons:swing_at_target` action by providing an attack type optimized for piercing damage rather than slashing damage.

## Reference Implementation

This specification is based on the existing `swing_at_target` action implementation:

| Reference File       | Path                                                                          |
| -------------------- | ----------------------------------------------------------------------------- |
| Action Definition    | `data/mods/weapons/actions/swing_at_target.action.json`                       |
| Rule Definition      | `data/mods/weapons/rules/handle_swing_at_target.rule.json`                    |
| Scope Definition     | `data/mods/weapons/scopes/wielded_cutting_weapons.scope`                      |
| Condition Definition | `data/mods/weapons/conditions/event-is-action-swing-at-target.condition.json` |

---

## Files to Create

### 1. Action Definition

**File**: `data/mods/weapons/actions/thrust_at_target.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "weapons:thrust_at_target",
  "name": "Thrust at Target",
  "description": "Thrust a piercing weapon at a target",
  "template": "thrust {weapon} at {target} ({chance}% chance)",
  "generateCombinations": true,
  "required_components": {
    "actor": ["positioning:wielding"],
    "primary": ["weapons:weapon", "damage-types:damage_capabilities"]
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
      "scope": "weapons:wielded_piercing_weapons",
      "placeholder": "weapon",
      "description": "Weapon to thrust"
    },
    "secondary": {
      "scope": "core:actors_in_location",
      "placeholder": "target",
      "description": "Target to attack"
    }
  },
  "chanceBased": {
    "enabled": true,
    "contestType": "opposed",
    "actorSkill": {
      "component": "skills:melee_skill",
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

**Key Differences from swing_at_target:**

- `id`: `"weapons:thrust_at_target"` (not `swing_at_target`)
- `name`: `"Thrust at Target"`
- `description`: `"Thrust a piercing weapon at a target"`
- `template`: `"thrust {weapon} at {target} ({chance}% chance)"`
- `targets.primary.scope`: `"weapons:wielded_piercing_weapons"` (new scope)
- `targets.primary.description`: `"Weapon to thrust"`

---

### 2. Scope Definition

**File**: `data/mods/weapons/scopes/wielded_piercing_weapons.scope`

```
// Scope: weapons:wielded_piercing_weapons
// Description: Returns wielded weapons with piercing damage capability
// Usage: Primary target scope for thrust_at_target action

weapons:wielded_piercing_weapons := actor.components.positioning:wielding.wielded_item_ids[][{
  "and": [
    { "has_component": [".", "weapons:weapon"] },
    { "has_component": [".", "damage-types:damage_capabilities"] },
    { "has_damage_capability": [".", "piercing"] }
  ]
}]
```

**Key Difference from wielded_cutting_weapons.scope:**

- `has_damage_capability`: `"piercing"` instead of `"slashing"`

**Example Weapons with Piercing Damage:**

- `fantasy:vespera_main_gauche` (piercing: 10 damage, 0.8 penetration)
- `fantasy:vespera_rapier` (piercing: 18 damage, 0.6 penetration + slashing: 8 damage)

---

### 3. Condition Definition

**File**: `data/mods/weapons/conditions/event-is-action-thrust-at-target.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "weapons:event-is-action-thrust-at-target",
  "description": "Checks if the event is a thrust_at_target action attempt",
  "logic": {
    "==": [{ "var": "event.payload.actionId" }, "weapons:thrust_at_target"]
  }
}
```

---

### 4. Rule Definition

**File**: `data/mods/weapons/rules/handle_thrust_at_target.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_thrust_at_target",
  "event_type": "core:attempt_action",
  "condition": { "condition_ref": "weapons:event-is-action-thrust-at-target" },
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
      "parameters": { "entity_ref": "primary", "result_variable": "weaponName" }
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
      "type": "QUERY_COMPONENT",
      "parameters": {
        "entity_ref": "primary",
        "component_type": "damage-types:damage_capabilities",
        "result_variable": "weaponDamage"
      }
    },
    {
      "type": "RESOLVE_OUTCOME",
      "parameters": {
        "actor_skill_component": "skills:melee_skill",
        "target_skill_component": "skills:defense_skill",
        "actor_skill_default": 10,
        "target_skill_default": 0,
        "formula": "ratio",
        "result_variable": "attackResult"
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Set common variables needed by the end-turn macro",
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
      "comment": "Handle CRITICAL_SUCCESS outcome - flat structure (1 of 4)",
      "parameters": {
        "condition": {
          "==": [{ "var": "context.attackResult.outcome" }, "CRITICAL_SUCCESS"]
        },
        "then_actions": [
          {
            "type": "DISPATCH_PERCEPTIBLE_EVENT",
            "parameters": {
              "location_id": "{context.actorPosition.locationId}",
              "description_text": "{context.actorName} lands a devastating thrust with their {context.weaponName} on {context.targetName}!",
              "perception_type": "action_target_general",
              "actor_id": "{event.payload.actorId}",
              "target_id": "{event.payload.secondaryId}"
            }
          },
          {
            "type": "SET_VARIABLE",
            "comment": "Set logMessage BEFORE damage loop so success message displays first",
            "parameters": {
              "variable_name": "logMessage",
              "value": "{context.actorName} lands a devastating thrust with their {context.weaponName} on {context.targetName}!"
            }
          },
          {
            "type": "DISPATCH_EVENT",
            "comment": "Display success message BEFORE damage details (which are deferred via queueMicrotask)",
            "parameters": {
              "eventType": "core:display_successful_action_result",
              "payload": { "message": "{context.logMessage}" }
            }
          },
          {
            "type": "FOR_EACH",
            "parameters": {
              "collection": "context.weaponDamage.entries",
              "item_variable": "dmgEntry",
              "actions": [
                {
                  "type": "APPLY_DAMAGE",
                  "parameters": {
                    "entity_ref": "secondary",
                    "damage_entry": { "var": "context.dmgEntry" },
                    "damage_multiplier": 1.5,
                    "exclude_damage_types": ["slashing"]
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
    },
    {
      "type": "IF",
      "comment": "Handle SUCCESS outcome - flat structure (2 of 4)",
      "parameters": {
        "condition": {
          "==": [{ "var": "context.attackResult.outcome" }, "SUCCESS"]
        },
        "then_actions": [
          {
            "type": "DISPATCH_PERCEPTIBLE_EVENT",
            "parameters": {
              "location_id": "{context.actorPosition.locationId}",
              "description_text": "{context.actorName} thrusts their {context.weaponName} at {context.targetName}, piercing their flesh.",
              "perception_type": "action_target_general",
              "actor_id": "{event.payload.actorId}",
              "target_id": "{event.payload.secondaryId}"
            }
          },
          {
            "type": "SET_VARIABLE",
            "comment": "Set logMessage BEFORE damage loop so success message displays first",
            "parameters": {
              "variable_name": "logMessage",
              "value": "{context.actorName} thrusts their {context.weaponName} at {context.targetName}, piercing their flesh."
            }
          },
          {
            "type": "DISPATCH_EVENT",
            "comment": "Display success message BEFORE damage details (which are deferred via queueMicrotask)",
            "parameters": {
              "eventType": "core:display_successful_action_result",
              "payload": { "message": "{context.logMessage}" }
            }
          },
          {
            "type": "FOR_EACH",
            "parameters": {
              "collection": "context.weaponDamage.entries",
              "item_variable": "dmgEntry",
              "actions": [
                {
                  "type": "APPLY_DAMAGE",
                  "parameters": {
                    "entity_ref": "secondary",
                    "damage_entry": { "var": "context.dmgEntry" },
                    "exclude_damage_types": ["slashing"]
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
    },
    {
      "type": "IF",
      "comment": "Handle FUMBLE outcome - flat structure (3 of 4)",
      "parameters": {
        "condition": {
          "==": [{ "var": "context.attackResult.outcome" }, "FUMBLE"]
        },
        "then_actions": [
          {
            "type": "UNWIELD_ITEM",
            "comment": "Fumble: release grip on weapon (idempotent)",
            "parameters": {
              "actorEntity": "{event.payload.actorId}",
              "itemEntity": "{event.payload.primaryId}"
            }
          },
          {
            "type": "DROP_ITEM_AT_LOCATION",
            "comment": "Fumble: weapon falls to the ground",
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
              "description_text": "{context.actorName} thrusts wildly and loses grip on their {context.weaponName}!",
              "perception_type": "action_target_general",
              "actor_id": "{event.payload.actorId}"
            }
          },
          {
            "type": "SET_VARIABLE",
            "parameters": {
              "variable_name": "logMessage",
              "value": "{context.actorName} thrusts wildly and loses grip on their {context.weaponName}!"
            }
          },
          {
            "macro": "core:logFailureOutcomeAndEndTurn"
          }
        ]
      }
    },
    {
      "type": "IF",
      "comment": "Handle FAILURE outcome - flat structure (4 of 4)",
      "parameters": {
        "condition": {
          "==": [{ "var": "context.attackResult.outcome" }, "FAILURE"]
        },
        "then_actions": [
          {
            "type": "DISPATCH_PERCEPTIBLE_EVENT",
            "parameters": {
              "location_id": "{context.actorPosition.locationId}",
              "description_text": "{context.actorName} thrusts their {context.weaponName} at {context.targetName}, but the thrust fails to connect.",
              "perception_type": "action_target_general",
              "actor_id": "{event.payload.actorId}",
              "target_id": "{event.payload.secondaryId}"
            }
          },
          {
            "type": "SET_VARIABLE",
            "parameters": {
              "variable_name": "logMessage",
              "value": "{context.actorName} thrusts their {context.weaponName} at {context.targetName}, but the thrust fails to connect."
            }
          },
          {
            "macro": "core:logFailureOutcomeAndEndTurn"
          }
        ]
      }
    }
  ]
}
```

**Key Differences from handle_swing_at_target.rule.json:**

| Aspect                                    | swing_at_target                           | thrust_at_target                           |
| ----------------------------------------- | ----------------------------------------- | ------------------------------------------ |
| `rule_id`                                 | `handle_swing_at_target`                  | `handle_thrust_at_target`                  |
| `condition_ref`                           | `weapons:event-is-action-swing-at-target` | `weapons:event-is-action-thrust-at-target` |
| `exclude_damage_types` (all APPLY_DAMAGE) | `["piercing"]`                            | `["slashing"]`                             |
| CRITICAL_SUCCESS message                  | "...lands a devastating blow..."          | "...lands a devastating thrust..."         |
| SUCCESS message                           | "...cutting their flesh."                 | "...piercing their flesh."                 |
| FUMBLE message                            | "...swings wildly..."                     | "...thrusts wildly..."                     |
| FAILURE message                           | "...but the swing fails to connect."      | "...but the thrust fails to connect."      |

---

## Tests to Create

### 1. Action Discovery Test

**File**: `tests/integration/mods/weapons/thrust_at_target_action_discovery.test.js`

**Test Cases to Cover:**

#### Action Structure Validation

- [ ] Action has correct `id`: `"weapons:thrust_at_target"`
- [ ] Action has correct `template`: `"thrust {weapon} at {target} ({chance}% chance)"`
- [ ] Action has `generateCombinations: true`

#### Required Components Validation

- [ ] Actor requires `positioning:wielding`
- [ ] Primary target requires `weapons:weapon`
- [ ] Primary target requires `damage-types:damage_capabilities`

#### Forbidden Components Validation

- [ ] Actor cannot have `positioning:hugging`
- [ ] Actor cannot have `positioning:giving_blowjob`
- [ ] Actor cannot have `positioning:doing_complex_performance`
- [ ] Actor cannot have `positioning:bending_over`
- [ ] Actor cannot have `positioning:being_restrained`
- [ ] Actor cannot have `positioning:restraining`
- [ ] Actor cannot have `positioning:fallen`

#### Target Configuration Validation

- [ ] Primary target scope is `weapons:wielded_piercing_weapons`
- [ ] Primary target placeholder is `weapon`
- [ ] Secondary target scope is `core:actors_in_location`
- [ ] Secondary target placeholder is `target`

#### Chance-Based Configuration Validation

- [ ] `chanceBased.enabled` is `true`
- [ ] `chanceBased.contestType` is `"opposed"`
- [ ] Actor skill uses `skills:melee_skill` with default 10
- [ ] Target skill uses `skills:defense_skill` with default 0
- [ ] Formula is `"ratio"`
- [ ] Bounds are min 5, max 95
- [ ] Critical success threshold is 5
- [ ] Critical failure threshold is 95

#### Action Discoverability

- [ ] Action appears when actor wields a piercing weapon (e.g., main-gauche)
- [ ] Action appears when actor wields a weapon with both piercing and slashing (e.g., rapier)
- [ ] Action does NOT appear when actor wields only a slashing weapon (e.g., longsword)
- [ ] Action does NOT appear when actor is not wielding any weapon
- [ ] Action does NOT appear when actor has any forbidden component

#### Scope Validation

- [ ] `wielded_piercing_weapons` scope returns only weapons with piercing damage
- [ ] Scope correctly filters weapons via `has_damage_capability: "piercing"`

---

### 2. Rule Execution Test

**File**: `tests/integration/mods/weapons/thrust_at_target_action.test.js`

**Test Cases to Cover:**

#### Rule Structure Validation

- [ ] Rule has correct `rule_id`: `"handle_thrust_at_target"`
- [ ] Rule triggers on `event_type`: `"core:attempt_action"`
- [ ] Rule uses correct condition reference

#### Operation Types Validation

- [ ] Rule uses GET_NAME for actor, target, and weapon
- [ ] Rule uses QUERY_COMPONENT for position and damage capabilities
- [ ] Rule uses RESOLVE_OUTCOME for skill contest
- [ ] Rule uses FOR_EACH for damage entry iteration
- [ ] Rule uses APPLY_DAMAGE with correct exclude_damage_types

#### CRITICAL_SUCCESS Outcome (1 of 4)

- [ ] Dispatches perceptible event with message: "{actorName} lands a devastating thrust with their {weaponName} on {targetName}!"
- [ ] Displays successful action result
- [ ] Applies damage with 1.5x multiplier
- [ ] Excludes slashing damage types
- [ ] Ends turn

#### SUCCESS Outcome (2 of 4)

- [ ] Dispatches perceptible event with message: "{actorName} thrusts their {weaponName} at {targetName}, piercing their flesh."
- [ ] Displays successful action result
- [ ] Applies damage without multiplier
- [ ] Excludes slashing damage types
- [ ] Ends turn

#### FUMBLE Outcome (3 of 4)

- [ ] Unwields weapon from actor
- [ ] Drops weapon at actor's location
- [ ] Dispatches perceptible event with message: "{actorName} thrusts wildly and loses grip on their {weaponName}!"
- [ ] Logs failure outcome
- [ ] Ends turn

#### FAILURE Outcome (4 of 4)

- [ ] Dispatches perceptible event with message: "{actorName} thrusts their {weaponName} at {targetName}, but the thrust fails to connect."
- [ ] Does NOT apply any damage
- [ ] Logs failure outcome
- [ ] Ends turn

---

### 3. Damage Application Test

**File**: `tests/integration/mods/weapons/thrustAtTargetDamageApplication.integration.test.js`

**Test Cases to Cover:**

#### Damage Exclusion Behavior

- [ ] On SUCCESS, only piercing damage is applied (slashing excluded)
- [ ] On CRITICAL_SUCCESS, only piercing damage is applied with 1.5x multiplier
- [ ] Using rapier (has both piercing and slashing): only piercing damage applied
- [ ] Using main-gauche (piercing only): full damage applied

#### No Damage on Failure

- [ ] FAILURE outcome applies no damage
- [ ] FUMBLE outcome applies no damage

#### Damage Effects

- [ ] Bleed effect from piercing damage is applied correctly
- [ ] Health state is updated after damage application

---

### 4. E2E Test (Optional but Recommended)

**File**: `tests/e2e/actions/thrustAtTargetFullFlow.e2e.test.js`

**Test Cases to Cover:**

- [ ] Full damage → health update flow
- [ ] Bleed effect application for piercing damage
- [ ] Weapon drop on FUMBLE outcome
- [ ] Critical success 1.5x multiplier verification
- [ ] Using rapier entity with real component data
- [ ] Using main-gauche entity with real component data

---

## Testing Patterns to Follow

Based on `docs/testing/mod-testing-guide.md`:

### Test File Structure

```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import '../../common/mods/domainMatchers.js';

// Import JSON definitions
import thrustAtTargetAction from '../../../../data/mods/weapons/actions/thrust_at_target.action.json';
import handleThrustAtTargetRule from '../../../../data/mods/weapons/rules/handle_thrust_at_target.rule.json';
import eventIsActionThrustAtTarget from '../../../../data/mods/weapons/conditions/event-is-action-thrust-at-target.condition.json';

const ACTION_ID = 'weapons:thrust_at_target';

describe('weapons:thrust_at_target action discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('weapons', ACTION_ID);
    testFixture.testEnv.actionIndex.buildIndex([thrustAtTargetAction]);
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  // Test cases here...
});
```

### Required Matchers

```javascript
import '../../common/mods/domainMatchers.js';

// Use matchers like:
expect(fixture.events).toHaveActionSuccess(message);
expect(fixture.events).toHaveActionFailure();
expect(entity).toHaveComponent('component:id');
expect(actions.map((a) => a.id)).toContain(ACTION_ID);
```

### Scenario Creation

```javascript
// For wielding tests, create actor with weapon
const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

// Add wielding component with piercing weapon
testFixture.entityManager.addComponent(
  scenario.actor.id,
  'positioning:wielding',
  {
    wielded_item_ids: ['fantasy:vespera_main_gauche'],
  }
);

// Register the weapon entity
testFixture.registerEntity(mainGaucheEntity);
```

---

## Implementation Checklist

### Files to Create

- [ ] `data/mods/weapons/actions/thrust_at_target.action.json`
- [ ] `data/mods/weapons/scopes/wielded_piercing_weapons.scope`
- [ ] `data/mods/weapons/conditions/event-is-action-thrust-at-target.condition.json`
- [ ] `data/mods/weapons/rules/handle_thrust_at_target.rule.json`
- [ ] `tests/integration/mods/weapons/thrust_at_target_action_discovery.test.js`
- [ ] `tests/integration/mods/weapons/thrust_at_target_action.test.js`
- [ ] `tests/integration/mods/weapons/thrustAtTargetDamageApplication.integration.test.js`
- [ ] `tests/e2e/actions/thrustAtTargetFullFlow.e2e.test.js` (optional)

### Validation Steps

- [ ] Run `npm run validate` to validate JSON schemas
- [ ] Run `npm run scope:lint` to validate scope DSL
- [ ] Run `npm run test:integration` to verify tests pass
- [ ] Run `npm run typecheck` to verify TypeScript types

---

## Notes

### Design Decisions

1. **Damage Type Exclusion**: A thrust attack excludes slashing damage because thrusting is a stabbing motion that doesn't cut. This is the inverse of swing_at_target which excludes piercing.

2. **Scope Naming**: The new scope `wielded_piercing_weapons` follows the same pattern as `wielded_cutting_weapons` for consistency.

3. **Message Wording**: The failure message says "but the thrust fails to connect" (not "but the swing fails to connect" as mentioned in the user request - this appears to be a typo in the original request, and "thrust" is correct for consistency).

4. **Weapon Compatibility**: The rapier entity (`fantasy:vespera_rapier`) has both piercing (18) and slashing (8) damage. When used with thrust_at_target, only the piercing damage will be applied. This allows the same weapon to be used with both swing_at_target (slashing only) and thrust_at_target (piercing only).

### Test Entity References

- **Piercing-only weapon**: `fantasy:vespera_main_gauche` (10 piercing damage)
- **Piercing + Slashing weapon**: `fantasy:vespera_rapier` (18 piercing + 8 slashing)
- **Slashing-only weapon**: `fantasy:threadscar_melissa_longsword` (22 slashing damage)
