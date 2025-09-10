# Specification: Rub Penis Between Ass Cheeks Action

## Overview
This specification defines a new action/rule combination for the 'sex' mod that allows an actor with a penis to rub it between a target's exposed ass cheeks. This action represents intimate physical contact where the actor is positioned behind the target.

## Action Definition: `sex:rub_penis_between_ass_cheeks`

### File Location
`data/mods/sex/actions/rub_penis_between_ass_cheeks.action.json`

### Action Structure
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "sex:rub_penis_between_ass_cheeks",
  "name": "Rub Penis Between Ass Cheeks",
  "description": "Rub your penis between the target's exposed ass cheeks.",
  "targets": {
    "primary": {
      "scope": "sex:actors_with_exposed_ass_facing_away",
      "placeholder": "primary",
      "description": "Person to rub against from behind"
    }
  },
  "required_components": {
    "actor": ["positioning:closeness"]
  },
  "template": "rub your penis between {primary}'s ass cheeks",
  "prerequisites": [
    {
      "logic": {
        "hasPartOfType": ["actor", "penis"]
      },
      "failure_message": "You need a penis to perform this action."
    }
  ],
  "visual": {
    "backgroundColor": "#4a148c",
    "textColor": "#e1bee7",
    "hoverBackgroundColor": "#6a1b9a",
    "hoverTextColor": "#f3e5f5"
  }
}
```

## Scope Definition: `sex:actors_with_exposed_ass_facing_away`

### File Location
`data/mods/sex/scopes/actors_with_exposed_ass_facing_away.scope`

### Scope Structure
```javascript
// Scope for actors that this entity is facing away from who have exposed ass cheeks
// Combines positioning validation (facing away + closeness) with anatomy and clothing checks
// Used by actions that require the actor to be behind someone with exposed ass anatomy
// Note: ass_cheek is the body part type, left_ass and right_ass are socket IDs
sex:actors_with_exposed_ass_facing_away := actor.components.positioning:closeness.partners[][{
  "and": [
    {
      "condition_ref": "positioning:actor-in-entity-facing-away"
    },
    {
      "or": [
        {
          "and": [
            {"hasPartOfType": [".", "ass_cheek"]},
            {"not": {"isSocketCovered": [".", "left_ass"]}}
          ]
        },
        {
          "and": [
            {"hasPartOfType": [".", "ass_cheek"]},
            {"not": {"isSocketCovered": [".", "right_ass"]}}
          ]
        }
      ]
    }
  ]
}]
```

### Key Requirements
- Target must be in actor's closeness partners
- Actor must be in target's facing_away_from array (target is facing away)
- Target must have ass_cheek body parts (attached to left_ass and/or right_ass sockets)
- At least one ass cheek socket (left_ass or right_ass) must be uncovered (not covered by clothing)

## Condition Definition: `sex:event-is-action-rub-penis-between-ass-cheeks`

### File Location
`data/mods/sex/conditions/event-is-action-rub-penis-between-ass-cheeks.condition.json`

### Condition Structure
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "sex:event-is-action-rub-penis-between-ass-cheeks",
  "description": "Checks if the triggering event is for the 'sex:rub_penis_between_ass_cheeks' action.",
  "logic": {
    "==": [{ "var": "event.payload.actionId" }, "sex:rub_penis_between_ass_cheeks"]
  }
}
```

## Rule Definition: `handle_rub_penis_between_ass_cheeks`

### File Location
`data/mods/sex/rules/handle_rub_penis_between_ass_cheeks.rule.json`

### Rule Structure
```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_rub_penis_between_ass_cheeks",
  "comment": "Handles the 'sex:rub_penis_between_ass_cheeks' action. Dispatches descriptive text and ends the turn.",
  "event_type": "core:attempt_action",
  "condition": { "condition_ref": "sex:event-is-action-rub-penis-between-ass-cheeks" },
  "actions": [
    {
      "type": "GET_NAME",
      "parameters": { "entity_ref": "actor", "result_variable": "actorName" }
    },
    {
      "type": "GET_NAME",
      "parameters": { "entity_ref": "target", "result_variable": "targetName" }
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
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} rubs their erect penis sensually between {context.targetName}'s bare ass cheeks."
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
        "variable_name": "locationId",
        "value": "{context.actorPosition.locationId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "targetId",
        "value": "{event.payload.targetId}"
      }
    },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

### Key Behaviors
- Retrieves actor and target names for message formatting
- Sets the log message to: "{actor} rubs their erect penis sensually between {primary}'s bare ass cheeks."
- Sets perception type as "action_target_general" for event visibility
- Uses the core:logSuccessAndEndTurn macro to complete the action and end the turn

## Testing Requirements

### Integration Test 1: Action Execution Test

#### File Location
`tests/integration/mods/sex/rub_penis_between_ass_cheeks_action.test.js`

#### Test Requirements
- Test file should follow the pattern established in `pump_penis_action.test.js`
- Create test entities with proper anatomy setup:
  - Actor with penis body part
  - Target with ass_cheek body parts attached to left_ass and/or right_ass sockets
  - Entities in closeness relationship
  - Target facing away from actor (actor in target's facing_away_from array)
  - Ass sockets (left_ass, right_ass) uncovered by clothing
- Execute the action using `ModTestFixture.forAction('sex', 'sex:rub_penis_between_ass_cheeks')`
- Verify:
  - Action executes successfully
  - Correct log message is generated
  - Turn ends properly
  - Perceptible event is dispatched

### Integration Test 2: Action Discovery Test

#### File Location
`tests/integration/scopes/rubPenisBetweenAssCheeksActionDiscovery.integration.test.js`

#### Test Requirements
- Test file should follow the pattern established in `pumpPenisActionDiscovery.integration.test.js`
- Test scenarios:
  1. **Positive case**: Action is discoverable when:
     - Actor has penis body part
     - Entities are in closeness
     - Target is facing away (actor in target's facing_away_from array)
     - Target has exposed ass_cheek body parts (at least one socket uncovered)
  2. **Negative cases**: Action NOT discoverable when:
     - Actor lacks penis body part
     - Entities not in closeness
     - Target facing toward actor (actor not in facing_away_from array)
     - Both ass sockets (left_ass, right_ass) are covered by clothing
     - Target lacks ass_cheek body parts
- Use actual scope file content and action definition
- Verify action appears/doesn't appear in available actions list

### Test Utilities
Both test files should leverage existing test utilities:
- `ModTestFixture` for action execution tests
- `ModEntityBuilder` for creating test entities
- `ModAssertionHelpers` for verifying action outcomes
- `SimpleEntityManager` for managing test entities
- Mock services as needed (logger, event dispatcher, etc.)

## Implementation Notes

1. **Visual Scheme**: Uses the same color scheme as `sex:press_against_back` for visual consistency
2. **Scope Pattern**: Follows the established pattern of combining positioning checks with anatomy/clothing checks
3. **Rule Pattern**: Follows the standard rule pattern using the core:logSuccessAndEndTurn macro
4. **Mature Content**: This content is for mature audiences and follows the established patterns in the sex mod
5. **Anatomy System**: 
   - Body part type is `ass_cheek`, not `left_ass` or `right_ass`
   - `left_ass` and `right_ass` are socket IDs on the torso where ass_cheek parts attach
   - The `isSocketCovered` operator checks if clothing covers these specific sockets
   - The `hasPartOfType` operator checks for the presence of body parts by their type

## Validation Checklist

- [ ] Action JSON validates against action.schema.json
- [ ] Scope file follows proper DSL syntax
- [ ] Condition JSON validates against condition.schema.json
- [ ] Rule JSON validates against rule.schema.json
- [ ] Integration tests pass with proper coverage
- [ ] Action is discoverable under correct conditions
- [ ] Messages display correctly in game
- [ ] Turn management works properly