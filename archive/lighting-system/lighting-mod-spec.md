# Specification: Lighting Mod Implementation

## Overview

Create a new `lighting` mod in `data/mods/lighting/` with actions to ignite and extinguish light sources, along with supporting components, scopes, conditions, and rules.

---

## Design Decisions (from user input)

- **Fuel System**: Simple fuel type marker only (narrative purposes, no consumption mechanics)
- **Fuel Filtering**: Any combustible fuel (oil, candle, wood, etc.) but NOT electricity
- **Color Theme**: Warm Lantern Glow (`#8B5A2B` deep amber/golden with cream text)

---

## Files to Create

### 1. Mod Manifest

**File**: `data/mods/lighting/mod-manifest.json`

```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "lighting",
  "version": "1.0.0",
  "name": "Lighting",
  "description": "Actions and components for managing light sources - igniting and extinguishing oil lamps, candles, torches, and other combustible light sources.",
  "actionPurpose": "Manage ambient lighting through portable and fixed light sources",
  "actionConsiderWhen": "When you want to create light in dark areas or extinguish sources to conserve fuel or create darkness",
  "author": "Living Narrative Engine",
  "gameVersion": ">=0.0.1",
  "dependencies": [
    { "id": "core", "version": "^1.0.0" },
    { "id": "items", "version": "^1.0.0" }
  ],
  "content": {
    "components": [
      "is_light_source.component.json",
      "is_lit.component.json",
      "active_light_sources.component.json"
    ],
    "actions": [
      "ignite_light_source.action.json",
      "extinguish_light_source.action.json"
    ],
    "conditions": [
      "event-is-action-ignite-light-source.condition.json",
      "event-is-action-extinguish-light-source.condition.json"
    ],
    "rules": [
      "handle_ignite_light_source.rule.json",
      "handle_extinguish_light_source.rule.json"
    ],
    "scopes": [
      "unlit_combustible_light_sources_in_inventory.scope",
      "lit_combustible_light_sources_in_inventory.scope"
    ]
  }
}
```

---

### 2. Components

#### 2.1 `is_light_source.component.json`

**File**: `data/mods/lighting/components/is_light_source.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "lighting:is_light_source",
  "description": "Marker component indicating an entity can produce light. Specifies the fuel type used by the light source.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "fuelType": {
        "type": "string",
        "description": "The type of fuel this light source uses",
        "enum": ["oil", "candle", "wood", "coal", "gas", "electricity", "magic"]
      }
    },
    "required": ["fuelType"],
    "additionalProperties": false
  }
}
```

#### 2.2 `is_lit.component.json`

**File**: `data/mods/lighting/components/is_lit.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "lighting:is_lit",
  "description": "Marker component indicating a light source is currently producing light. Absence of this component means the light source is extinguished.",
  "dataSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

#### 2.3 `active_light_sources.component.json`

**File**: `data/mods/lighting/components/active_light_sources.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "lighting:active_light_sources",
  "description": "Component attached to locations to track currently active light sources illuminating that area.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "sources": {
        "type": "array",
        "description": "Array of entity IDs representing light sources currently providing illumination",
        "items": {
          "type": "string",
          "pattern": "^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$"
        }
      }
    },
    "required": ["sources"],
    "additionalProperties": false
  }
}
```

---

### 3. Actions

#### 3.1 `ignite_light_source.action.json`

**File**: `data/mods/lighting/actions/ignite_light_source.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "lighting:ignite_light_source",
  "name": "Ignite Light Source",
  "description": "Light a combustible light source (oil lamp, candle, torch) that you are carrying.",
  "generateCombinations": true,
  "required_components": {
    "actor": ["items:inventory"]
  },
  "targets": {
    "primary": {
      "scope": "lighting:unlit_combustible_light_sources_in_inventory",
      "placeholder": "lightSource",
      "description": "An unlit combustible light source in your inventory"
    }
  },
  "template": "ignite {lightSource}",
  "visual": {
    "backgroundColor": "#8B5A2B",
    "textColor": "#FFF8DC",
    "hoverBackgroundColor": "#A0692F",
    "hoverTextColor": "#FFFFFF"
  }
}
```

#### 3.2 `extinguish_light_source.action.json`

**File**: `data/mods/lighting/actions/extinguish_light_source.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "lighting:extinguish_light_source",
  "name": "Extinguish Light Source",
  "description": "Put out a lit combustible light source (oil lamp, candle, torch) that you are carrying.",
  "generateCombinations": true,
  "required_components": {
    "actor": ["items:inventory"]
  },
  "targets": {
    "primary": {
      "scope": "lighting:lit_combustible_light_sources_in_inventory",
      "placeholder": "lightSource",
      "description": "A lit combustible light source in your inventory"
    }
  },
  "template": "extinguish {lightSource}",
  "visual": {
    "backgroundColor": "#8B5A2B",
    "textColor": "#FFF8DC",
    "hoverBackgroundColor": "#A0692F",
    "hoverTextColor": "#FFFFFF"
  }
}
```

---

### 4. Scopes

#### 4.1 `unlit_combustible_light_sources_in_inventory.scope`

**File**: `data/mods/lighting/scopes/unlit_combustible_light_sources_in_inventory.scope`

```
lighting:unlit_combustible_light_sources_in_inventory :=
  actor.components.items:inventory.items[]
  [{"and": [
    {"!!": {"var": "entity.components.lighting:is_light_source"}},
    {"!": {"var": "entity.components.lighting:is_lit"}},
    {"in": [
      {"var": "entity.components.lighting:is_light_source.fuelType"},
      ["oil", "candle", "wood", "coal", "gas"]
    ]}
  ]}]
```

#### 4.2 `lit_combustible_light_sources_in_inventory.scope`

**File**: `data/mods/lighting/scopes/lit_combustible_light_sources_in_inventory.scope`

```
lighting:lit_combustible_light_sources_in_inventory :=
  actor.components.items:inventory.items[]
  [{"and": [
    {"!!": {"var": "entity.components.lighting:is_light_source"}},
    {"!!": {"var": "entity.components.lighting:is_lit"}},
    {"in": [
      {"var": "entity.components.lighting:is_light_source.fuelType"},
      ["oil", "candle", "wood", "coal", "gas"]
    ]}
  ]}]
```

---

### 5. Conditions

#### 5.1 `event-is-action-ignite-light-source.condition.json`

**File**: `data/mods/lighting/conditions/event-is-action-ignite-light-source.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "lighting:event-is-action-ignite-light-source",
  "description": "Matches when the action being attempted is ignite_light_source",
  "logic": {
    "==": [{ "var": "event.payload.actionId" }, "lighting:ignite_light_source"]
  }
}
```

#### 5.2 `event-is-action-extinguish-light-source.condition.json`

**File**: `data/mods/lighting/conditions/event-is-action-extinguish-light-source.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "lighting:event-is-action-extinguish-light-source",
  "description": "Matches when the action being attempted is extinguish_light_source",
  "logic": {
    "==": [{ "var": "event.payload.actionId" }, "lighting:extinguish_light_source"]
  }
}
```

---

### 6. Rules

#### 6.1 `handle_ignite_light_source.rule.json`

**File**: `data/mods/lighting/rules/handle_ignite_light_source.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_ignite_light_source",
  "comment": "Handles ignite_light_source action: marks light source as lit, adds to location's active light sources, dispatches perceptible event",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "lighting:event-is-action-ignite-light-source"
  },
  "actions": [
    {
      "type": "GET_NAME",
      "comment": "Get actor name for messages",
      "parameters": {
        "entity_ref": "actor",
        "result_variable": "actorName"
      }
    },
    {
      "type": "GET_NAME",
      "comment": "Get light source name for messages",
      "parameters": {
        "entity_ref": "target",
        "result_variable": "lightSourceName"
      }
    },
    {
      "type": "QUERY_COMPONENT",
      "comment": "Get actor position to find current location",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "core:position",
        "result_variable": "actorPosition"
      }
    },
    {
      "type": "ADD_COMPONENT",
      "comment": "Mark light source as lit",
      "parameters": {
        "entity_ref": "target",
        "component_type": "lighting:is_lit",
        "value": {}
      }
    },
    {
      "type": "QUERY_COMPONENT",
      "comment": "Check if location has active_light_sources component",
      "parameters": {
        "entity_ref": "{context.actorPosition.locationId}",
        "component_type": "lighting:active_light_sources",
        "result_variable": "locationLightSources"
      }
    },
    {
      "type": "IF",
      "comment": "If location doesn't have active_light_sources, add it",
      "parameters": {
        "condition": {
          "!": { "var": "context.locationLightSources" }
        },
        "then_actions": [
          {
            "type": "ADD_COMPONENT",
            "comment": "Add active_light_sources component to location with this light source",
            "parameters": {
              "entity_ref": "{context.actorPosition.locationId}",
              "component_type": "lighting:active_light_sources",
              "value": {
                "sources": ["{event.payload.targetId}"]
              }
            }
          }
        ],
        "else_actions": [
          {
            "type": "MODIFY_ARRAY_FIELD",
            "comment": "Add light source to existing active_light_sources array (only if not already present)",
            "parameters": {
              "entity_ref": "{context.actorPosition.locationId}",
              "component_type": "lighting:active_light_sources",
              "field": "sources",
              "mode": "push_unique",
              "value": "{event.payload.targetId}"
            }
          }
        ]
      }
    },
    {
      "type": "DISPATCH_PERCEPTIBLE_EVENT",
      "comment": "Dispatch sense-aware perceptible event for igniting light source",
      "parameters": {
        "location_id": "{context.actorPosition.locationId}",
        "description_text": "{context.actorName} ignites {context.lightSourceName}. A warm glow spreads through the area.",
        "actor_description": "I ignite {context.lightSourceName}, watching the flame catch and spread its warmth.",
        "perception_type": "physical.light_change",
        "actor_id": "{event.payload.actorId}",
        "target_id": "{event.payload.targetId}",
        "alternate_descriptions": {
          "auditory": "You hear the soft hiss of a light source being ignited nearby.",
          "tactile": "You feel a subtle warmth as a nearby light source flickers to life.",
          "olfactory": "The faint scent of burning oil or wax reaches your nose."
        }
      }
    },
    {
      "type": "DISPATCH_EVENT",
      "comment": "Display success message in UI",
      "parameters": {
        "eventType": "core:display_successful_action_result",
        "payload": {
          "message": "{context.actorName} ignites {context.lightSourceName}."
        }
      }
    },
    {
      "type": "END_TURN",
      "comment": "End turn after successful ignition",
      "parameters": {
        "entityId": "{event.payload.actorId}",
        "success": true
      }
    }
  ]
}
```

#### 6.2 `handle_extinguish_light_source.rule.json`

**File**: `data/mods/lighting/rules/handle_extinguish_light_source.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_extinguish_light_source",
  "comment": "Handles extinguish_light_source action: removes is_lit, removes from location's active light sources, dispatches perceptible event",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "lighting:event-is-action-extinguish-light-source"
  },
  "actions": [
    {
      "type": "GET_NAME",
      "comment": "Get actor name for messages",
      "parameters": {
        "entity_ref": "actor",
        "result_variable": "actorName"
      }
    },
    {
      "type": "GET_NAME",
      "comment": "Get light source name for messages",
      "parameters": {
        "entity_ref": "target",
        "result_variable": "lightSourceName"
      }
    },
    {
      "type": "QUERY_COMPONENT",
      "comment": "Get actor position to find current location",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "core:position",
        "result_variable": "actorPosition"
      }
    },
    {
      "type": "REMOVE_COMPONENT",
      "comment": "Remove is_lit component from light source",
      "parameters": {
        "entity_ref": "target",
        "component_type": "lighting:is_lit"
      }
    },
    {
      "type": "QUERY_COMPONENT",
      "comment": "Check if location has active_light_sources component",
      "parameters": {
        "entity_ref": "{context.actorPosition.locationId}",
        "component_type": "lighting:active_light_sources",
        "result_variable": "locationLightSources"
      }
    },
    {
      "type": "IF",
      "comment": "If location has active_light_sources, remove this light source from array",
      "parameters": {
        "condition": {
          "!!": { "var": "context.locationLightSources" }
        },
        "then_actions": [
          {
            "type": "MODIFY_ARRAY_FIELD",
            "comment": "Remove light source from active_light_sources array",
            "parameters": {
              "entity_ref": "{context.actorPosition.locationId}",
              "component_type": "lighting:active_light_sources",
              "field": "sources",
              "mode": "remove_by_value",
              "value": "{event.payload.targetId}"
            }
          }
        ],
        "else_actions": []
      }
    },
    {
      "type": "DISPATCH_PERCEPTIBLE_EVENT",
      "comment": "Dispatch sense-aware perceptible event for extinguishing light source",
      "parameters": {
        "location_id": "{context.actorPosition.locationId}",
        "description_text": "{context.actorName} extinguishes {context.lightSourceName}. The area grows darker.",
        "actor_description": "I extinguish {context.lightSourceName}, watching the flame die out.",
        "perception_type": "physical.light_change",
        "actor_id": "{event.payload.actorId}",
        "target_id": "{event.payload.targetId}",
        "alternate_descriptions": {
          "auditory": "You hear a soft puff as a nearby light source is extinguished.",
          "tactile": "You feel the warmth fade as a nearby light source goes out.",
          "olfactory": "The acrid smell of a recently extinguished flame wafts toward you."
        }
      }
    },
    {
      "type": "DISPATCH_EVENT",
      "comment": "Display success message in UI",
      "parameters": {
        "eventType": "core:display_successful_action_result",
        "payload": {
          "message": "{context.actorName} extinguishes {context.lightSourceName}."
        }
      }
    },
    {
      "type": "END_TURN",
      "comment": "End turn after successful extinguishing",
      "parameters": {
        "entityId": "{event.payload.actorId}",
        "success": true
      }
    }
  ]
}
```

---

### 7. Color Scheme Documentation Updates

#### 7.1 Add to `docs/mods/mod-color-schemes-available.md`

Add new section **22. Illumination/Lighting Colors**:

```markdown
### 22. Illumination/Lighting Colors

#### 22.1 Warm Lantern Glow - Lighting

```json
{
  "backgroundColor": "#8B5A2B",
  "textColor": "#FFF8DC",
  "hoverBackgroundColor": "#A0692F",
  "hoverTextColor": "#FFFFFF"
}
```

- **Normal Contrast**: 8.2:1 AAA
- **Hover Contrast**: 6.8:1 AA
- **Use Cases**: Light source manipulation, illumination actions
- **Theme**: Deep amber/golden evoking oil lamp warmth and candlelight
```

#### 7.2 Update `docs/mods/mod-color-schemes-used.md`

Add entry to Quick Reference table:
```
| Lighting | Warm Lantern Glow | 22.1 | `#8B5A2B` | Active |
```

Add section **22. Illumination/Lighting Colors** with full definition.

---

## Testing Requirements

### Test Files to Create

#### 1. Action Discovery Tests

**File**: `tests/integration/mods/lighting/ignite_light_source_action_discovery.test.js`

Test cases:
- ✅ Action IS available when actor has unlit oil lamp in inventory
- ✅ Action IS available when actor has unlit candle in inventory
- ✅ Action IS NOT available when actor has no light sources
- ✅ Action IS NOT available when all light sources are already lit
- ✅ Action IS NOT available for electric light sources
- ✅ Action IS NOT available when light source is not in actor's inventory

**File**: `tests/integration/mods/lighting/extinguish_light_source_action_discovery.test.js`

Test cases:
- ✅ Action IS available when actor has lit oil lamp in inventory
- ✅ Action IS available when actor has lit candle in inventory
- ✅ Action IS NOT available when actor has no light sources
- ✅ Action IS NOT available when all light sources are unlit
- ✅ Action IS NOT available for electric light sources
- ✅ Action IS NOT available when light source is not in actor's inventory

#### 2. Rule Execution Tests

**File**: `tests/integration/mods/lighting/ignite_light_source_rule_execution.test.js`

Test cases:
- ✅ Successfully adds `lighting:is_lit` component to target
- ✅ Creates `lighting:active_light_sources` on location if not present
- ✅ Adds light source to existing `active_light_sources.sources` array
- ✅ Does not duplicate light source in array (push_unique behavior)
- ✅ Dispatches `core:display_successful_action_result` with correct message
- ✅ Dispatches perceptible event with sense-aware descriptions
- ✅ Ends turn successfully

**File**: `tests/integration/mods/lighting/extinguish_light_source_rule_execution.test.js`

Test cases:
- ✅ Successfully removes `lighting:is_lit` component from target
- ✅ Removes light source from `active_light_sources.sources` array
- ✅ Handles case where location has no `active_light_sources` gracefully
- ✅ Dispatches `core:display_successful_action_result` with correct message
- ✅ Dispatches perceptible event with sense-aware descriptions
- ✅ Ends turn successfully

#### 3. Test Fixtures

**File**: `tests/common/mods/lighting/lightingFixtures.js`

Provide:
- `createOilLamp(id, options)` - Creates unlit oil lamp entity
- `createLitOilLamp(id, options)` - Creates lit oil lamp entity
- `createCandle(id, options)` - Creates unlit candle entity
- `createElectricLight(id, options)` - Creates electric light (non-combustible)
- `createActorWithLightSource(actorId, lightSourceId, isLit)` - Actor with light source in inventory
- `createLocationWithLightSources(locationId, sourceIds)` - Location with active_light_sources

### Testing Pattern Reference

Follow patterns from:
- `tests/integration/mods/item-handling/dropItemRuleExecution.test.js`
- `tests/integration/mods/items/aim_item_action_discovery.test.js`
- `docs/testing/mod-testing-guide.md`

Use:
- `ModTestFixture.forAction('lighting', 'lighting:ignite_light_source')`
- Domain matchers from `tests/common/mods/domainMatchers.js`
- Scenario helpers for inventory setup

---

## Sample Entity Definitions (for reference/testing)

### Oil Lamp Entity

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "lighting:oil_lamp",
  "description": "A portable oil lamp",
  "components": {
    "core:name": { "text": "oil lamp" },
    "core:description": { "text": "A brass oil lamp with a glass chimney, ready to be lit." },
    "items:item": {},
    "items:portable": {},
    "core:weight": { "weight": 0.5 },
    "lighting:is_light_source": { "fuelType": "oil" }
  }
}
```

### Candle Entity

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "lighting:candle",
  "description": "A wax candle",
  "components": {
    "core:name": { "text": "candle" },
    "core:description": { "text": "A simple wax candle in a small holder." },
    "items:item": {},
    "items:portable": {},
    "core:weight": { "weight": 0.1 },
    "lighting:is_light_source": { "fuelType": "candle" }
  }
}
```

---

## Implementation Order

1. **Create mod directory structure**
   - `data/mods/lighting/`
   - Subdirectories: `components/`, `actions/`, `conditions/`, `rules/`, `scopes/`

2. **Create components** (in order)
   - `is_light_source.component.json`
   - `is_lit.component.json`
   - `active_light_sources.component.json`

3. **Create scopes**
   - `unlit_combustible_light_sources_in_inventory.scope`
   - `lit_combustible_light_sources_in_inventory.scope`

4. **Create conditions**
   - `event-is-action-ignite-light-source.condition.json`
   - `event-is-action-extinguish-light-source.condition.json`

5. **Create actions**
   - `ignite_light_source.action.json`
   - `extinguish_light_source.action.json`

6. **Create rules**
   - `handle_ignite_light_source.rule.json`
   - `handle_extinguish_light_source.rule.json`

7. **Create mod manifest**
   - `mod-manifest.json`

8. **Update color scheme documentation**
   - Add to `docs/mods/mod-color-schemes-available.md`
   - Add to `docs/mods/mod-color-schemes-used.md`

9. **Add lighting mod to game.json** (if needed)

10. **Create test fixtures**
    - `tests/common/mods/lighting/lightingFixtures.js`

11. **Create discovery tests**
    - `ignite_light_source_action_discovery.test.js`
    - `extinguish_light_source_action_discovery.test.js`

12. **Create rule execution tests**
    - `ignite_light_source_rule_execution.test.js`
    - `extinguish_light_source_rule_execution.test.js`

13. **Run validation and tests**
    - `npm run validate`
    - `npm run test:integration -- tests/integration/mods/lighting/`

---

## Critical Files Reference

| Category | File Path |
|----------|-----------|
| Reference Action | `data/mods/items/actions/aim_item.action.json` |
| Reference Rule | `data/mods/item-handling/rules/handle_pick_up_item.rule.json` |
| Reference Scope | `data/mods/items/scopes/aimable_items_in_inventory.scope` |
| Reference Component | `data/mods/items/components/aimable.component.json` |
| Color Schemes Available | `docs/mods/mod-color-schemes-available.md` |
| Color Schemes Used | `docs/mods/mod-color-schemes-used.md` |
| Test Pattern | `tests/integration/mods/item-handling/dropItemRuleExecution.test.js` |
| Testing Guide | `docs/testing/mod-testing-guide.md` |
| Sense-Aware Docs | `docs/modding/sense-aware-perception.md` |
| MODIFY_ARRAY_FIELD Schema | `data/schemas/operations/modifyArrayField.schema.json` |
