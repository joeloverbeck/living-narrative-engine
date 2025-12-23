# Specification: Rise to Surface Action

## Overview

This specification describes the implementation of a new action `liquids:rise_to_surface` that allows submerged actors to attempt to rise to the surface of a liquid body. This feature includes:

1. Adding a `visibility` property to the `liquid_body.component.json`
2. Creating a new chance-based action with visibility-based modifiers
3. Creating a corresponding rule with four outcome branches
4. Updating existing entity definitions to use the new visibility property
5. Comprehensive test coverage

## 1. Component Modification: `liquid_body.component.json`

### File Path
`data/mods/liquids/components/liquid_body.component.json`

### Changes Required

Add a new required `visibility` property to the `dataSchema`:

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "liquids:liquid_body",
  "description": "Marker component for entities that represent a body of liquid.",
  "dataSchema": {
    "type": "object",
    "description": "Metadata for a body of liquid, including visibility and connection data.",
    "properties": {
      "visibility": {
        "type": "string",
        "description": "The visual clarity of the liquid body, affecting surfacing difficulty.",
        "enum": ["pristine", "clear", "murky", "opaque"],
        "default": "opaque"
      },
      "connected_liquid_body_ids": {
        "type": "array",
        "description": "Liquid body entity IDs reachable from this body.",
        "uniqueItems": true,
        "default": [],
        "items": {
          "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
        }
      }
    },
    "required": ["visibility"],
    "additionalProperties": false
  }
}
```

## 2. Entity Definition Updates

### Files to Update

All entity definitions that use `liquids:liquid_body` must be updated to include `visibility: "opaque"`:

1. `data/mods/dredgers/entities/definitions/flooded_approach_liquid_body.entity.json`
2. `data/mods/dredgers/entities/definitions/canal_run_segment_a_liquid_body.entity.json`
3. `data/mods/dredgers/entities/definitions/canal_run_segment_b_liquid_body.entity.json`
4. `data/mods/dredgers/entities/definitions/canal_run_segment_c_liquid_body.entity.json`
5. `data/mods/dredgers/entities/instances/flooded_approach_liquid_body.entity.json`
6. `data/mods/dredgers/entities/instances/canal_run_segment_a_liquid_body.entity.json`
7. `data/mods/dredgers/entities/instances/canal_run_segment_b_liquid_body.entity.json`
8. `data/mods/dredgers/entities/instances/canal_run_segment_c_liquid_body.entity.json`

### Example Update

Before:
```json
{
  "liquids:liquid_body": {
    "connected_liquid_body_ids": ["dredgers:canal_run_segment_c_liquid_body_instance"]
  }
}
```

After:
```json
{
  "liquids:liquid_body": {
    "visibility": "opaque",
    "connected_liquid_body_ids": ["dredgers:canal_run_segment_c_liquid_body_instance"]
  }
}
```

## 3. New Action: `rise_to_surface.action.json`

### File Path
`data/mods/liquids/actions/rise_to_surface.action.json`

### Action Specification

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "liquids:rise_to_surface",
  "name": "Rise to Surface",
  "description": "Attempt to rise to the surface from a submerged state.",
  "template": "rise to the surface in the {liquidBody} ({chance}% chance)",
  "generateCombinations": true,
  "required_components": {
    "actor": [
      "liquids-states:in_liquid_body",
      "liquids-states:submerged",
      "skills:mobility_skill"
    ]
  },
  "forbidden_components": {
    "actor": [
      "physical-control-states:being_restrained",
      "physical-control-states:restraining",
      "positioning:fallen"
    ]
  },
  "targets": {
    "primary": {
      "scope": "liquids:liquid_body_actor_is_in",
      "placeholder": "liquidBody",
      "description": "Liquid body to rise to the surface of"
    }
  },
  "prerequisites": [],
  "chanceBased": {
    "enabled": true,
    "contestType": "fixed_difficulty",
    "fixedDifficulty": 50,
    "formula": "linear",
    "actorSkill": {
      "component": "skills:mobility_skill",
      "property": "value",
      "default": 0
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
            "==": [
              {
                "get_component_value": [
                  { "var": "entity.actor.components.liquids-states:in_liquid_body.liquid_body_id" },
                  "liquids:liquid_body",
                  "visibility"
                ]
              },
              "pristine"
            ]
          }
        },
        "type": "flat",
        "value": 10,
        "tag": "liquid pristine",
        "targetRole": "actor",
        "description": "Bonus for pristine liquid visibility"
      },
      {
        "condition": {
          "logic": {
            "==": [
              {
                "get_component_value": [
                  { "var": "entity.actor.components.liquids-states:in_liquid_body.liquid_body_id" },
                  "liquids:liquid_body",
                  "visibility"
                ]
              },
              "clear"
            ]
          }
        },
        "type": "flat",
        "value": 5,
        "tag": "liquid clear",
        "targetRole": "actor",
        "description": "Bonus for clear liquid visibility"
      },
      {
        "condition": {
          "logic": {
            "==": [
              {
                "get_component_value": [
                  { "var": "entity.actor.components.liquids-states:in_liquid_body.liquid_body_id" },
                  "liquids:liquid_body",
                  "visibility"
                ]
              },
              "murky"
            ]
          }
        },
        "type": "flat",
        "value": -5,
        "tag": "liquid murky",
        "targetRole": "actor",
        "description": "Penalty for murky liquid visibility"
      },
      {
        "condition": {
          "logic": {
            "==": [
              {
                "get_component_value": [
                  { "var": "entity.actor.components.liquids-states:in_liquid_body.liquid_body_id" },
                  "liquids:liquid_body",
                  "visibility"
                ]
              },
              "opaque"
            ]
          }
        },
        "type": "flat",
        "value": -10,
        "tag": "liquid opaque",
        "targetRole": "actor",
        "description": "Penalty for opaque liquid visibility"
      }
    ]
  },
  "visual": {
    "backgroundColor": "#3aaea3",
    "textColor": "#0b1f2a",
    "hoverBackgroundColor": "#5ed0c6",
    "hoverTextColor": "#0b1f2a"
  }
}
```

### Notes on Modifiers

The modifiers use `get_component_value` to access the visibility property of the liquid body the actor is currently in. This follows the pattern established in other actions but accesses a property indirectly through the `in_liquid_body` reference.

**Important**: The modifier logic needs to:
1. Get the `liquid_body_id` from the actor's `in_liquid_body` component
2. Look up that entity's `liquids:liquid_body` component
3. Check the `visibility` property value

This may require verification that the `get_component_value` operator supports this nested lookup pattern. If not, an alternative approach using prerequisites with result variables may be needed.

## 4. New Condition: `event-is-action-rise-to-surface.condition.json`

### File Path
`data/mods/liquids/conditions/event-is-action-rise-to-surface.condition.json`

### Condition Specification

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "liquids:event-is-action-rise-to-surface",
  "description": "Checks if the event is for the rise_to_surface action.",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "liquids:rise_to_surface"
    ]
  }
}
```

## 5. New Rule: `handle_rise_to_surface.rule.json`

### File Path
`data/mods/liquids/rules/handle_rise_to_surface.rule.json`

### Rule Specification

The rule handles four outcomes with sense-aware perception events:

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_rise_to_surface",
  "comment": "Handles liquids:rise_to_surface action with chance-based outcomes.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "liquids:event-is-action-rise-to-surface"
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
      "comment": "Get the name of the liquid body (primary target).",
      "parameters": {
        "entity_ref": {
          "entityId": "{event.payload.primaryId}"
        },
        "result_variable": "liquidBodyName"
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
      "type": "QUERY_COMPONENT",
      "comment": "Get the visibility property from the liquid body.",
      "parameters": {
        "entity_ref": {
          "entityId": "{event.payload.primaryId}"
        },
        "component_type": "liquids:liquid_body",
        "result_variable": "liquidBodyComponent"
      }
    },
    {
      "type": "RESOLVE_OUTCOME",
      "comment": "Fixed difficulty contest using mobility_skill vs difficulty 50.",
      "parameters": {
        "actor_skill_component": "skills:mobility_skill",
        "actor_skill_default": 0,
        "difficulty_modifier": 50,
        "formula": "linear",
        "result_variable": "surfaceResult"
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
      "comment": "Store visibility for use in messages.",
      "parameters": {
        "variable_name": "liquidVisibility",
        "value": "{context.liquidBodyComponent.visibility}"
      }
    },
    {
      "type": "IF",
      "comment": "Handle CRITICAL_SUCCESS outcome (1 of 4).",
      "parameters": {
        "condition": {
          "==": [
            { "var": "context.surfaceResult.outcome" },
            "CRITICAL_SUCCESS"
          ]
        },
        "then_actions": [
          {
            "type": "REMOVE_COMPONENT",
            "comment": "Remove submerged state on critical success.",
            "parameters": {
              "entity_ref": "actor",
              "component_type": "liquids-states:submerged"
            }
          },
          {
            "type": "REGENERATE_DESCRIPTION",
            "parameters": {
              "entity_ref": "actor"
            }
          },
          {
            "type": "DISPATCH_PERCEPTIBLE_EVENT",
            "parameters": {
              "location_id": "{context.actorPosition.locationId}",
              "description_text": "{context.actorName} swiftly breaks the surface of the {context.liquidVisibility} liquid of {context.liquidBodyName}.",
              "actor_description": "I swiftly break the surface of the {context.liquidVisibility} liquid of {context.liquidBodyName}.",
              "perception_type": "physical.self_action",
              "actor_id": "{event.payload.actorId}",
              "target_id": "{event.payload.primaryId}",
              "involved_entities": [],
              "alternate_descriptions": {
                "auditory": "I hear a sudden splash as someone breaks the surface of a liquid body.",
                "tactile": "I feel liquid surge as someone bursts to the surface nearby."
              }
            }
          },
          {
            "type": "SET_VARIABLE",
            "parameters": {
              "variable_name": "logMessage",
              "value": "{context.actorName} swiftly breaks the surface of the {context.liquidVisibility} liquid of {context.liquidBodyName}."
            }
          },
          {
            "macro": "core:logSuccessOutcomeAndEndTurn"
          }
        ]
      }
    },
    {
      "type": "IF",
      "comment": "Handle SUCCESS outcome (2 of 4).",
      "parameters": {
        "condition": {
          "==": [
            { "var": "context.surfaceResult.outcome" },
            "SUCCESS"
          ]
        },
        "then_actions": [
          {
            "type": "REMOVE_COMPONENT",
            "comment": "Remove submerged state on success.",
            "parameters": {
              "entity_ref": "actor",
              "component_type": "liquids-states:submerged"
            }
          },
          {
            "type": "REGENERATE_DESCRIPTION",
            "parameters": {
              "entity_ref": "actor"
            }
          },
          {
            "type": "DISPATCH_PERCEPTIBLE_EVENT",
            "parameters": {
              "location_id": "{context.actorPosition.locationId}",
              "description_text": "{context.actorName} rises to the surface of the {context.liquidVisibility} liquid of {context.liquidBodyName}.",
              "actor_description": "I rise to the surface of the {context.liquidVisibility} liquid of {context.liquidBodyName}.",
              "perception_type": "physical.self_action",
              "actor_id": "{event.payload.actorId}",
              "target_id": "{event.payload.primaryId}",
              "involved_entities": [],
              "alternate_descriptions": {
                "auditory": "I hear splashing as someone rises to the surface of a liquid body.",
                "tactile": "I feel liquid ripple as someone surfaces nearby."
              }
            }
          },
          {
            "type": "SET_VARIABLE",
            "parameters": {
              "variable_name": "logMessage",
              "value": "{context.actorName} rises to the surface of the {context.liquidVisibility} liquid of {context.liquidBodyName}."
            }
          },
          {
            "macro": "core:logSuccessOutcomeAndEndTurn"
          }
        ]
      }
    },
    {
      "type": "IF",
      "comment": "Handle FAILURE outcome (3 of 4).",
      "parameters": {
        "condition": {
          "==": [
            { "var": "context.surfaceResult.outcome" },
            "FAILURE"
          ]
        },
        "then_actions": [
          {
            "type": "DISPATCH_PERCEPTIBLE_EVENT",
            "parameters": {
              "location_id": "{context.actorPosition.locationId}",
              "description_text": "{context.actorName} struggles to break the surface of the {context.liquidVisibility} liquid of {context.liquidBodyName}, but barely makes progress.",
              "actor_description": "I struggle to break the surface of the {context.liquidVisibility} liquid of {context.liquidBodyName}, but barely make progress.",
              "perception_type": "physical.self_action",
              "actor_id": "{event.payload.actorId}",
              "target_id": "{event.payload.primaryId}",
              "involved_entities": [],
              "alternate_descriptions": {
                "auditory": "I hear muffled splashing from below the surface of a liquid body.",
                "tactile": "I feel turbulent liquid movements from someone struggling underwater."
              }
            }
          },
          {
            "type": "SET_VARIABLE",
            "parameters": {
              "variable_name": "logMessage",
              "value": "{context.actorName} struggles to break the surface of the {context.liquidVisibility} liquid of {context.liquidBodyName}, but barely makes progress."
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
      "comment": "Handle FUMBLE outcome (4 of 4).",
      "parameters": {
        "condition": {
          "==": [
            { "var": "context.surfaceResult.outcome" },
            "FUMBLE"
          ]
        },
        "then_actions": [
          {
            "type": "DISPATCH_PERCEPTIBLE_EVENT",
            "parameters": {
              "location_id": "{context.actorPosition.locationId}",
              "description_text": "{context.actorName} flounders helplessly in the {context.liquidVisibility} liquid of {context.liquidBodyName}, struggling to surface, and in the panic, inhales liquid.",
              "actor_description": "I flounder helplessly in the {context.liquidVisibility} liquid of {context.liquidBodyName}, struggling to surface, and in the panic, inhale liquid.",
              "perception_type": "physical.self_action",
              "actor_id": "{event.payload.actorId}",
              "target_id": "{event.payload.primaryId}",
              "involved_entities": [],
              "alternate_descriptions": {
                "auditory": "I hear frantic, panicked splashing and gurgling from underwater.",
                "tactile": "I feel chaotic liquid thrashing from someone in distress underwater."
              }
            }
          },
          {
            "type": "SET_VARIABLE",
            "parameters": {
              "variable_name": "logMessage",
              "value": "{context.actorName} flounders helplessly in the {context.liquidVisibility} liquid of {context.liquidBodyName}, struggling to surface, and in the panic, inhales liquid."
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

### Notes on Rule Implementation

1. **Sense-aware perception**: All `DISPATCH_PERCEPTIBLE_EVENT` operations include:
   - `description_text`: Third-person for observers
   - `actor_description`: First-person for the actor
   - `alternate_descriptions.auditory`: Fallback for when observer cannot see
   - `alternate_descriptions.tactile`: Fallback for physical sensation

2. **FUMBLE outcome**: Per requirements, the submerged component is NOT removed on fumble. The "inhales liquid" text is flavor only - no mechanical effect is implemented for inhaling liquid.

3. **No REGENERATE_DESCRIPTION on failure outcomes**: Since the actor remains submerged (state unchanged), description regeneration is not needed for FAILURE and FUMBLE branches.

## 6. Mod Manifest Update

### File Path
`data/mods/liquids/mod-manifest.json`

### Changes Required

Add the new files to the manifest content arrays:

```json
{
  "content": {
    "actions": [
      // ... existing actions ...
      "rise_to_surface.action.json"
    ],
    "conditions": [
      // ... existing conditions ...
      "event-is-action-rise-to-surface.condition.json"
    ],
    "rules": [
      // ... existing rules ...
      "handle_rise_to_surface.rule.json"
    ]
  }
}
```

## 7. Test Requirements

### 7.1 Action Discovery Tests

**File Path**: `tests/integration/mods/liquids/rise_to_surface_action_discovery.test.js`

Tests to implement:

1. **Action structure tests**:
   - Verify action ID, template, and visual scheme
   - Verify chanceBased configuration (fixed_difficulty, 50, mobility_skill)
   - Verify required_components includes `in_liquid_body`, `submerged`, and `mobility_skill`
   - Verify forbidden_components includes `being_restrained`, `restraining`, `fallen`
   - Verify primary target scope is `liquids:liquid_body_actor_is_in`

2. **Modifier structure tests**:
   - Verify four modifiers exist for each visibility value
   - Verify pristine gives +10 flat bonus
   - Verify clear gives +5 flat bonus
   - Verify murky gives -5 flat penalty
   - Verify opaque gives -10 flat penalty

3. **Discovery condition tests**:
   - Action IS discoverable when actor has `in_liquid_body`, `submerged`, and `mobility_skill`
   - Action IS NOT discoverable when actor is not in a liquid body
   - Action IS NOT discoverable when actor is not submerged
   - Action IS NOT discoverable when actor lacks mobility skill
   - Action IS NOT discoverable when actor is being restrained
   - Action IS NOT discoverable when actor is fallen

### 7.2 Rule Execution Tests

**File Path**: `tests/integration/mods/liquids/rise_to_surface_rule_execution.test.js`

Tests to implement:

1. **Rule structure tests**:
   - Verify rule_id, event_type, condition_ref
   - Verify condition is registered and matches action ID
   - Verify manifest includes rule and condition files

2. **Setup operations tests**:
   - Verify GET_NAME retrieves actor and liquid body names
   - Verify QUERY_COMPONENT retrieves position and liquid_body component
   - Verify RESOLVE_OUTCOME uses mobility_skill with fixed difficulty 50
   - Verify visibility is stored in context variable

3. **Outcome branch tests**:
   - Verify four IF branches exist for all outcomes
   - Verify CRITICAL_SUCCESS and SUCCESS remove submerged component
   - Verify FAILURE and FUMBLE do NOT remove submerged component
   - Verify REGENERATE_DESCRIPTION is called only on success outcomes

4. **Perception event tests**:
   - Verify all dispatches include actor_description
   - Verify all dispatches include alternate_descriptions with auditory and tactile
   - Verify perception_type is physical.self_action
   - Verify message text includes visibility placeholder

5. **Turn ending tests**:
   - Verify success outcomes use `core:logSuccessOutcomeAndEndTurn`
   - Verify failure outcomes use `core:logFailureOutcomeAndEndTurn`

### 7.3 Component Schema Tests

**File Path**: `tests/integration/mods/liquids/liquid_body_visibility.test.js`

Tests to implement:

1. **Schema validation tests**:
   - Verify visibility is required in liquid_body component
   - Verify visibility accepts only valid enum values
   - Verify existing entity definitions validate with opaque visibility

2. **Entity update verification**:
   - Verify all dredgers liquid body entities have visibility: "opaque"

### 7.4 Modifier Integration Tests

**File Path**: `tests/integration/mods/liquids/rise_to_surface_modifiers.test.js`

Tests to implement:

1. **Modifier application tests**:
   - Verify pristine visibility applies +10 modifier
   - Verify clear visibility applies +5 modifier
   - Verify murky visibility applies -5 modifier
   - Verify opaque visibility applies -10 modifier

2. **Chance calculation tests** (if feasible):
   - With 50 mobility skill + pristine (+10) = base 50, effective difficulty 40 → higher success chance
   - With 50 mobility skill + opaque (-10) = base 50, effective difficulty 60 → lower success chance

## 8. Implementation Order

1. **Phase 1: Component Update**
   - Modify `liquid_body.component.json` to add visibility property
   - Update all existing entity definitions to include `visibility: "opaque"`

2. **Phase 2: Action Creation**
   - Create `rise_to_surface.action.json`
   - Create `event-is-action-rise-to-surface.condition.json`

3. **Phase 3: Rule Creation**
   - Create `handle_rise_to_surface.rule.json`

4. **Phase 4: Manifest Update**
   - Update `mod-manifest.json` to include new files

5. **Phase 5: Test Implementation**
   - Create action discovery tests
   - Create rule execution tests
   - Create component schema tests
   - Create modifier integration tests

6. **Phase 6: Validation**
   - Run `npm run validate:mod:liquids`
   - Run full test suite
   - Manual testing in game

## 9. Open Questions / Risks

### 9.1 Modifier Logic Verification

The modifier conditions use `get_component_value` to access the visibility of the liquid body the actor is in. This requires:

```json
{
  "get_component_value": [
    { "var": "entity.actor.components.liquids-states:in_liquid_body.liquid_body_id" },
    "liquids:liquid_body",
    "visibility"
  ]
}
```

**Risk**: This assumes `get_component_value` can:
1. Resolve a variable reference to get an entity ID
2. Look up that entity's component
3. Return a specific property

**Mitigation**: Test this pattern with the action discovery tests before full implementation. If it doesn't work, an alternative approach using prerequisites or additional context variables in the rule may be needed.

### 9.2 Existing Entity Validation

**Risk**: If any existing entity definitions fail schema validation after the visibility property becomes required, mod loading will fail.

**Mitigation**: Update all entity definitions atomically as part of Phase 1.

## 10. Success Criteria

- [ ] `liquid_body.component.json` includes required `visibility` enum property
- [ ] All existing liquid body entities have `visibility: "opaque"`
- [ ] `rise_to_surface.action.json` is discoverable when actor is submerged in liquid
- [ ] Action shows visibility-based modifiers in chance display
- [ ] CRITICAL_SUCCESS and SUCCESS outcomes remove submerged component
- [ ] FAILURE and FUMBLE outcomes leave submerged component intact
- [ ] All perception events are sense-aware with appropriate fallbacks
- [ ] All tests pass
- [ ] Mod validation passes (`npm run validate:mod:liquids`)
