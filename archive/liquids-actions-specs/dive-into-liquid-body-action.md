# Dive Into Liquid Body - Action/Rule Specification

## Overview

Create a new action/rule combination that allows actors to intentionally dive into a body of liquid, submerging themselves. Unlike `enter_liquid_body` which leaves the character at the surface, the `dive` action puts them into a submerged state.

## Action Definition

### File Location
`data/mods/liquids/actions/dive_into_liquid_body.action.json`

### Action ID
`liquids:dive_into_liquid_body`

### Template
```
"dive into the {liquidBody}"
```

### Target Configuration
```json
"targets": {
  "primary": {
    "scope": "liquids:liquid_bodies_at_location",
    "placeholder": "liquidBody",
    "description": "Liquid body to dive into"
  }
}
```
Note: Uses the same scope as `enter_liquid_body.action.json`.

### Required Components
```json
"required_components": {
  "actor": []
}
```

### Forbidden Components
Mirror `enter_liquid_body.action.json` exactly:
```json
"forbidden_components": {
  "actor": [
    "sitting-states:sitting_on",
    "deference-states:kneeling_before",
    "bending-states:bending_over",
    "straddling-states:straddling_waist",
    "hugging-states:being_hugged",
    "hugging-states:hugging",
    "positioning:doing_complex_performance",
    "sex-states:fucking_anally",
    "lying-states:lying_on",
    "physical-control-states:being_restrained",
    "physical-control-states:restraining",
    "recovery-states:fallen",
    "liquids-states:in_liquid_body"
  ]
}
```

### Prerequisites
Mirror `enter_liquid_body.action.json` exactly:
```json
"prerequisites": [
  {
    "logic": {
      "condition_ref": "anatomy:actor-can-move"
    },
    "failure_message": "You cannot dive into the liquid body without functioning legs."
  },
  {
    "logic": {
      "isActorLocationLit": ["actor"]
    },
    "failure_message": "It is too dark to see where you are going."
  }
]
```

### Visual Configuration
Use the same "Blighted Moss" visual scheme as other liquid actions:
```json
"visual": {
  "backgroundColor": "#3aaea3",
  "textColor": "#0b1f2a",
  "hoverBackgroundColor": "#5ed0c6",
  "hoverTextColor": "#0b1f2a"
}
```

## Condition Definition

### File Location
`data/mods/liquids/conditions/event-is-action-dive-into-liquid-body.condition.json`

### Condition ID
`liquids:event-is-action-dive-into-liquid-body`

### Content
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "liquids:event-is-action-dive-into-liquid-body",
  "description": "Checks if the event is a dive_into_liquid_body action attempt",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "liquids:dive_into_liquid_body"
    ]
  }
}
```

## Rule Definition

### File Location
`data/mods/liquids/rules/handle_dive_into_liquid_body.rule.json`

### Rule ID
`handle_dive_into_liquid_body`

### Event Type
`core:attempt_action`

### Condition
```json
"condition": {
  "condition_ref": "liquids:event-is-action-dive-into-liquid-body"
}
```

### Rule Actions

#### 1. Get Actor and Liquid Body Names
```json
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
    "result_variable": "liquidBodyName"
  }
}
```

#### 2. Query Actor Position
```json
{
  "type": "QUERY_COMPONENT",
  "parameters": {
    "entity_ref": "actor",
    "component_type": "core:position",
    "result_variable": "actorPosition"
  }
}
```

#### 3. Query Liquid Body Component for Visibility
Reference pattern from `handle_rise_to_surface.rule.json`:
```json
{
  "type": "QUERY_COMPONENT",
  "comment": "Get the visibility property from the liquid body.",
  "parameters": {
    "entity_ref": {
      "entityId": "{event.payload.targetId}"
    },
    "component_type": "liquids:liquid_body",
    "result_variable": "liquidBodyComponent"
  }
},
{
  "type": "SET_VARIABLE",
  "comment": "Store visibility for use in messages.",
  "parameters": {
    "variable_name": "liquidVisibility",
    "value": "{context.liquidBodyComponent.visibility}"
  }
}
```

#### 4. Add State Components
Add `in_liquid_body` component (same as `enter_liquid_body`):
```json
{
  "type": "ADD_COMPONENT",
  "parameters": {
    "entity_ref": "actor",
    "component_type": "liquids-states:in_liquid_body",
    "value": {
      "liquid_body_id": "{event.payload.targetId}"
    }
  }
}
```

Add `submerged` component (this is what differentiates dive from enter):
```json
{
  "type": "ADD_COMPONENT",
  "parameters": {
    "entity_ref": "actor",
    "component_type": "liquids-states:submerged",
    "value": {}
  }
}
```

#### 5. Set Log Message
```json
{
  "type": "SET_VARIABLE",
  "parameters": {
    "variable_name": "logMessage",
    "value": "{context.actorName} dives into the {context.liquidVisibility} liquid of {context.liquidBodyName}."
  }
}
```

#### 6. Regenerate Actor Description
```json
{
  "type": "REGENERATE_DESCRIPTION",
  "parameters": {
    "entity_ref": "actor"
  }
}
```

#### 7. Dispatch Sense-Aware Perceptible Event
Following the pattern from `docs/modding/sense-aware-perception.md`:
```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.actorPosition.locationId}",
    "description_text": "{context.actorName} dives into the {context.liquidVisibility} liquid of {context.liquidBodyName}.",
    "actor_description": "I dive into the {context.liquidVisibility} liquid of {context.liquidBodyName}.",
    "perception_type": "physical.self_action",
    "actor_id": "{event.payload.actorId}",
    "target_id": "{event.payload.targetId}",
    "involved_entities": [],
    "alternate_descriptions": {
      "auditory": "I hear a loud splash as someone dives into a body of liquid.",
      "tactile": "I feel a rush of liquid displacement as someone dives nearby."
    }
  }
}
```

#### 8. Dispatch Success Events and End Turn
```json
{
  "type": "DISPATCH_EVENT",
  "parameters": {
    "eventType": "core:display_successful_action_result",
    "payload": {
      "message": "{context.logMessage}"
    }
  }
},
{
  "type": "DISPATCH_EVENT",
  "parameters": {
    "eventType": "core:action_success",
    "payload": {
      "actionId": "{event.payload.actionId}",
      "actorId": "{event.payload.actorId}",
      "targetId": "{event.payload.targetId}",
      "success": true
    }
  }
},
{
  "type": "END_TURN",
  "parameters": {
    "entityId": "{event.payload.actorId}",
    "success": true
  }
}
```

## Test Requirements

### Action Discovery Tests (High Priority)

**File Location**: `tests/integration/mods/liquids/dive_into_liquid_body_action_discovery.test.js`

Reference pattern: `tests/integration/mods/liquids/enter_liquid_body_action_discovery.test.js`

#### Required Test Suites

##### 1. Action Structure Tests
- `has the expected action ID` - verify ID is `liquids:dive_into_liquid_body`
- `has the expected template` - verify `'dive into the {liquidBody}'`
- `has correct primary target scope configuration` - verify scope is `liquids:liquid_bodies_at_location`
- `has correct placeholder` - verify `liquidBody`
- `uses the Blighted Moss visual scheme` - verify visual configuration matches
- `mirrors enter_liquid_body forbidden components` - verify forbidden_components match exactly
- `has prerequisites for movement capability and lighting` - verify both prerequisites exist
- `has correct failure messages for prerequisites` - verify failure messages

##### 2. Scope Resolution Tests
- `returns liquid bodies at the actor location only` - create liquid bodies in different rooms, verify only same-location returned
- `returns empty when no liquid bodies present` - verify empty result with no liquid bodies
- `does not include non-liquid entities` - create non-liquid entities at location, verify filtered out

##### 3. Action Discoverability Tests
- `is discoverable when a liquid body is at the actor location` - create actor with functioning legs and liquid body at location
- `is not discoverable when no liquid body is present` - verify not in available actions
- `is not discoverable when the actor is already in a liquid body` - add `liquids-states:in_liquid_body` component, verify blocked
- `is not discoverable when actor is sitting` - add `sitting-states:sitting_on`, verify blocked
- `is not discoverable when actor is kneeling` - add `deference-states:kneeling_before`, verify blocked
- `is not discoverable when actor is lying` - add `lying-states:lying_on`, verify blocked
- `is not discoverable when actor is being restrained` - add `physical-control-states:being_restrained`, verify blocked
- `is not discoverable when actor is fallen` - add `recovery-states:fallen`, verify blocked

### Rule Execution Tests (High Priority)

**File Location**: `tests/integration/mods/liquids/dive_into_liquid_body_action.test.js`

Reference pattern: `tests/integration/mods/liquids/enter_liquid_body_action.test.js`

#### Required Test Cases

##### 1. Component State Changes
- `adds in_liquid_body component with correct liquid_body_id` - verify component added with target ID
- `adds submerged component` - verify submerged component added (this is the key differentiation)
- `dispatches sense-aware success events` - verify perceptible event dispatched

##### 2. Event Payload Validation
- `description_text includes visibility` - verify `{context.liquidVisibility}` resolved
- `description_text includes liquid body name` - verify `{context.liquidBodyName}` resolved
- `actor_description uses first-person` - verify "I dive into..."
- `alternate_descriptions includes auditory fallback` - verify auditory text present
- `alternate_descriptions includes tactile fallback` - verify tactile text present
- `perception_type is physical.self_action` - verify correct perception type

##### 3. Turn Ending
- `ends turn with success` - verify END_TURN dispatched with success: true

### Rule Structure Tests (Medium Priority)

**File Location**: `tests/integration/mods/liquids/dive_into_liquid_body_rule_execution.test.js`

Reference pattern: `tests/integration/mods/liquids/rise_to_surface_rule_execution.test.js`

#### Required Test Cases

##### 1. Rule Registration
- `registers rule and condition correctly` - verify rule_id, event_type, condition_ref

##### 2. Rule Operations Setup
- `sets up actor name retrieval` - verify GET_NAME operation for actor
- `sets up target name retrieval` - verify GET_NAME operation for target
- `sets up position query` - verify QUERY_COMPONENT for core:position
- `sets up liquid body query for visibility` - verify QUERY_COMPONENT for liquids:liquid_body
- `sets visibility variable` - verify SET_VARIABLE for liquidVisibility

##### 3. State Modification Operations
- `adds in_liquid_body component` - verify ADD_COMPONENT for liquids-states:in_liquid_body
- `adds submerged component` - verify ADD_COMPONENT for liquids-states:submerged
- `operation order is correct` - verify ADD_COMPONENT before REGENERATE_DESCRIPTION

##### 4. Perceptible Event Configuration
- `dispatches perceptible event with correct parameters` - verify all DISPATCH_PERCEPTIBLE_EVENT parameters
- `includes visibility in description_text` - verify `{context.liquidVisibility}` placeholder
- `uses physical.self_action perception type` - verify perception_type

## Manifest Update

Add the new files to `data/mods/liquids/mod-manifest.json`:
- `actions/dive_into_liquid_body.action.json`
- `conditions/event-is-action-dive-into-liquid-body.condition.json`
- `rules/handle_dive_into_liquid_body.rule.json`

## Summary of Differences from enter_liquid_body

| Aspect | enter_liquid_body | dive_into_liquid_body |
|--------|-------------------|----------------------|
| Template | "enter the {liquidBody}" | "dive into the {liquidBody}" |
| Submerged State | Not added | Adds `liquids-states:submerged` |
| Message | "{actor} enters the {liquidBody}" | "{actor} dives into the {visibility} liquid of {liquidBody}" |
| Visibility in Message | No | Yes (uses QUERY_COMPONENT pattern) |

## Implementation Notes

1. The action does NOT use chance-based mechanics - diving is always successful
2. The visibility property is retrieved using the same pattern as `handle_rise_to_surface.rule.json`
3. Both `in_liquid_body` and `submerged` components are added in a single rule execution
4. The sense-aware perception event follows Pattern B (Self-Action) from `docs/modding/sense-aware-perception.md`
5. The rule uses inline event dispatching rather than macros to support sense-aware features

## Files to Create

1. `data/mods/liquids/actions/dive_into_liquid_body.action.json`
2. `data/mods/liquids/conditions/event-is-action-dive-into-liquid-body.condition.json`
3. `data/mods/liquids/rules/handle_dive_into_liquid_body.rule.json`
4. `tests/integration/mods/liquids/dive_into_liquid_body_action_discovery.test.js`
5. `tests/integration/mods/liquids/dive_into_liquid_body_action.test.js`
6. `tests/integration/mods/liquids/dive_into_liquid_body_rule_execution.test.js`

## Files to Update

1. `data/mods/liquids/mod-manifest.json` - Add new action, condition, and rule to manifest
