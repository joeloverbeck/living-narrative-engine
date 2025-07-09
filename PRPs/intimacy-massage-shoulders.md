# PRP: Implement Shoulder Massage Action for Intimacy Mod

## Overview

This PRP describes the implementation of a new action in the intimacy mod that allows actors to massage the shoulders of their intimate partners. The action requires checking that the target has arms and is in the actor's intimacy closeness list.

## Research Findings

### Existing Patterns Referenced

1. **Action Pattern**: The `sex:fondle_breasts` action at `/data/mods/sex/actions/fondle_breasts.action.json:1-15` provides the template for actions that check body parts.

2. **Scope Pattern**: The `actors_with_breasts_in_intimacy.scope` at `/data/mods/sex/scopes/actors_with_breasts_in_intimacy.scope:1` shows how to create scopes that filter partners by body part type.

3. **Rule Pattern**: The `handle_fondle_breasts` rule at `/data/mods/sex/rules/handle_fondle_breasts.rule.json:1-56` demonstrates the event handling pattern for intimate actions.

4. **Condition Pattern**: The condition file at `/data/mods/sex/conditions/event-is-action-fondle-breasts.condition.json:1-10` shows how to check for specific action IDs.

5. **Testing Pattern**: Integration tests at `/tests/integration/mods/sex/fondle_breasts_action.test.js:1-246` and `/tests/integration/rules/kissCheekRule.integration.test.js:1-100` provide the testing structure.

### Documentation References

- **Scope DSL**: Full specification at `/docs/scope-dsl.md` - particularly the `hasPartOfType` operator and filter syntax
- **Scope Creation Guide**: Tutorial at `/docs/mods/creating-scopes.md` - patterns for filtering by body parts
- **JSON Logic**: Reference at `/docs/json-logic/json-logic for modders.md` - custom operators for anatomy checks

## Implementation Blueprint

### Pseudocode Approach

```
1. Create scope for actors with arms in intimacy
   - Start with actor's intimacy:closeness partners
   - Filter to entities that have "arm" body part type

2. Create action definition
   - ID: "intimacy:massage_shoulders"
   - Template: "massage {target}'s shoulders"
   - Required components: intimacy:closeness for actor
   - Scope: Reference the new scope

3. Create condition to detect the action
   - Check if event.payload.actionId equals "intimacy:massage_shoulders"

4. Create rule to handle the action
   - Listen for "core:attempt_action" events
   - Check condition for massage_shoulders action
   - Get actor and target names
   - Dispatch perceptible event with massage text
   - Dispatch success event and end turn

5. Create comprehensive integration tests
   - Test successful action execution
   - Test with missing arms
   - Test with non-partner target
```

## Task List (In Order)

1. Create the scope file: `data/mods/intimacy/scopes/actors_with_arms_in_intimacy.scope`
2. Create the action file: `data/mods/intimacy/actions/massage_shoulders.action.json`
3. Create the condition file: `data/mods/intimacy/conditions/event-is-action-massage-shoulders.condition.json`
4. Create the rule file: `data/mods/intimacy/rules/handle_massage_shoulders.rule.json`
5. Create the integration test: `tests/integration/mods/intimacy/massage_shoulders_action.test.js`
6. Run validation gates to ensure implementation is correct

## Implementation Details

### 1. Scope Definition

**File**: `data/mods/intimacy/scopes/actors_with_arms_in_intimacy.scope`

The scope uses the pattern from `actors_with_breasts_in_intimacy.scope` but checks for "arm" body parts:

```
intimacy:actors_with_arms_in_intimacy := actor.components.intimacy:closeness.partners[][{"hasPartOfType": ["entity", "arm"]}]
```

### 2. Action Definition

**File**: `data/mods/intimacy/actions/massage_shoulders.action.json`

Following the pattern from `fondle_breasts.action.json`:

```json
{
  "$schema": "http://example.com/schemas/action.schema.json",
  "id": "intimacy:massage_shoulders",
  "commandVerb": "massage-shoulders",
  "name": "Massage Shoulders",
  "description": "Gently massage the target's shoulders.",
  "scope": "intimacy:actors_with_arms_in_intimacy",
  "required_components": {
    "actor": ["intimacy:closeness"]
  },
  "template": "massage {target}'s shoulders",
  "prerequisites": []
}
```

### 3. Condition Definition

**File**: `data/mods/intimacy/conditions/event-is-action-massage-shoulders.condition.json`

Following the pattern from `event-is-action-fondle-breasts.condition.json`:

```json
{
  "$schema": "http://example.com/schemas/condition.schema.json",
  "id": "intimacy:event-is-action-massage-shoulders",
  "description": "Checks if the triggering event is for the 'intimacy:massage_shoulders' action.",
  "logic": {
    "==": [{ "var": "event.payload.actionId" }, "intimacy:massage_shoulders"]
  }
}
```

### 4. Rule Definition

**File**: `data/mods/intimacy/rules/handle_massage_shoulders.rule.json`

Following the pattern from `handle_fondle_breasts.rule.json`:

```json
{
  "$schema": "http://example.com/schemas/rule.schema.json",
  "rule_id": "handle_massage_shoulders",
  "comment": "Handles the 'intimacy:massage_shoulders' action. Dispatches descriptive text and ends the turn.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "intimacy:event-is-action-massage-shoulders"
  },
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
        "value": "{context.actorName} kneads {context.targetName}'s shoulders."
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

### 5. Integration Test

**File**: `tests/integration/mods/intimacy/massage_shoulders_action.test.js`

The test follows the pattern from `fondle_breasts_action.test.js`, creating entities with proper anatomy structure to test the action.

## Critical Context for AI Implementation

### Body Part Structure

The Living Narrative Engine uses an anatomy system where body parts are separate entities linked through `anatomy:part` components. When creating test entities:

1. Create a main entity with `anatomy:body` component pointing to root part
2. Create body part entities with `anatomy:part` components
3. Arms have `subType: "arm"` in their `anatomy:part` component

### hasPartOfType Operator

The custom JSON Logic operator `hasPartOfType` is implemented in `/src/logic/jsonLogicCustomOperators.js`. It checks if an entity has body parts of a specific type by traversing the anatomy tree.

### Integration with Existing System

- Actions must be registered in the mod manifest
- Scopes are automatically namespaced by mod (e.g., `actors_with_arms_in_intimacy` becomes `intimacy:actors_with_arms_in_intimacy`)
- The `core:logSuccessAndEndTurn` macro handles standard action completion

## Validation Gates

```bash
# Syntax validation
npm run lint

# Unit tests (if any specific unit tests are added)
npm run test -- tests/unit/

# Integration tests
npm run test -- tests/integration/mods/intimacy/massage_shoulders_action.test.js

# All tests
npm run test
```

## Error Handling Strategy

1. **Missing Body Parts**: The scope will return an empty set if target has no arms, preventing the action from being available
2. **Missing Components**: The `hasPartOfType` operator safely handles missing anatomy components by returning false
3. **Invalid Targets**: Prerequisites in the action definition ensure only valid targets are selectable
4. **Rule Robustness**: The rule uses safe variable access patterns that handle missing entities gracefully

## Success Criteria

- Action appears in action list when actor has `intimacy:closeness` component
- Action only targets partners who have at least one arm body part
- Performing the action dispatches appropriate perceptible event with massage text
- Integration tests pass all scenarios
- No lint errors or test failures

## Confidence Score: 9/10

This PRP provides comprehensive context with exact file references, patterns to follow, and clear implementation steps. The only uncertainty is around potential edge cases in the anatomy system that might require minor adjustments during implementation.
