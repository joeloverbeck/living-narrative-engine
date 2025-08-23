# Positioning Turn Your Back Action Specification

## ⚠️ Implementation Status: NOT IMPLEMENTED

**Current State**: This feature does not exist in the production code.

**Status**: This document serves as a **requirements specification** for a planned feature, not documentation of existing functionality.

**Missing Components**:
- ❌ No action file: `data/mods/positioning/actions/turn_your_back.action.json`
- ❌ No rule file: `data/mods/positioning/rules/turn_your_back.rule.json` 
- ❌ No condition file: `data/mods/positioning/conditions/event-is-action-turn-your-back.condition.json`
- ❌ No test coverage
- ❌ No references in codebase

## Overview

This specification **proposes** a new action for the positioning mod: `positioning:turn_your_back`. This action would allow an actor to turn their back to any other actor in the same location, creating a facing-away positional relationship without requiring physical closeness.

## Requirements Analysis

### Existing Action Patterns
- **turn_around_to_face**: Removes facing_away component, requires closeness and facing_away state
- **turn_around**: Toggles facing_away state between close actors  
- **kneel_before**: Uses `core:actors_in_location` scope, no required components, forbidden target component

### Target Implementation Pattern
Following the **kneel_before** pattern for scope and component restrictions, combined with the **turn_around** rule logic for managing the `positioning:facing_away` component.

## Functional Requirements

### 1. Action Definition
The implementation will create a `positioning:turn_your_back` action that:
- Will use scope `core:actors_in_location` (allowing targeting any actor in location without closeness requirement)
- Will have no required components (any actor will be able to turn their back)
- Will forbid `positioning:facing_away` component on actor (preventing duplicate state)
- Will use template: `"turn your back to {target}"`
- Will provide clear visual styling consistent with positioning mod

### 2. Rule Processing  
The implementation will create a corresponding rule that:
- Will add `positioning:facing_away` component to the acting actor
- Will set target entity in the `facing_away_from` array field
- Will handle component creation/modification logic appropriately
- Will dispatch perceptible event: `"{actor} turns their back to {target}."`
- Will dispatch success message: `"{actor} turns their back to {target}."`
- Will end turn successfully

### 3. Component Integration
- **Component Used**: `positioning:facing_away` with `facing_away_from` array field
- **Logic**: Will add target entity ID to actor's facing_away_from array
- **State Management**: Will create component if it doesn't exist, or add to existing array

## Implementation Details

### 1. Action File: `data/mods/positioning/actions/turn_your_back.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:turn_your_back",
  "name": "Turn Your Back",
  "description": "Turn your back to someone, facing away from them in a dismissive or defensive gesture.",
  "targets": {
    "primary": {
      "scope": "core:actors_in_location",
      "placeholder": "target",
      "description": "Actor to turn your back to"
    }
  },
  "required_components": {
    "actor": []
  },
  "forbidden_components": {
    "actor": ["positioning:facing_away"]
  },
  "template": "turn your back to {target}",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#bf360c",
    "textColor": "#ffffff", 
    "hoverBackgroundColor": "#8d2c08",
    "hoverTextColor": "#ffffff"
  }
}
```

### 2. Condition File: `data/mods/positioning/conditions/event-is-action-turn-your-back.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "positioning:event-is-action-turn-your-back",
  "description": "Checks if the triggering event is for the 'positioning:turn_your_back' action.",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "positioning:turn_your_back"
    ]
  }
}
```

### 3. Rule File: `data/mods/positioning/rules/turn_your_back.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_turn_your_back",
  "comment": "Handles the 'positioning:turn_your_back' action. Adds facing_away component to actor, setting them to face away from the target.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "positioning:event-is-action-turn-your-back"
  },
  "actions": [
    {
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "actor",
        "result_variable": "actorName"
      }
    },
    {
      "type": "GET_NAME", 
      "parameters": {
        "entity_ref": "target",
        "result_variable": "targetName"
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
      "type": "ADD_COMPONENT",
      "comment": "Add facing_away component with target in facing_away_from array",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:facing_away",
        "value": {
          "facing_away_from": ["{event.payload.targetId}"]
        }
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} turns their back to {context.targetName}."
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
    {
      "type": "DISPATCH_EVENT",
      "parameters": {
        "eventType": "positioning:actor_turned_back",
        "payload": {
          "actor": "{event.payload.actorId}",
          "target": "{event.payload.targetId}"
        }
      }
    },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

## Technical Considerations

### Component State Management
- **Forbidden Component Logic**: The `positioning:facing_away` forbidden component ensures the action only appears when the actor is not already facing away from anyone
- **Component Creation**: Rule uses `ADD_COMPONENT` since the forbidden component guarantees the component doesn't exist
- **Array Structure**: The `facing_away_from` field is an array, allowing potential future expansion to face away from multiple entities

### Scope and Targeting
- **Location-Wide Scope**: Using `core:actors_in_location` allows turning back to any actor in the same location
- **No Closeness Required**: Unlike `turn_around`, this action doesn't require physical proximity
- **Clear Intent**: The action represents a social/emotional gesture rather than a physical positioning requirement

### Integration with Existing Actions
- **Complementary to turn_around_to_face**: This action creates the state that `turn_around_to_face` can resolve
- **Different from turn_around**: This is a one-way action affecting only the actor, not the target
- **Consistent Visual Design**: Matches positioning mod color scheme (#bf360c)

## Validation Requirements

### 1. Action Availability
- ⏳ Action will only appear when actor does NOT have `positioning:facing_away` component
- ⏳ Action will be available to any actor in a location with other actors
- ⏳ Action will not appear when only one actor in location (no valid targets)

### 2. Component State Changes
- ⏳ Successful execution will add `positioning:facing_away` component to actor
- ⏳ Component will contain target entity ID in `facing_away_from` array
- ⏳ No changes will be made to target actor's components

### 3. Event Dispatching  
- ⏳ Perceptible event will be dispatched to location with correct actor and target names
- ⏳ Success message will be displayed to actor
- ⏳ Custom `positioning:actor_turned_back` event will be dispatched for potential future use

### 4. Integration with Related Actions
- ⏳ After turning back, `positioning:turn_around_to_face` will become available (if in closeness)
- ⏳ Actor will no longer be able to use `positioning:turn_your_back` until facing state is resolved
- ⏳ No conflicts with other positioning actions

## Testing Strategy

### Unit Tests
1. **Action Definition Validation**: Verify JSON schema compliance and required fields
2. **Component Logic**: Test forbidden component prevents action when facing_away exists
3. **Template Rendering**: Verify correct template substitution with target names

### Integration Tests  
1. **Rule Execution**: Test complete action-rule workflow
2. **Component Creation**: Verify `positioning:facing_away` component is created correctly
3. **Event Dispatching**: Verify both perceptible and custom events are dispatched
4. **State Transitions**: Test interaction with related positioning actions

### Edge Cases
1. **Multiple Targets**: Verify action works with multiple potential targets in location
2. **Self-Targeting Prevention**: Ensure actor cannot target themselves
3. **Component Cleanup**: Verify proper handling if component already exists (should not occur due to forbidden component)
4. **Location Changes**: Verify behavior if actor moves locations during action

## Future Enhancements

### Potential Extensions
1. **Multiple Facing Away**: Could modify to allow facing away from multiple entities simultaneously
2. **Emotional Context**: Could integrate with mood/relationship systems for context-aware messaging
3. **Physical Positioning**: Could add visual indicators for facing direction in location descriptions
4. **Scope Variations**: Could create variants for specific relationship contexts (family, romantic, etc.)

## Dependencies

### Required Files
- Action definition file (new)
- Rule definition file (new) 
- Condition definition file (new)
- Existing `positioning:facing_away` component (already exists)

### Schema Dependencies
- `action.schema.json` - for action validation
- `rule.schema.json` - for rule validation  
- `condition.schema.json` - for condition validation
- `component.schema.json` - for component structure (existing)

## Rollback Considerations

### Safe Rollback
- Files are purely additive - removal won't break existing functionality
- No modifications to existing actions or components
- Custom event `positioning:actor_turned_back` is optional - system works without listeners

### Migration Path
- No data migration required
- No breaking changes to existing save files
- Action will simply become unavailable if files are removed

## Implementation Tracking

### Implementation Checklist

**Core Files** (Status: ❌ Not Created)
- [ ] `data/mods/positioning/actions/turn_your_back.action.json`
- [ ] `data/mods/positioning/rules/turn_your_back.rule.json`
- [ ] `data/mods/positioning/conditions/event-is-action-turn-your-back.condition.json`

**Testing** (Status: ❌ Not Implemented)  
- [ ] Unit tests for action definition validation
- [ ] Unit tests for component logic
- [ ] Integration tests for rule execution
- [ ] Integration tests for component creation
- [ ] Integration tests for event dispatching
- [ ] Edge case testing (multiple targets, self-targeting prevention)

**Integration** (Status: ❌ Not Verified)
- [ ] Verify interaction with existing positioning actions
- [ ] Confirm no conflicts with `turn_around` and `turn_around_to_face`
- [ ] Validate scope and component restrictions work correctly
- [ ] Test visual styling consistency

### Development Notes
- Implementation should follow patterns from `kneel_before` (scope) and `turn_around` (component logic)
- Ensure forbidden component logic prevents duplicate state
- Maintain consistency with existing positioning mod visual design
- Custom event `positioning:actor_turned_back` is included for future extensibility

### Progress Updates
_This section should be updated as implementation progresses_

**Current Status**: Planning phase - no implementation started

---

**⚠️ IMPORTANT**: This specification describes a planned feature that does not currently exist in the production code. All technical details are proposals based on analysis of existing similar actions in the positioning mod. This document should be updated to reflect the actual implementation once development begins.