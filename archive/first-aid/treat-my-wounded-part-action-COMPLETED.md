# Specification: treat_my_wounded_part Action

## Overview

Create a self-treatment action for the first-aid mod that allows actors to treat their own wounds. This is the self-targeting counterpart to the existing `treat_wounded_part` action.

## Goal

Enable actors with the `medicine_skill` component to treat their own wounded body parts using the same chance-based mechanics as treating others, but with appropriate messaging for self-treatment.

## Reference Files

### Primary References (patterns to follow)
- `data/mods/first-aid/actions/treat_wounded_part.action.json` - Base action pattern
- `data/mods/first-aid/actions/disinfect_my_wounded_part.action.json` - Self-action pattern
- `data/mods/first-aid/rules/handle_treat_wounded_part.rule.json` - Rule execution pattern
- `data/mods/first-aid/scopes/treatable_target_body_parts.scope` - Scope pattern for treatment

### Existing Scopes
- `first-aid:wounded_actor_body_parts` - Returns accessible wounded body parts on actor (filters for accessibility)
- `first-aid:treatable_target_body_parts` - Returns all wounded body parts on target (no accessibility filter)

## Files to Create

### 1. Action File
**Path**: `data/mods/first-aid/actions/treat_my_wounded_part.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "first-aid:treat_my_wounded_part",
  "name": "Treat My Wounded Part",
  "description": "Treat one of your own wounded body parts using medicine skill.",
  "template": "treat my wound in {woundedBodyPart} ({chance}% chance)",
  "generateCombinations": true,
  "required_components": {
    "actor": ["skills:medicine_skill"]
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
      "scope": "first-aid:treatable_actor_body_parts",
      "placeholder": "woundedBodyPart",
      "description": "Your wounded body part to treat"
    }
  },
  "visual": {
    "backgroundColor": "#1b5e20",
    "textColor": "#e8f5e9",
    "hoverBackgroundColor": "#2e7d32",
    "hoverTextColor": "#ffffff"
  },
  "chanceBased": {
    "enabled": true,
    "contestType": "fixed_difficulty",
    "fixedDifficulty": 50,
    "formula": "linear",
    "actorSkill": {
      "component": "skills:medicine_skill",
      "property": "value",
      "default": 10
    },
    "bounds": {
      "min": 5,
      "max": 95
    },
    "outcomes": {
      "criticalSuccessThreshold": 5,
      "criticalFailureThreshold": 95
    },
    "modifiers": [
      {
        "condition": {
          "logic": {
            "and": [
              { "var": "entity.primary.components.anatomy:visibility_rules.clothingSlotId" },
              { "!": { "isSlotExposed": ["actor", { "var": "entity.primary.components.anatomy:visibility_rules.clothingSlotId" }, ["base", "outer", "armor"]] } }
            ]
          }
        },
        "type": "flat",
        "value": -20,
        "tag": "wound covered",
        "targetRole": "primary"
      },
      {
        "condition": {
          "logic": { "!!": { "var": "entity.primary.components.first-aid:rinsed" } }
        },
        "type": "flat",
        "value": 10,
        "tag": "wound rinsed",
        "targetRole": "primary"
      },
      {
        "condition": {
          "logic": { "!": { "var": "entity.primary.components.first-aid:rinsed" } }
        },
        "type": "flat",
        "value": -10,
        "tag": "wound not rinsed",
        "targetRole": "primary"
      },
      {
        "condition": {
          "logic": { "!!": { "var": "entity.primary.components.first-aid:disinfected" } }
        },
        "type": "flat",
        "value": 10,
        "tag": "wound disinfected",
        "targetRole": "primary"
      },
      {
        "condition": {
          "logic": { "!": { "var": "entity.primary.components.first-aid:disinfected" } }
        },
        "type": "flat",
        "value": -5,
        "tag": "wound not disinfected",
        "targetRole": "primary"
      }
    ]
  }
}
```

**Key Differences from treat_wounded_part**:
- Single target (`primary` only) - the actor's wounded body part
- NO `contextFrom` - scope operates on `actor` entity directly
- Uses new scope `first-aid:treatable_actor_body_parts`
- Modifiers reference `entity.primary` (not `entity.secondary`)
- Modifiers check `actor` for slot exposure (not `entity.primary`)

### 2. Scope File
**Path**: `data/mods/first-aid/scopes/treatable_actor_body_parts.scope`

```dsl
// Returns the acting actor's body part entity IDs that are wounded (health below max).
//
// BEHAVIOR: Iterates actor.body_parts via BodyGraphService#getAllParts and keeps
// parts with an anatomy:part_health component whose currentHealth is lower than
// maxHealth while excluding vital organs.
//
// IMPORTANT: Unlike wounded_actor_body_parts.scope, this scope does NOT filter out
// covered wounds. This allows the action to target covered wounds (with a modifier
// penalty) so that actors can treat their own wounds under clothing.
//
// Usage: Scope for treat_my_wounded_part action targeting actor's own wounds.
// Reference: specs/treat-my-wounded-part-action.md
first-aid:treatable_actor_body_parts := actor.body_parts[][{"and":[
  {"isBodyPartWounded": ["actor", {"var": "entity"}, true]},
  {"!": {"var": "entity.components.anatomy:vital_organ"}}
]}]
```

**Key Differences from treatable_target_body_parts**:
- Uses `actor.body_parts` instead of `target.body_parts`
- First parameter to `isBodyPartWounded` is `"actor"` instead of `"target"`
- Same filtering logic (wounded, non-vital, NO accessibility filter)

### 3. Condition File
**Path**: `data/mods/first-aid/conditions/event-is-action-treat-my-wounded-part.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "first-aid:event-is-action-treat-my-wounded-part",
  "description": "Checks if the triggering event is the treat_my_wounded_part action.",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "first-aid:treat_my_wounded_part"
    ]
  }
}
```

### 4. Rule File
**Path**: `data/mods/first-aid/rules/handle_treat_my_wounded_part.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_treat_my_wounded_part",
  "comment": "Handles the treat_my_wounded_part action with chance-based outcomes (self-treatment).",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "first-aid:event-is-action-treat-my-wounded-part"
  },
  "actions": [
    {
      "type": "GET_NAME",
      "parameters": { "entity_ref": "actor", "result_variable": "actorName" }
    },
    {
      "type": "GET_NAME",
      "parameters": { "entity_ref": "primary", "result_variable": "bodyPartName" }
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
      "type": "RESOLVE_OUTCOME",
      "comment": "Fixed difficulty contest using medicine_skill vs difficulty 50",
      "parameters": {
        "actor_skill_component": "skills:medicine_skill",
        "actor_skill_default": 10,
        "difficulty_modifier": 50,
        "formula": "linear",
        "result_variable": "treatmentResult"
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
        "value": "action_self"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "targetId",
        "value": "{event.payload.actorId}"
      }
    },
    {
      "type": "IF",
      "comment": "Handle CRITICAL_SUCCESS outcome - heal +20 HP",
      "parameters": {
        "condition": {
          "==": [{ "var": "context.treatmentResult.outcome" }, "CRITICAL_SUCCESS"]
        },
        "then_actions": [
          {
            "type": "MODIFY_PART_HEALTH",
            "parameters": {
              "part_entity_ref": "primary",
              "delta": 20,
              "clamp_to_bounds": true
            }
          },
          {
            "type": "REGENERATE_DESCRIPTION",
            "parameters": { "entity_ref": "actor" }
          },
          {
            "type": "REGENERATE_DESCRIPTION",
            "parameters": { "entity_ref": "primary" }
          },
          {
            "type": "SET_VARIABLE",
            "parameters": {
              "variable_name": "logMessage",
              "value": "{context.actorName} expertly treats their own wounded {context.bodyPartName}, achieving remarkable healing results!"
            }
          },
          { "macro": "core:logSuccessOutcomeAndEndTurn" }
        ]
      }
    },
    {
      "type": "IF",
      "comment": "Handle SUCCESS outcome - heal +10 HP",
      "parameters": {
        "condition": {
          "==": [{ "var": "context.treatmentResult.outcome" }, "SUCCESS"]
        },
        "then_actions": [
          {
            "type": "MODIFY_PART_HEALTH",
            "parameters": {
              "part_entity_ref": "primary",
              "delta": 10,
              "clamp_to_bounds": true
            }
          },
          {
            "type": "REGENERATE_DESCRIPTION",
            "parameters": { "entity_ref": "actor" }
          },
          {
            "type": "REGENERATE_DESCRIPTION",
            "parameters": { "entity_ref": "primary" }
          },
          {
            "type": "SET_VARIABLE",
            "parameters": {
              "variable_name": "logMessage",
              "value": "{context.actorName} successfully treats their own wounded {context.bodyPartName}."
            }
          },
          { "macro": "core:logSuccessOutcomeAndEndTurn" }
        ]
      }
    },
    {
      "type": "IF",
      "comment": "Handle FAILURE outcome - no HP change",
      "parameters": {
        "condition": {
          "==": [{ "var": "context.treatmentResult.outcome" }, "FAILURE"]
        },
        "then_actions": [
          {
            "type": "SET_VARIABLE",
            "parameters": {
              "variable_name": "logMessage",
              "value": "{context.actorName} attempts to treat their own wounded {context.bodyPartName} but fails to provide effective care."
            }
          },
          { "macro": "core:logFailureOutcomeAndEndTurn" }
        ]
      }
    },
    {
      "type": "IF",
      "comment": "Handle FUMBLE outcome - deal 10 piercing damage",
      "parameters": {
        "condition": {
          "==": [{ "var": "context.treatmentResult.outcome" }, "FUMBLE"]
        },
        "then_actions": [
          {
            "type": "APPLY_DAMAGE",
            "parameters": {
              "entity_ref": "actor",
              "part_ref": "primary",
              "damage_entry": {
                "amount": 10,
                "type": "piercing"
              }
            }
          },
          {
            "type": "REGENERATE_DESCRIPTION",
            "parameters": { "entity_ref": "actor" }
          },
          {
            "type": "REGENERATE_DESCRIPTION",
            "parameters": { "entity_ref": "primary" }
          },
          {
            "type": "SET_VARIABLE",
            "parameters": {
              "variable_name": "logMessage",
              "value": "{context.actorName} fumbles badly while treating their own wounded {context.bodyPartName}, causing additional injury!"
            }
          },
          { "macro": "core:logFailureOutcomeAndEndTurn" }
        ]
      }
    }
  ]
}
```

**Key Differences from handle_treat_wounded_part**:
- No `targetName` variable (no separate target actor)
- `part_entity_ref` is `"primary"` (not `"secondary"`)
- `REGENERATE_DESCRIPTION` is for `"actor"` (not `"primary"`)
- `APPLY_DAMAGE` `entity_ref` is `"actor"` (not `"primary"`)
- `perceptionType` is `"action_self"` (not `"action_target_general"`)
- `targetId` is `"{event.payload.actorId}"` (actor targets self)
- All messages use "their own" phrasing instead of `{context.targetName}'s`

### 5. Mod Manifest Update
**Path**: `data/mods/first-aid/mod-manifest.json`

Add the following entries:
- `actions`: Add `"actions/treat_my_wounded_part.action.json"`
- `conditions`: Add `"conditions/event-is-action-treat-my-wounded-part.condition.json"`
- `rules`: Add `"rules/handle_treat_my_wounded_part.rule.json"`
- `scopes`: Add `"scopes/treatable_actor_body_parts.scope"`

## Testing Requirements

### Test File: Action Discovery
**Path**: `tests/integration/mods/first-aid/treat_my_wounded_part_action_discovery.test.js`

Test scenarios:
1. **Discoverable when actor has medicine_skill and wounded body part**
   - Setup: Actor with `skills:medicine_skill` and at least one wounded body part
   - Expected: `first-aid:treat_my_wounded_part` appears in available actions

2. **NOT discoverable when actor lacks medicine_skill**
   - Setup: Actor without `skills:medicine_skill` but has wounded body part
   - Expected: Action not in available actions

3. **NOT discoverable when actor has no wounded body parts**
   - Setup: Actor with `skills:medicine_skill` but all body parts at full health
   - Expected: Action not in available actions

4. **NOT discoverable when actor has forbidden component (each one)**
   - Setup: Actor with `skills:medicine_skill`, wounded body part, AND `positioning:hugging`
   - Expected: Action not in available actions
   - Repeat for: `giving_blowjob`, `doing_complex_performance`, `bending_over`, `being_restrained`, `restraining`, `fallen`

5. **Discoverable for covered wounds (no accessibility filter)**
   - Setup: Actor with wounded body part that is covered by clothing
   - Expected: Action still appears (unlike `disinfect_my_wounded_part` which requires accessibility)

6. **Template variables populated correctly**
   - Verify `{woundedBodyPart}` shows body part name
   - Verify `{chance}%` shows calculated chance

### Test File: Rule Execution
**Path**: `tests/integration/mods/first-aid/handle_treat_my_wounded_part_rule.test.js`

Test scenarios:

1. **SUCCESS outcome heals +10 HP**
   - Setup: Actor with wounded body part (5/100 HP)
   - Execute action (mock returns SUCCESS)
   - Expected: Body part health is now 15/100 HP
   - Expected: Success message contains "successfully treats their own wounded"

2. **CRITICAL_SUCCESS outcome heals +20 HP**
   - Validate rule structure has CRITICAL_SUCCESS branch with `delta: 20`
   - Expected message: "{actorName} expertly treats their own wounded {bodyPartName}, achieving remarkable healing results!"

3. **FAILURE outcome causes no HP change**
   - Validate rule structure has FAILURE branch with no MODIFY_PART_HEALTH
   - Expected message: "{actorName} attempts to treat their own wounded {bodyPartName} but fails to provide effective care."

4. **FUMBLE outcome deals 10 piercing damage**
   - Validate rule structure has FUMBLE branch with APPLY_DAMAGE (amount: 10, type: piercing)
   - Expected message: "{actorName} fumbles badly while treating their own wounded {bodyPartName}, causing additional injury!"

5. **REGENERATE_DESCRIPTION called for actor entity**
   - Validate all healing/damage branches call `REGENERATE_DESCRIPTION` with `entity_ref: "actor"`
   - Validate body part description also regenerated (`entity_ref: "primary"`)

6. **Rule structure validation**
   - Has exactly 4 IF conditions for CRITICAL_SUCCESS, SUCCESS, FAILURE, FUMBLE
   - RESOLVE_OUTCOME appears before IF conditions
   - Correct condition_ref to `first-aid:event-is-action-treat-my-wounded-part`
   - Event type is `core:attempt_action`

7. **Modifier application (structure validation)**
   - Action has 5 modifiers with correct targetRole: "primary"
   - Modifiers check actor for slot exposure

### Test Patterns to Follow

```javascript
// Action Discovery Test Pattern
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import '../../common/mods/domainMatchers.js';

const ACTION_ID = 'first-aid:treat_my_wounded_part';

describe('first-aid:treat_my_wounded_part action discovery', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('first-aid', ACTION_ID);
  });

  afterEach(() => {
    fixture?.cleanup();
  });

  it('is discoverable when actor has medicine_skill and wounded body part', () => {
    // Create actor with medicine_skill and wounded body part
    // ...
    const availableActions = fixture.testEnv.getAvailableActions(actorId);
    expect(availableActions.map(a => a.id)).toContain(ACTION_ID);
  });
});
```

```javascript
// Rule Execution Test Pattern
import ruleJson from '../../../../data/mods/first-aid/rules/handle_treat_my_wounded_part.rule.json';
import conditionJson from '../../../../data/mods/first-aid/conditions/event-is-action-treat-my-wounded-part.condition.json';

describe('first-aid:handle_treat_my_wounded_part rule', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'first-aid',
      ACTION_ID,
      ruleJson,
      conditionJson
    );
  });

  it('rule structure has correct IF conditions for all four outcomes', () => {
    const ifOps = ruleJson.actions.filter(a => a.type === 'IF');
    expect(ifOps.length).toBe(4);

    const outcomes = ifOps.map(op => op.parameters.condition['==']?.[1]);
    expect(outcomes).toContain('CRITICAL_SUCCESS');
    expect(outcomes).toContain('SUCCESS');
    expect(outcomes).toContain('FAILURE');
    expect(outcomes).toContain('FUMBLE');
  });
});
```

## Summary of Changes

| File Type | Path | Action |
|-----------|------|--------|
| Action | `data/mods/first-aid/actions/treat_my_wounded_part.action.json` | CREATE |
| Scope | `data/mods/first-aid/scopes/treatable_actor_body_parts.scope` | CREATE |
| Condition | `data/mods/first-aid/conditions/event-is-action-treat-my-wounded-part.condition.json` | CREATE |
| Rule | `data/mods/first-aid/rules/handle_treat_my_wounded_part.rule.json` | CREATE |
| Manifest | `data/mods/first-aid/mod-manifest.json` | UPDATE |
| Test | `tests/integration/mods/first-aid/treat_my_wounded_part_action_discovery.test.js` | CREATE |
| Test | `tests/integration/mods/first-aid/handle_treat_my_wounded_part_rule.test.js` | CREATE |

## Implementation Notes

1. **Scope Design Decision**: Create a new `treatable_actor_body_parts` scope rather than reusing `wounded_actor_body_parts` because:
   - `wounded_actor_body_parts` filters for accessibility (clothingSlotId check)
   - Treatment should work on covered wounds (with penalty modifier)
   - This matches the pattern of `treatable_target_body_parts` vs `wounded_target_body_parts`

2. **Modifier Target Role**: Since this is a self-action with only `primary` target (the body part), modifiers use `targetRole: "primary"` instead of `targetRole: "secondary"`.

3. **Entity References in Rule**:
   - `"actor"` = the acting entity (self)
   - `"primary"` = the body part entity
   - No `"secondary"` target exists

4. **Perception Type**: Uses `"action_self"` for perceptible events since actor is performing action on themselves.
