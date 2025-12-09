# Specification: Rinse Wounded Body Part Actions

## Overview

Create two new action/rule combinations for the `first-aid` mod that allow actors to rinse wounded body parts using water sources. Unlike the existing disinfect actions which require items in inventory, these new actions allow using water sources either from the actor's inventory OR from entities at the same location.

## Reference Implementation

The existing disinfect actions serve as the template:
- `data/mods/first-aid/actions/disinfect_wounded_part.action.json` (treating others)
- `data/mods/first-aid/actions/disinfect_my_wounded_part.action.json` (self-treatment)
- `data/mods/first-aid/rules/handle_disinfect_wounded_part.rule.json`
- `data/mods/first-aid/rules/handle_disinfect_my_wounded_part.rule.json`

## New Files to Create

### 1. Component: `first-aid:rinsed`

**File**: `data/mods/first-aid/components/rinsed.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "first-aid:rinsed",
  "description": "Marks a body part that has been rinsed with water and by whom.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "appliedById": {
        "type": "string",
        "minLength": 1,
        "description": "Entity ID of the actor who rinsed the wound."
      },
      "sourceItemId": {
        "type": "string",
        "minLength": 1,
        "description": "Entity ID of the water source used to rinse."
      }
    },
    "required": ["appliedById", "sourceItemId"],
    "additionalProperties": false
  }
}
```

### 2. Scope: Water Sources at Location or in Inventory

**File**: `data/mods/first-aid/scopes/water_sources_available.scope`

This scope should return entities that:
1. Have the `items:liquid_container` component
2. Have `"water"` in their `tags` array
3. Have `currentVolumeMilliliters > 0`
4. Are either:
   - In the actor's inventory (if actor has `items:inventory` component), OR
   - At the same location as the actor (via `core:position.locationId` match)

**Pattern** (based on `items:items_at_location.scope` and `items:disinfectant_liquids_in_inventory.scope`):

```
// Water sources available to the actor (in inventory OR at location)
// Entities with liquid_container component tagged 'water' with volume remaining
first-aid:water_sources_available := (
  actor.components.items:inventory.items[][{"and": [
    {"!!": {"var": "entity.components.items:liquid_container"}},
    {"in": ["water", {"var": "entity.components.items:liquid_container.tags"}]},
    {"<": [0, {"var": "entity.components.items:liquid_container.currentVolumeMilliliters"}]}
  ]}]
  |
  entities(core:position)[][{"and": [
    {"!!": {"var": "entity.components.items:liquid_container"}},
    {"in": ["water", {"var": "entity.components.items:liquid_container.tags"}]},
    {"<": [0, {"var": "entity.components.items:liquid_container.currentVolumeMilliliters"}]},
    {"==": [
      {"var": "entity.components.core:position.locationId"},
      {"var": "actor.components.core:position.locationId"}
    ]}
  ]}]
)
```

**Note**: The union operator `|` combines inventory items with location items. If the actor has no inventory, the first part returns an empty set, and the union still works.

### 3. Action: Rinse Target's Wounded Part (3 targets)

**File**: `data/mods/first-aid/actions/rinse_wounded_part.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "first-aid:rinse_wounded_part",
  "name": "Rinse Wounded Part",
  "description": "Rinse a wounded body part using a water source available at the location or in inventory.",
  "template": "rinse {target}'s {woundedBodyPart} with {waterSource}",
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
    ],
    "secondary": ["first-aid:rinsed"]
  },
  "targets": {
    "primary": {
      "scope": "core:actors_in_location",
      "placeholder": "target",
      "description": "Actor whose wound you are rinsing"
    },
    "secondary": {
      "scope": "first-aid:wounded_target_body_parts",
      "placeholder": "woundedBodyPart",
      "description": "Wounded body part to rinse",
      "contextFrom": "primary"
    },
    "tertiary": {
      "scope": "first-aid:water_sources_available",
      "placeholder": "waterSource",
      "description": "Water source to use for rinsing"
    }
  },
  "visual": {
    "backgroundColor": "#1b5e20",
    "textColor": "#e8f5e9",
    "hoverBackgroundColor": "#2e7d32",
    "hoverTextColor": "#ffffff"
  }
}
```

**Key differences from disinfect_wounded_part**:
- `required_components.actor`: Only `skills:medicine_skill` (NOT `items:inventory`)
- `forbidden_components.secondary`: Uses `first-aid:rinsed` instead of `first-aid:disinfected`
- `targets.tertiary.scope`: Uses new `first-aid:water_sources_available` scope

### 4. Rule: Handle Rinse Wounded Part

**File**: `data/mods/first-aid/rules/handle_rinse_wounded_part.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_rinse_wounded_part",
  "comment": "Applies rinsed status to the targeted wound, logs the action, refreshes descriptions, and ends the turn.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "first-aid:event-is-action-rinse-wounded-part"
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
        "entity_ref": "primary",
        "result_variable": "targetName"
      }
    },
    {
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "secondary",
        "result_variable": "partName"
      }
    },
    {
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "tertiary",
        "result_variable": "waterSourceName"
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
      "parameters": {
        "entity_ref": "secondary",
        "component_type": "first-aid:rinsed",
        "value": {
          "appliedById": "{event.payload.actorId}",
          "sourceItemId": "{event.payload.tertiaryId}"
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
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} rinses {context.targetName}'s wounded {context.partName} with {context.waterSourceName}."
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

### 5. Condition: Event is Rinse Wounded Part

**File**: `data/mods/first-aid/conditions/event-is-action-rinse-wounded-part.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "first-aid:event-is-action-rinse-wounded-part",
  "description": "Checks if the triggering event is the rinse_wounded_part action.",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "first-aid:rinse_wounded_part"
    ]
  }
}
```

### 6. Action: Rinse My Wounded Part (2 targets, self-treatment)

**File**: `data/mods/first-aid/actions/rinse_my_wounded_part.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "first-aid:rinse_my_wounded_part",
  "name": "Rinse My Wounded Part",
  "description": "Rinse one of your wounded body parts using a water source available at the location or in inventory.",
  "template": "rinse my {woundedBodyPart} with {waterSource}",
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
    ],
    "primary": ["first-aid:rinsed"]
  },
  "targets": {
    "primary": {
      "scope": "first-aid:wounded_actor_body_parts",
      "placeholder": "woundedBodyPart",
      "description": "Your wounded body part to rinse"
    },
    "secondary": {
      "scope": "first-aid:water_sources_available",
      "placeholder": "waterSource",
      "description": "Water source to use for rinsing"
    }
  },
  "visual": {
    "backgroundColor": "#1b5e20",
    "textColor": "#e8f5e9",
    "hoverBackgroundColor": "#2e7d32",
    "hoverTextColor": "#ffffff"
  }
}
```

### 7. Rule: Handle Rinse My Wounded Part

**File**: `data/mods/first-aid/rules/handle_rinse_my_wounded_part.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_rinse_my_wounded_part",
  "comment": "Applies rinsed status to the actor's selected wound, logs the action, refreshes descriptions, and ends the turn.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "first-aid:event-is-action-rinse-my-wounded-part"
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
        "entity_ref": "primary",
        "result_variable": "partName"
      }
    },
    {
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "secondary",
        "result_variable": "waterSourceName"
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
      "parameters": {
        "entity_ref": "primary",
        "component_type": "first-aid:rinsed",
        "value": {
          "appliedById": "{event.payload.actorId}",
          "sourceItemId": "{event.payload.secondaryId}"
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
        "value": "{context.actorName} rinses their wounded {context.partName} with {context.waterSourceName}."
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
        "value": "{event.payload.actorId}"
      }
    },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

### 8. Condition: Event is Rinse My Wounded Part

**File**: `data/mods/first-aid/conditions/event-is-action-rinse-my-wounded-part.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "first-aid:event-is-action-rinse-my-wounded-part",
  "description": "Checks if the triggering event is the rinse_my_wounded_part action.",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "first-aid:rinse_my_wounded_part"
    ]
  }
}
```

## Test Suites to Create

### 1. Action Discovery Tests

#### File: `tests/integration/mods/first-aid/rinse_wounded_part_action_discovery.test.js`

Based on `disinfect_wounded_part_action_discovery.test.js`, test the following scenarios:

**Structure tests**:
- `it('has expected structure and visuals')`
- `it('uses the correct scopes and component gates')`

**Discoverability tests**:
- `it('is discoverable when the actor has medicine skill and a wounded target with water available')`
- `it('is discoverable when water source is in actor inventory')`
- `it('is discoverable when water source is at location (not in inventory)')`
- `it('is discoverable when actor has no inventory component but water is at location')`

**Hidden scenarios**:
- `it('is hidden without medicine skill')`
- `it('is hidden when no water source is available')`
- `it('is hidden when the water container is empty')`
- `it('is hidden when the target has no wounded body parts')`
- `it('is hidden when the wounded body part is already rinsed')`
- `it("is hidden when the target's only wounded body part is covered by clothing")`

#### File: `tests/integration/mods/first-aid/rinse_my_wounded_part_action_discovery.test.js`

Similar to `disinfect_my_wounded_part_action_discovery.test.js`:

**Structure tests**:
- `it('has expected structure and visuals')`
- `it('uses the correct scopes and component gates')`

**Discoverability tests**:
- `it('is discoverable when the actor has medicine skill, wounded body part, and water available')`
- `it('is discoverable when water source is in actor inventory')`
- `it('is discoverable when water source is at location (not in inventory)')`
- `it('is discoverable when actor has no inventory component but water is at location')`

**Hidden scenarios**:
- `it('is hidden without medicine skill')`
- `it('is hidden when no water source is available')`
- `it('is hidden when the water container is empty')`
- `it('is hidden when actor has no wounded body parts')`
- `it('is hidden when the wounded body part is already rinsed')`
- `it("is hidden when the actor's wounded body part is covered by clothing")`

### 2. Rule Execution Tests

#### File: `tests/integration/mods/first-aid/handle_rinse_wounded_part_rule.test.js`

Based on `handle_disinfect_wounded_part_rule.test.js`:

**Core functionality**:
- `it('applies rinsed status to the wounded part and logs the action')`
  - Verify `first-aid:rinsed` component added to secondary (wounded body part)
  - Verify log message: `"{actor} rinses {target}'s wounded {woundedBodyPart} with {waterSource}."`
  - Verify perceptible event dispatched with correct fields

**Edge cases**:
- `it('ignores unrelated actions')`
- `it('requests description regeneration for the patient and wounded part')`
- `it('works with water source from inventory')`
- `it('works with water source from location')`

#### File: `tests/integration/mods/first-aid/handle_rinse_my_wounded_part_rule.test.js`

Based on `handle_disinfect_my_wounded_part_rule.test.js`:

**Core functionality**:
- `it('applies rinsed status to the actor wounded part and logs the action')`
  - Verify `first-aid:rinsed` component added to primary (wounded body part)
  - Verify log message: `"{actor} rinses their wounded {woundedBodyPart} with {waterSource}."`
  - Verify perceptible event dispatched

**Edge cases**:
- `it('ignores unrelated actions')`
- `it('requests description regeneration for the actor and wounded part')`
- `it('works with water source from inventory')`
- `it('works with water source from location')`

## Test Implementation Pattern

Use the established ModTestFixture pattern:

```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import rinseRule from '../../../../data/mods/first-aid/rules/handle_rinse_wounded_part.rule.json' assert { type: 'json' };
import rinseCondition from '../../../../data/mods/first-aid/conditions/event-is-action-rinse-wounded-part.condition.json' assert { type: 'json' };

// ... test implementation following the disinfect test patterns
```

**Helper function for water source**:
```javascript
const buildWaterContainer = (overrides = {}) => ({
  currentVolumeMilliliters: 500,
  maxCapacityMilliliters: 1000,
  servingSizeMilliliters: 100,
  isRefillable: true,
  flavorText: 'Clean water.',
  tags: ['water'],
  ...overrides,
});
```

**Scope resolver registration** (for action discovery tests):
Include resolver for `first-aid:water_sources_available` that:
1. Checks actor inventory for water-tagged liquid containers
2. Checks entities at location for water-tagged liquid containers
3. Returns union of both sets

## Summary of Files

### New Files (10 total)

| File | Type | Description |
|------|------|-------------|
| `data/mods/first-aid/components/rinsed.component.json` | Component | Marker for rinsed body parts |
| `data/mods/first-aid/scopes/water_sources_available.scope` | Scope | Water sources in inventory OR at location |
| `data/mods/first-aid/actions/rinse_wounded_part.action.json` | Action | Rinse target's wounded part (3 targets) |
| `data/mods/first-aid/actions/rinse_my_wounded_part.action.json` | Action | Rinse own wounded part (2 targets) |
| `data/mods/first-aid/rules/handle_rinse_wounded_part.rule.json` | Rule | Handler for rinse_wounded_part |
| `data/mods/first-aid/rules/handle_rinse_my_wounded_part.rule.json` | Rule | Handler for rinse_my_wounded_part |
| `data/mods/first-aid/conditions/event-is-action-rinse-wounded-part.condition.json` | Condition | Event matcher for rinse_wounded_part |
| `data/mods/first-aid/conditions/event-is-action-rinse-my-wounded-part.condition.json` | Condition | Event matcher for rinse_my_wounded_part |
| `tests/integration/mods/first-aid/rinse_wounded_part_action_discovery.test.js` | Test | Action discovery tests (treating others) |
| `tests/integration/mods/first-aid/rinse_my_wounded_part_action_discovery.test.js` | Test | Action discovery tests (self-treatment) |
| `tests/integration/mods/first-aid/handle_rinse_wounded_part_rule.test.js` | Test | Rule execution tests (treating others) |
| `tests/integration/mods/first-aid/handle_rinse_my_wounded_part_rule.test.js` | Test | Rule execution tests (self-treatment) |

## Validation Checklist

After implementation, verify:

1. [ ] `npm run validate` passes
2. [ ] `npm run test:unit` passes
3. [ ] `npm run test:integration -- tests/integration/mods/first-aid/` passes
4. [ ] `npm run scope:lint` passes (validates scope DSL syntax)
5. [ ] Actions are discoverable in-game when conditions are met
6. [ ] Actions are hidden when any required condition is not met
7. [ ] Rules correctly apply `first-aid:rinsed` component
8. [ ] Log messages use correct format with all placeholders resolved
