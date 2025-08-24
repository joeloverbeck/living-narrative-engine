# Nuzzle Penis Through Clothing Action Specification

## Status: PROPOSED / NOT IMPLEMENTED

**Note:** This is a specification for a future feature. The files and implementations described below do not currently exist in the production codebase.

## Overview

This specification defines a proposed new intimate action where an actor nuzzles against a target's penis through their clothing while kneeling before them. The action is designed to combine elements from existing implemented actions (`pump_penis_from_up_close` and `rub_penis_over_clothes`) to create a sensual, clothed interaction.

## Components

### 1. Scope Definition

#### File: `data/mods/sex/scopes/actor_kneeling_before_target_with_covered_penis.scope` _(TO BE CREATED)_

```javascript
// Scope for actors in closeness where the actor is kneeling before the target who has a covered penis
// Used by actions that require the actor to be in a kneeling position before the target with clothed anatomy
sex:actor_kneeling_before_target_with_covered_penis := actor.components.positioning:closeness.partners[][{
  "and": [
    {"hasPartOfType": [".", "penis"]},
    {"isSocketCovered": [".", "penis"]},
    {
      "==": [
        {"var": "actor.components.positioning:kneeling_before.entityId"},
        {"var": "id"}
      ]
    }
  ]
}]
```

**Key Requirements:**

- Target must have a penis anatomy part
- Penis must be covered (clothed)
- Actor must be kneeling before the specific target
- Both must be in closeness positioning

### 2. Action Definition

#### File: `data/mods/sex/actions/nuzzle_penis_through_clothing.action.json` _(TO BE CREATED)_

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "sex:nuzzle_penis_through_clothing",
  "name": "Nuzzle Penis Through Clothing",
  "description": "Nuzzle against the target's penis through their clothing while kneeling before them.",
  "targets": {
    "primary": {
      "scope": "sex:actor_kneeling_before_target_with_covered_penis",
      "placeholder": "primary",
      "description": "Person with clothed penis to nuzzle against"
    },
    "secondary": {
      "scope": "clothing:target_topmost_torso_lower_clothing_no_accessories",
      "placeholder": "secondary",
      "description": "Clothing item through which to nuzzle",
      "contextFrom": "primary"
    }
  },
  "required_components": {
    "actor": ["positioning:closeness", "positioning:kneeling_before"]
  },
  "template": "nuzzle against {primary}'s penis through the {secondary}",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#4a148c",
    "textColor": "#e1bee7",
    "hoverBackgroundColor": "#6a1b9a",
    "hoverTextColor": "#f3e5f5"
  }
}
```

**Design Decisions:**

- Uses multi-target pattern with primary (person) and secondary (clothing)
- Requires both closeness and kneeling_before components on actor
- Visual colors match existing intimate actions for consistency
- Template provides clear, concise action description

### 3. Condition Definition

#### File: `data/mods/sex/conditions/event-is-action-nuzzle-penis-through-clothing.condition.json` _(TO BE CREATED)_

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "sex:event-is-action-nuzzle-penis-through-clothing",
  "description": "Checks if the triggering event is for the 'sex:nuzzle_penis_through_clothing' action.",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "sex:nuzzle_penis_through_clothing"
    ]
  }
}
```

### 4. Rule Definition

#### File: `data/mods/sex/rules/handle_nuzzle_penis_through_clothing.rule.json` _(TO BE CREATED)_

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_nuzzle_penis_through_clothing",
  "comment": "Handles the 'sex:nuzzle_penis_through_clothing' action. Dispatches descriptive text and ends the turn.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "sex:event-is-action-nuzzle-penis-through-clothing"
  },
  "actions": [
    {
      "type": "GET_NAME",
      "parameters": { "entity_ref": "actor", "result_variable": "actorName" }
    },
    {
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "primary",
        "result_variable": "primaryName"
      }
    },
    {
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "secondary",
        "result_variable": "clothingName"
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
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} nuzzles against {context.primaryName}'s penis through the {context.clothingName}, feeling the outline of the genitals."
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
        "value": "{event.payload.primaryId}"
      }
    },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

**Rule Processing Flow:**

1. Extract actor, primary target, and clothing names
2. Get actor's position for location context
3. Set descriptive log message with sensual description
4. Configure perception type for event visibility
5. Set location and target IDs for proper event routing
6. Execute standard success logging and turn ending macro

## Implementation Notes

### Dependencies on Existing Code

This proposed action builds upon patterns and components from existing implementations:

1. **Existing Actions Used as Reference:**
   - `pump_penis_from_up_close` - Provides the kneeling before target pattern
   - `rub_penis_over_clothes` - Provides the multi-target pattern for clothing interaction

2. **Existing Scopes Used:**
   - `clothing:target_topmost_torso_lower_clothing_no_accessories` - Already implemented and will be reused

3. **New Components Required:**
   - New scope file: `actor_kneeling_before_target_with_covered_penis.scope`
   - This will be the inverse of the existing `actor_kneeling_before_target_with_penis` scope which requires an uncovered penis

### Testing Requirements (When Implementing)

1. **Unit Tests:**
   - Scope evaluation with various positioning states
   - Action availability when prerequisites are met/not met
   - Multi-target resolution

2. **Integration Tests:**
   - Full action execution flow
   - Event dispatching and perception
   - Turn management

3. **Edge Cases:**
   - Actor not kneeling before target
   - Target has no penis anatomy
   - Penis is uncovered (naked)
   - No torso_lower clothing present

### Consistency Considerations

- Visual styling matches other intimate actions in the sex mod
- Event handling pattern follows established conventions
- Uses existing clothing scope for secondary target
- Integrates with positioning system requirements

### Future Enhancements

- Could add arousal system integration
- Could vary descriptions based on relationship status
- Could add clothing material considerations for descriptions
- Could integrate with pleasure/satisfaction mechanics if implemented

## Implementation Checklist (When Implementing)

### Files to Create

- [ ] Create `data/mods/sex/scopes/actor_kneeling_before_target_with_covered_penis.scope`
- [ ] Create `data/mods/sex/actions/nuzzle_penis_through_clothing.action.json`
- [ ] Create `data/mods/sex/conditions/event-is-action-nuzzle-penis-through-clothing.condition.json`
- [ ] Create `data/mods/sex/rules/handle_nuzzle_penis_through_clothing.rule.json`

### Validation Steps

- [ ] Scope correctly filters for kneeling actor and covered penis target
- [ ] Action appears only when all prerequisites are met
- [ ] Multi-target resolution works correctly
- [ ] Rule processes event and generates appropriate description
- [ ] Turn ends properly after action execution
- [ ] Perception events are dispatched correctly
- [ ] Action integrates with existing positioning mechanics
- [ ] All tests pass after implementation
