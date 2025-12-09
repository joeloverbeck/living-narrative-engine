# Treat Wound Action Specification

## Overview

Create a new `treat_wounded_part` action/rule combination in the first-aid mod that allows actors to treat wounded body parts on other actors using their medicine skill.

## Files to Create

### 1. Action File
**Path**: `data/mods/first-aid/actions/treat_wounded_part.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "first-aid:treat_wounded_part",
  "description": "Treat a wound on another actor's body part using medicine skill.",
  "template": "treat {target}'s wound in {woundedBodyPart} ({chance}% chance)",
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
  "target": {
    "primary": {
      "entityType": "actor",
      "scope": "core:actors_in_location",
      "variableName": "target"
    },
    "secondary": {
      "entityType": "body_part",
      "scope": "first-aid:treatable_target_body_parts",
      "variableName": "woundedBodyPart",
      "contextFrom": "primary"
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
              { "var": "secondary.components.anatomy:visibility_rules.clothingSlotId" },
              { "!": { "isSlotExposed": ["primary", { "var": "secondary.components.anatomy:visibility_rules.clothingSlotId" }, ["base", "outer", "armor"]] } }
            ]
          }
        },
        "type": "flat",
        "value": -20,
        "tag": "wound is covered by clothing",
        "targetRole": "secondary"
      },
      {
        "condition": {
          "logic": { "!!": { "var": "secondary.components.first-aid:rinsed" } }
        },
        "type": "flat",
        "value": 10,
        "tag": "wound has been rinsed",
        "targetRole": "secondary"
      },
      {
        "condition": {
          "logic": { "!": { "var": "secondary.components.first-aid:rinsed" } }
        },
        "type": "flat",
        "value": -10,
        "tag": "wound has not been rinsed",
        "targetRole": "secondary"
      },
      {
        "condition": {
          "logic": { "!!": { "var": "secondary.components.first-aid:disinfected" } }
        },
        "type": "flat",
        "value": 10,
        "tag": "wound has been disinfected",
        "targetRole": "secondary"
      },
      {
        "condition": {
          "logic": { "!": { "var": "secondary.components.first-aid:disinfected" } }
        },
        "type": "flat",
        "value": -5,
        "tag": "wound has not been disinfected",
        "targetRole": "secondary"
      }
    ]
  }
}
```

### 2. Scope File
**Path**: `data/mods/first-aid/scopes/treatable_target_body_parts.scope`

```
// Returns the target actor's body part entity IDs that are wounded (health below max).
//
// BEHAVIOR: Iterates target.body_parts via BodyGraphService#getAllParts and keeps
// parts with an anatomy:part_health component whose currentHealth is lower than
// maxHealth while excluding vital organs.
//
// IMPORTANT: Unlike wounded_target_body_parts.scope, this scope does NOT filter out
// covered wounds. This allows the action to target covered wounds (with a modifier
// penalty) so that LLM characters can be informed about wounds under clothing.
//
// Usage: Scope for treat_wounded_part action targeting another actor's wounds.
// Reference: specs/treat-wound-action.md
first-aid:treatable_target_body_parts := target.body_parts[][{"and":[
  {"isBodyPartWounded": ["target", {"var": "entity"}, true]},
  {"!": {"var": "entity.components.anatomy:vital_organ"}}
]}]
```

### 3. Condition File
**Path**: `data/mods/first-aid/conditions/event-is-action-treat-wounded-part.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "first-aid:event-is-action-treat-wounded-part",
  "description": "Checks if the event is a treat_wounded_part action attempt.",
  "evaluator": "json-logic",
  "logic": {
    "and": [
      { "===": [{ "var": "eventName" }, "core:attempt_action"] },
      { "===": [{ "var": "actionId" }, "first-aid:treat_wounded_part"] }
    ]
  }
}
```

### 4. Rule File
**Path**: `data/mods/first-aid/rules/handle_treat_wounded_part.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "id": "first-aid:handle_treat_wounded_part",
  "description": "Handles the treat_wounded_part action with chance-based outcomes.",
  "priority": 100,
  "event": "core:attempt_action",
  "condition": "first-aid:event-is-action-treat-wounded-part",
  "actions": [
    {
      "type": "GET_NAME",
      "parameters": { "entity_ref": "actor", "result_variable": "actorName" }
    },
    {
      "type": "GET_NAME",
      "parameters": { "entity_ref": "primary", "result_variable": "targetName" }
    },
    {
      "type": "GET_NAME",
      "parameters": { "entity_ref": "secondary", "result_variable": "bodyPartName" }
    },
    {
      "type": "IF",
      "parameters": {
        "condition": { "===": [{ "var": "context.outcomeType" }, "CRITICAL_SUCCESS"] },
        "then": [
          {
            "type": "MODIFY_PART_HEALTH",
            "parameters": {
              "part_entity_ref": "secondary",
              "delta": 20,
              "clamp_to_bounds": true
            }
          },
          {
            "type": "SET_VARIABLE",
            "parameters": {
              "name": "message",
              "value": {
                "template": "{actorName} expertly treats {targetName}'s wounded {bodyPartName}, achieving remarkable healing results!",
                "values": {
                  "actorName": { "var": "context.actorName" },
                  "targetName": { "var": "context.targetName" },
                  "bodyPartName": { "var": "context.bodyPartName" }
                }
              }
            }
          },
          {
            "type": "REGENERATE_DESCRIPTION",
            "parameters": { "entity_ref": "primary" }
          },
          {
            "type": "REGENERATE_DESCRIPTION",
            "parameters": { "entity_ref": "secondary" }
          }
        ]
      }
    },
    {
      "type": "IF",
      "parameters": {
        "condition": { "===": [{ "var": "context.outcomeType" }, "SUCCESS"] },
        "then": [
          {
            "type": "MODIFY_PART_HEALTH",
            "parameters": {
              "part_entity_ref": "secondary",
              "delta": 10,
              "clamp_to_bounds": true
            }
          },
          {
            "type": "SET_VARIABLE",
            "parameters": {
              "name": "message",
              "value": {
                "template": "{actorName} successfully treats {targetName}'s wounded {bodyPartName}.",
                "values": {
                  "actorName": { "var": "context.actorName" },
                  "targetName": { "var": "context.targetName" },
                  "bodyPartName": { "var": "context.bodyPartName" }
                }
              }
            }
          },
          {
            "type": "REGENERATE_DESCRIPTION",
            "parameters": { "entity_ref": "primary" }
          },
          {
            "type": "REGENERATE_DESCRIPTION",
            "parameters": { "entity_ref": "secondary" }
          }
        ]
      }
    },
    {
      "type": "IF",
      "parameters": {
        "condition": { "===": [{ "var": "context.outcomeType" }, "FAILURE"] },
        "then": [
          {
            "type": "SET_VARIABLE",
            "parameters": {
              "name": "message",
              "value": {
                "template": "{actorName} attempts to treat {targetName}'s wounded {bodyPartName} but fails to provide effective care.",
                "values": {
                  "actorName": { "var": "context.actorName" },
                  "targetName": { "var": "context.targetName" },
                  "bodyPartName": { "var": "context.bodyPartName" }
                }
              }
            }
          }
        ]
      }
    },
    {
      "type": "IF",
      "parameters": {
        "condition": { "===": [{ "var": "context.outcomeType" }, "CRITICAL_FAILURE"] },
        "then": [
          {
            "type": "APPLY_DAMAGE",
            "parameters": {
              "entity_ref": "primary",
              "part_ref": "secondary",
              "damage_entry": {
                "amount": 10,
                "type": "piercing"
              }
            }
          },
          {
            "type": "SET_VARIABLE",
            "parameters": {
              "name": "message",
              "value": {
                "template": "{actorName} fumbles badly while treating {targetName}'s wounded {bodyPartName}, causing additional injury!",
                "values": {
                  "actorName": { "var": "context.actorName" },
                  "targetName": { "var": "context.targetName" },
                  "bodyPartName": { "var": "context.bodyPartName" }
                }
              }
            }
          },
          {
            "type": "REGENERATE_DESCRIPTION",
            "parameters": { "entity_ref": "primary" }
          },
          {
            "type": "REGENERATE_DESCRIPTION",
            "parameters": { "entity_ref": "secondary" }
          }
        ]
      }
    },
    {
      "type": "LOG_ACTION",
      "parameters": {
        "message": { "var": "context.message" },
        "actionId": "first-aid:treat_wounded_part",
        "locationId": { "var": "context.locationId" },
        "actorId": { "var": "context.actorId" },
        "targetId": { "var": "context.primaryId" },
        "perceptionType": "action_target_general"
      }
    }
  ]
}
```

## Test Files

### 1. Action Discovery Test
**Path**: `tests/integration/mods/first-aid/treat_wounded_part_action_discovery.test.js`

Test scenarios:
- Action is discoverable when actor has medicine_skill and target has wounded body parts
- Action NOT discoverable when actor lacks medicine_skill
- Action NOT discoverable when target has no wounded body parts
- Action NOT discoverable when actor has forbidden components (e.g., positioning:fallen)
- Action shows ALL wounded parts including covered ones (with modifier penalty)
- Proper template variables substitution ({target}, {woundedBodyPart}, {chance})

### 2. Rule Execution Test
**Path**: `tests/integration/mods/first-aid/handle_treat_wounded_part_rule.test.js`

Test scenarios:
- CRITICAL_SUCCESS: Heals +20 HP, proper message, regenerates descriptions
- SUCCESS: Heals +10 HP, proper message, regenerates descriptions
- FAILURE: No HP change, proper message, no description regeneration
- CRITICAL_FAILURE (FUMBLE): Applies 10 piercing damage, proper message, regenerates descriptions
- Modifier calculations:
  - -20 for covered wound
  - +10 for rinsed wound / -10 for not rinsed
  - +10 for disinfected wound / -5 for not disinfected
- Ignores unrelated actions

## Key Implementation Notes

1. **Existing Operation**: Uses `MODIFY_PART_HEALTH` operation which already exists and supports positive delta for healing

2. **Scope Design**: `treatable_target_body_parts` intentionally does NOT filter by `isBodyPartAccessible` to allow targeting covered wounds (modifier handles the penalty)

3. **Visual Scheme**: Uses same green medical theme as other first-aid actions

4. **Modifiers**: 5 modifiers total affecting chance calculation:
   - Coverage: -20 if wound covered by clothing
   - Rinsed: +10 if rinsed, -10 if not rinsed
   - Disinfected: +10 if disinfected, -5 if not disinfected

5. **Outcomes**:
   - CRITICAL_SUCCESS: +20 HP heal
   - SUCCESS: +10 HP heal
   - FAILURE: No change
   - CRITICAL_FAILURE: 10 piercing damage via APPLY_DAMAGE

6. **Description Regeneration**: Applied for all outcomes that modify health (CRITICAL_SUCCESS, SUCCESS, CRITICAL_FAILURE)

## Dependencies

- `skills:medicine_skill` component
- `first-aid:rinsed` component
- `first-aid:disinfected` component
- `anatomy:part_health` component
- `anatomy:visibility_rules` component
- `anatomy:vital_organ` component
- `isBodyPartWounded` JSON Logic operator
- `isSlotExposed` JSON Logic operator
- `MODIFY_PART_HEALTH` operation handler
- `APPLY_DAMAGE` operation handler

## Execution Order

1. Create scope file: `treatable_target_body_parts.scope`
2. Create condition file: `event-is-action-treat-wounded-part.condition.json`
3. Create action file: `treat_wounded_part.action.json`
4. Create rule file: `handle_treat_wounded_part.rule.json`
5. Create action discovery test
6. Create rule execution test
7. Run tests to verify implementation
