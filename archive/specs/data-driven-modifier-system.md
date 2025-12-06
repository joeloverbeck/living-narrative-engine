# Data-Driven Modifier System for Non-Deterministic Actions

## Executive Summary

This specification defines a fully data-driven modifier system for chance-based (non-deterministic) actions. The system allows modders to declare conditional modifiers entirely through JSON data files, where each modifier:

- Specifies a condition based on component presence or property values
- Applies a difficulty modifier (flat or percentage)
- Displays a tag in the action template when active

**Example Output**: `"restrain Vespera Nightwhisper (55% chance) [target restrained] [dark environment]"`

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Requirements](#2-requirements)
3. [Schema Design](#3-schema-design)
4. [Evaluation Context](#4-evaluation-context)
5. [Modifier Examples](#5-modifier-examples)
6. [Tag Display Format](#6-tag-display-format)
7. [Complete Action Example](#7-complete-action-example)
8. [Implementation Architecture](#8-implementation-architecture)
9. [Edge Cases and Constraints](#9-edge-cases-and-constraints)
10. [Testing Considerations](#10-testing-considerations)
11. [Implementation Notes](#11-implementation-notes)

---

## 1. Current State Analysis

### 1.1 Existing Infrastructure

The codebase already has partial infrastructure for modifiers:

**Schema** (`data/schemas/action.schema.json`, lines 35-54):

```json
"chanceModifier": {
  "type": "object",
  "description": "Conditional modifier to action success probability",
  "properties": {
    "condition": {
      "$ref": "./condition-container.schema.json#",
      "description": "Condition that must be true for modifier to apply"
    },
    "modifier": {
      "type": "integer",
      "description": "Flat modifier to success chance (can be negative)"
    },
    "description": {
      "type": "string",
      "description": "Human-readable description of modifier"
    }
  },
  "required": ["condition", "modifier"],
  "additionalProperties": false
}
```

**Service Stub** (`src/combat/services/ModifierCollectorService.js`):

- Has `#collectActionModifiers()` method returning empty array
- Comment: "In Phase 5, this evaluates JSON Logic conditions on each modifier"
- Dependencies ready: `entityManager`, `logger`

**Available JSON Logic Operators** (`src/logic/jsonLogicCustomOperators.js`):

- `has_component`: Check if entity has a component
- `get_component_value`: Get component property value
- Standard comparison operators (`==`, `>=`, `<=`, etc.)

### 1.2 Gap Analysis

| Gap                                | Required Solution                      |
| ---------------------------------- | -------------------------------------- |
| No `tag` property for display text | Add `tag` to schema                    |
| No modifier type distinction       | Add `type`: `"flat"` or `"percentage"` |
| No per-target role support         | Add `targetRole` property              |
| No `entity.location` context       | Build context with location data       |
| No tag injection in templates      | Add `{tags}` placeholder support       |
| Stub implementation                | Implement condition evaluation         |

### 1.3 Current Chance-Based Actions

Four actions currently use the chance system:

- `physical-control:restrain_target`
- `physical-control:break_free_from_restraint`
- `weapons:swing_at_target`
- `warding:draw_salt_boundary`

None currently use the `modifiers` array.

---

## 2. Requirements

### 2.1 Modifier Condition Sources

Modifiers must be able to check:

| Source               | Description                      | Example Use Case         |
| -------------------- | -------------------------------- | ------------------------ |
| **Actor**            | The entity performing the action | Actor has combat buff    |
| **Primary Target**   | First/main target                | Target is restrained     |
| **Secondary Target** | Second target (if applicable)    | Secondary target is ally |
| **Tertiary Target**  | Third target (if applicable)     | Tertiary target has item |
| **Location**         | Where the actor is located       | Dark environment penalty |

### 2.2 Condition Types

| Check Type                    | Description                       | Example                                                |
| ----------------------------- | --------------------------------- | ------------------------------------------------------ |
| **Component Presence**        | Entity has a specific component   | Target has `positioning:being_restrained`              |
| **Property Value Comparison** | Component property matches value  | Actor's `skills:melee_skill.value >= 50`               |
| **Location Component**        | Location has specific component   | Location has `environment:darkness`                    |
| **Location Property**         | Location component property value | Location's `environment:terrain.surface == "slippery"` |

### 2.3 Modifier Types

| Type           | Description               | Example                        |
| -------------- | ------------------------- | ------------------------------ |
| **Flat**       | Add/subtract fixed amount | `+10` or `-15`                 |
| **Percentage** | Multiply final chance     | `+10%` (1.1x) or `-20%` (0.8x) |

### 2.4 Display Requirements

- Each active modifier displays a **tag** in the action template
- Tag format: `[tag text]` in square brackets
- Multiple tags separated by spaces
- Tags appear after the chance percentage

---

## 3. Schema Design

### 3.1 Enhanced chanceModifier Definition

Replace the current `chanceModifier` definition with:

```json
"chanceModifier": {
  "type": "object",
  "description": "Conditional modifier to action success probability with display tag",
  "properties": {
    "condition": {
      "$ref": "./condition-container.schema.json#",
      "description": "JSON Logic condition determining if modifier applies. Context provides: entity.actor, entity.primary, entity.secondary, entity.tertiary, entity.location"
    },
    "type": {
      "type": "string",
      "enum": ["flat", "percentage"],
      "default": "flat",
      "description": "Modifier type: 'flat' adds/subtracts directly, 'percentage' multiplies final chance"
    },
    "value": {
      "type": "number",
      "description": "Modifier value. For flat: integer added to chance. For percentage: multiplier (e.g., 10 means +10%, -20 means -20%)"
    },
    "tag": {
      "type": "string",
      "minLength": 1,
      "maxLength": 30,
      "description": "Display tag text shown in action template when modifier is active"
    },
    "targetRole": {
      "type": "string",
      "enum": ["actor", "primary", "secondary", "tertiary", "location"],
      "description": "Which entity this modifier primarily evaluates. Used for documentation and potential optimization."
    },
    "description": {
      "type": "string",
      "description": "Human-readable description for documentation, tooltips, and debugging"
    },
    "stackId": {
      "type": "string",
      "description": "Optional grouping ID. Modifiers with same stackId use only the highest value (for flat) or multiply together (for percentage)"
    }
  },
  "required": ["condition", "value", "tag"],
  "additionalProperties": false
}
```

### 3.2 Schema Constraints

| Field        | Constraint                | Rationale                               |
| ------------ | ------------------------- | --------------------------------------- |
| `tag`        | 1-30 characters           | Prevent UI overflow                     |
| `value`      | Number (integer for flat) | Allow decimals for percentage precision |
| `targetRole` | Optional                  | Documentation only, not enforced        |
| `stackId`    | Optional                  | Only needed for advanced stacking rules |

---

## 4. Evaluation Context

### 4.1 Context Structure

The JSON Logic evaluation context provides access to all relevant entities:

```javascript
{
  entity: {
    actor: {
      id: "actor-uuid",
      components: {
        "skills:grappling_skill": { value: 45 },
        "buffs:adrenaline_surge": { active: true, duration: 30 },
        // ... other components
      }
    },
    primary: {
      id: "target-uuid",
      components: {
        "positioning:being_restrained": { restraining_entity_id: "...", consented: false },
        "health:vitality": { current: 25, max: 100 },
        // ... other components
      }
    },
    secondary: null,  // or { id, components } if action has secondary target
    tertiary: null,   // or { id, components } if action has tertiary target
    location: {
      id: "location-uuid",
      components: {
        "environment:darkness": { level: "dim" },
        "environment:terrain": { surface: "slippery", material: "ice" },
        // ... other components
      }
    }
  }
}
```

### 4.2 Context Building

Location is resolved from the actor's `core:position` component:

```javascript
const locationId = entityManager.getComponentData(
  actorId,
  'core:position'
)?.locationId;
```

If no location can be resolved, `entity.location` is `null` and location-based conditions fail gracefully (return false).

### 4.3 Component Access Patterns

**Check if entity has component:**

```json
{
  "has_component": [{ "var": "entity.primary" }, "positioning:being_restrained"]
}
```

**Get component property value:**

```json
{
  "get_component_value": [
    { "var": "entity.actor" },
    "skills:grappling_skill",
    "value"
  ]
}
```

**Compare property value:**

```json
{
  ">=": [
    {
      "get_component_value": [
        { "var": "entity.actor" },
        "skills:melee_skill",
        "value"
      ]
    },
    50
  ]
}
```

---

## 5. Modifier Examples

### 5.1 Target Has Component (Primary Target)

**Use Case**: Target is already restrained, making them easier to control

```json
{
  "condition": {
    "has_component": [
      { "var": "entity.primary" },
      "positioning:being_restrained"
    ]
  },
  "type": "flat",
  "value": 15,
  "tag": "target restrained",
  "targetRole": "primary",
  "description": "Restrained targets are easier to control"
}
```

### 5.2 Actor Has Component

**Use Case**: Actor has a combat buff

```json
{
  "condition": {
    "has_component": [{ "var": "entity.actor" }, "buffs:adrenaline_surge"]
  },
  "type": "flat",
  "value": 10,
  "tag": "adrenaline",
  "targetRole": "actor",
  "description": "Adrenaline surge provides combat bonus"
}
```

### 5.3 Actor Property Value Check

**Use Case**: High skill provides bonus

```json
{
  "condition": {
    ">=": [
      {
        "get_component_value": [
          { "var": "entity.actor" },
          "skills:grappling_skill",
          "value"
        ]
      },
      50
    ]
  },
  "type": "flat",
  "value": 5,
  "tag": "skilled",
  "targetRole": "actor",
  "description": "High grappling skill (50+) provides bonus"
}
```

### 5.4 Target Property Value Check

**Use Case**: Weakened target is easier to restrain

```json
{
  "condition": {
    "<=": [
      {
        "get_component_value": [
          { "var": "entity.primary" },
          "health:vitality",
          "current"
        ]
      },
      25
    ]
  },
  "type": "flat",
  "value": 10,
  "tag": "target weakened",
  "targetRole": "primary",
  "description": "Low health targets (25 or less) are easier to restrain"
}
```

### 5.5 Location Has Component

**Use Case**: Dark environment reduces accuracy

```json
{
  "condition": {
    "has_component": [{ "var": "entity.location" }, "environment:darkness"]
  },
  "type": "flat",
  "value": -10,
  "tag": "dark",
  "targetRole": "location",
  "description": "Darkness makes precision actions harder"
}
```

### 5.6 Location Property Value Check

**Use Case**: Slippery surface affects grappling

```json
{
  "condition": {
    "==": [
      {
        "get_component_value": [
          { "var": "entity.location" },
          "environment:terrain",
          "surface"
        ]
      },
      "slippery"
    ]
  },
  "type": "flat",
  "value": -15,
  "tag": "slippery",
  "targetRole": "location",
  "description": "Slippery terrain makes grappling harder"
}
```

### 5.7 Secondary Target Check

**Use Case**: Secondary target in a multi-target action

```json
{
  "condition": {
    "has_component": [{ "var": "entity.secondary" }, "status:allied"]
  },
  "type": "flat",
  "value": 5,
  "tag": "ally assist",
  "targetRole": "secondary",
  "description": "Allied secondary target provides assistance"
}
```

### 5.8 Percentage Modifier

**Use Case**: Percentage-based combat buff

```json
{
  "condition": {
    "has_component": [{ "var": "entity.actor" }, "buffs:battle_focus"]
  },
  "type": "percentage",
  "value": 20,
  "tag": "focused",
  "targetRole": "actor",
  "description": "Battle focus increases chance by 20%"
}
```

### 5.9 Combined Conditions

**Use Case**: Multiple factors must be present

```json
{
  "condition": {
    "and": [
      {
        "has_component": [{ "var": "entity.primary" }, "positioning:fallen"]
      },
      {
        "not": {
          "has_component": [
            { "var": "entity.location" },
            "environment:cramped_space"
          ]
        }
      }
    ]
  },
  "type": "flat",
  "value": 20,
  "tag": "target prone",
  "targetRole": "primary",
  "description": "Prone targets in open spaces are much easier to restrain"
}
```

### 5.10 Stacking Modifiers

**Use Case**: Only apply the best bonus from same category

```json
{
  "condition": { "has_component": [{ "var": "entity.actor" }, "buffs:minor_strength"] },
  "type": "flat",
  "value": 5,
  "tag": "strength",
  "stackId": "strength_buffs",
  "description": "Minor strength bonus"
},
{
  "condition": { "has_component": [{ "var": "entity.actor" }, "buffs:major_strength"] },
  "type": "flat",
  "value": 15,
  "tag": "strength",
  "stackId": "strength_buffs",
  "description": "Major strength bonus (overrides minor)"
}
```

With same `stackId`, only the highest value modifier applies.

---

## 6. Tag Display Format

### 6.1 Template Syntax

Action templates should include the `{tags}` placeholder:

```json
"template": "restrain {target} ({chance}% chance){tags}"
```

### 6.2 Formatting Rules

| Rule          | Description                                              |
| ------------- | -------------------------------------------------------- |
| **Format**    | Each tag wrapped in square brackets: `[tag text]`        |
| **Separator** | Single space between tags                                |
| **Prefix**    | Single space before first tag (if any)                   |
| **Empty**     | If no modifiers apply, `{tags}` resolves to empty string |
| **Order**     | Tags appear in modifier array order (top to bottom)      |

### 6.3 Output Examples

**No modifiers active:**

```
restrain Vespera Nightwhisper (55% chance)
```

**One modifier active:**

```
restrain Vespera Nightwhisper (70% chance) [target restrained]
```

**Multiple modifiers active:**

```
restrain Vespera Nightwhisper (75% chance) [target restrained] [dark] [slippery]
```

### 6.4 Fallback Behavior

If a template lacks the `{tags}` placeholder but the action has active modifiers, tags should be appended after the closing parenthesis of the chance display.

---

## 7. Complete Action Example

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "physical-control:restrain_target",
  "name": "Restrain Target",
  "description": "Attempt to physically restrain a target, preventing their movement",
  "template": "restrain {target} ({chance}% chance){tags}",
  "generateCombinations": true,

  "required_components": {
    "actor": ["core:actor"],
    "primary": ["core:actor"]
  },

  "forbidden_components": {
    "actor": ["positioning:being_restrained"],
    "primary": []
  },

  "prerequisites": [
    {
      "condition": {
        "!=": [{ "var": "entity.actor.id" }, { "var": "entity.target.id" }]
      },
      "failureMessage": "Cannot restrain yourself"
    }
  ],

  "targets": {
    "primary": {
      "scope": "positioning:close_actors",
      "placeholder": "target"
    }
  },

  "chanceBased": {
    "enabled": true,
    "contestType": "opposed",
    "actorSkill": {
      "component": "skills:grappling_skill",
      "property": "value",
      "default": 10
    },
    "targetSkill": {
      "component": "skills:defense_skill",
      "property": "value",
      "default": 0,
      "targetRole": "primary"
    },
    "formula": "ratio",
    "bounds": {
      "min": 5,
      "max": 95
    },
    "modifiers": [
      {
        "condition": {
          "has_component": [
            { "var": "entity.primary" },
            "positioning:being_restrained"
          ]
        },
        "type": "flat",
        "value": 20,
        "tag": "target restrained",
        "targetRole": "primary",
        "description": "Already restrained targets are much easier to control"
      },
      {
        "condition": {
          "has_component": [{ "var": "entity.primary" }, "positioning:fallen"]
        },
        "type": "flat",
        "value": 15,
        "tag": "target prone",
        "targetRole": "primary",
        "description": "Prone targets are easier to restrain"
      },
      {
        "condition": {
          "<=": [
            {
              "get_component_value": [
                { "var": "entity.primary" },
                "health:vitality",
                "current"
              ]
            },
            25
          ]
        },
        "type": "flat",
        "value": 10,
        "tag": "target weakened",
        "targetRole": "primary",
        "description": "Injured targets are easier to restrain"
      },
      {
        "condition": {
          "has_component": [
            { "var": "entity.location" },
            "environment:darkness"
          ]
        },
        "type": "flat",
        "value": -10,
        "tag": "dark",
        "targetRole": "location",
        "description": "Darkness reduces grappling precision"
      },
      {
        "condition": {
          "==": [
            {
              "get_component_value": [
                { "var": "entity.location" },
                "environment:terrain",
                "surface"
              ]
            },
            "slippery"
          ]
        },
        "type": "flat",
        "value": -15,
        "tag": "slippery",
        "targetRole": "location",
        "description": "Slippery terrain makes grappling harder"
      },
      {
        "condition": {
          "has_component": [{ "var": "entity.actor" }, "buffs:combat_focus"]
        },
        "type": "percentage",
        "value": 10,
        "tag": "focused",
        "targetRole": "actor",
        "description": "Combat focus improves chance by 10%"
      },
      {
        "condition": {
          ">=": [
            {
              "get_component_value": [
                { "var": "entity.actor" },
                "skills:grappling_skill",
                "value"
              ]
            },
            60
          ]
        },
        "type": "flat",
        "value": 5,
        "tag": "expert grappler",
        "targetRole": "actor",
        "description": "Expert grapplers (skill 60+) get a bonus"
      }
    ],
    "outcomes": {
      "criticalSuccessThreshold": 5,
      "criticalFailureThreshold": 95
    }
  },

  "visual": {
    "category": "Physical Control"
  }
}
```

---

## 8. Implementation Architecture

### 8.1 Data Flow

```
Action Definition (JSON)
         │
         │ chanceBased.modifiers[]
         ▼
┌─────────────────────────────┐
│  ModifierContextBuilder     │ (NEW)
│  - Builds evaluation context│
│  - Resolves entity data     │
│  - Resolves location        │
└─────────────────────────────┘
         │
         │ { entity: { actor, primary, secondary, tertiary, location } }
         ▼
┌─────────────────────────────┐
│  ModifierCollectorService   │ (MODIFY)
│  - Evaluates conditions     │
│  - Collects active modifiers│
│  - Extracts tags            │
│  - Applies stacking rules   │
└─────────────────────────────┘
         │
         │ { modifiers: [...], totalFlat, totalPercentage, activeTags: [...] }
         ▼
┌─────────────────────────────┐
│  ProbabilityCalculatorService│ (EXISTS)
│  - Calculates base chance   │
│  - Applies flat modifiers   │
│  - Applies percentage mods  │
│  - Clamps to bounds         │
└─────────────────────────────┘
         │
         │ { finalChance, breakdown: { ..., activeTags } }
         ▼
┌─────────────────────────────┐
│  MultiTargetActionFormatter │ (MODIFY)
│  - Replaces {chance}        │
│  - Replaces {tags}          │
└─────────────────────────────┘
         │
         ▼
"restrain Vespera (75% chance) [target prone] [dark]"
```

### 8.2 Service Responsibilities

| Service                                   | Responsibility                                             |
| ----------------------------------------- | ---------------------------------------------------------- |
| **ModifierContextBuilder** (NEW)          | Build evaluation context with all entity and location data |
| **ModifierCollectorService** (MODIFY)     | Evaluate conditions, collect modifiers, extract tags       |
| **ProbabilityCalculatorService** (EXISTS) | Apply modifiers to chance calculation                      |
| **ChanceCalculationService** (MINOR)      | Pass `activeTags` through result                           |
| **MultiTargetActionFormatter** (MODIFY)   | Support `{tags}` placeholder                               |

### 8.3 Key Files to Modify

| File                                                           | Changes                            |
| -------------------------------------------------------------- | ---------------------------------- |
| `data/schemas/action.schema.json`                              | Extend `chanceModifier` definition |
| `src/combat/services/ModifierCollectorService.js`              | Implement condition evaluation     |
| `src/combat/services/ModifierContextBuilder.js`                | NEW: Build evaluation context      |
| `src/actions/formatters/MultiTargetActionFormatter.js`         | Add `{tags}` support               |
| `src/logic/contextAssembler.js`                                | Add helper for modifier context    |
| `src/combat/services/ChanceCalculationService.js`              | Pass tags in result                |
| `src/dependencyInjection/registrations/combatRegistrations.js` | Register new service               |

---

## 9. Edge Cases and Constraints

### 9.1 Edge Cases

| Case                             | Handling                                                             |
| -------------------------------- | -------------------------------------------------------------------- |
| **Target is null** (self-action) | `entity.primary/secondary/tertiary` is null, conditions return false |
| **Location not resolved**        | `entity.location` is null, location conditions return false          |
| **Component doesn't exist**      | `has_component` returns false, `get_component_value` returns null    |
| **Property doesn't exist**       | `get_component_value` returns null, comparisons fail                 |
| **Invalid condition**            | Log warning, skip modifier (fail gracefully)                         |
| **Extreme modifier values**      | Probability clamped to bounds (min/max)                              |
| **Empty modifiers array**        | No tags displayed, base chance unchanged                             |
| **Duplicate tags**               | Show all tags (even duplicates)                                      |

### 9.2 Value Constraints

| Constraint                | Value         | Rationale                                  |
| ------------------------- | ------------- | ------------------------------------------ |
| Tag max length            | 30 chars      | Prevent UI overflow                        |
| Modifier flat range       | -100 to +100  | Prevent extreme swings                     |
| Modifier percentage range | -90% to +200% | Allow significant but not breaking changes |
| Max modifiers per action  | 20            | Performance consideration                  |

### 9.3 Stacking Rules

**Flat modifiers with same `stackId`:**

- Only the highest positive or lowest negative value applies
- If mixed signs, both highest positive and lowest negative apply

**Percentage modifiers with same `stackId`:**

- Multiply together (e.g., +10% and +20% = 1.1 × 1.2 = 1.32)

**Modifiers without `stackId`:**

- All stack additively (flat) or multiplicatively (percentage)

---

## 10. Testing Considerations

### 10.1 Unit Test Categories

**Condition Evaluation:**

- Component presence: exists vs doesn't exist
- Property value: matches vs doesn't match
- Entity types: actor, primary, secondary, tertiary, location
- Combined conditions: AND, OR, NOT

**Modifier Collection:**

- Single modifier applies
- Multiple modifiers apply
- No modifiers apply
- Mixed flat and percentage modifiers
- Stacking rules with `stackId`

**Tag Extraction:**

- Tags collected correctly
- Order preserved
- Empty tags handled

### 10.2 Integration Test Scenarios

- Full action discovery with active modifiers
- Template formatting with multiple tags
- RESOLVE_OUTCOME with modifiers applied
- End-to-end from action definition to display

### 10.3 Edge Case Tests

- Missing location data
- Null targets
- Invalid JSON Logic conditions
- Extreme modifier values
- Empty modifier arrays

### 10.4 Test File Locations

| Category                       | Location                                                        |
| ------------------------------ | --------------------------------------------------------------- |
| Unit: ModifierCollectorService | `tests/unit/combat/services/ModifierCollectorService.test.js`   |
| Unit: ModifierContextBuilder   | `tests/unit/combat/services/ModifierContextBuilder.test.js`     |
| Integration: Full Pipeline     | `tests/integration/mods/*/modifierEvaluation.test.js`           |
| Schema Validation              | `tests/integration/validation/modifierSchemaValidation.test.js` |

---

## 11. Implementation Notes

### 11.1 Existing Actions

All existing actions continue to work unchanged:

- Actions without `modifiers` array: No change needed
- Templates without `{tags}`: Tags appended after chance if needed

### 11.2 Adding Modifiers to Existing Actions

When ready to add modifiers to existing chance-based actions:

1. Add `modifiers` array with new format entries
2. Update `template` to include `{tags}` placeholder
3. Test that modifiers evaluate and display correctly

Note: No migration needed - this is a greenfield implementation. No existing actions use the `modifiers` array or the old `modifier` property.

---

## Appendix A: JSON Logic Operator Reference

### has_component

Checks if an entity has a specific component.

**Syntax:**

```json
{
  "has_component": [
    <entity_reference>,
    "<component_id>"
  ]
}
```

**Example:**

```json
{
  "has_component": [{ "var": "entity.primary" }, "positioning:being_restrained"]
}
```

### get_component_value

Gets a property value from an entity's component.

**Syntax:**

```json
{
  "get_component_value": [
    <entity_reference>,
    "<component_id>",
    "<property_path>"
  ]
}
```

**Example:**

```json
{
  "get_component_value": [
    { "var": "entity.actor" },
    "skills:grappling_skill",
    "value"
  ]
}
```

### var

Access a context variable.

**Entity References:**

- `entity.actor` - The performing entity
- `entity.primary` - Primary target
- `entity.secondary` - Secondary target
- `entity.tertiary` - Tertiary target
- `entity.location` - Actor's current location

---

## Appendix B: Modifier Type Calculation

### Flat Modifier Application

```
modifiedChance = baseChance + totalFlatModifiers
```

**Example:**

- Base chance: 50%
- Flat modifiers: +10, -5, +15
- Total flat: +20
- Modified: 70%

### Percentage Modifier Application

```
finalChance = modifiedChance × (1 + percentageModifier/100)
```

**Example:**

- Modified chance: 70%
- Percentage modifiers: +20%, -10%
- Multiplier: 1.20 × 0.90 = 1.08
- Final: 70% × 1.08 = 75.6% (rounded to 76%)

### Combined Calculation Order

1. Calculate base chance from skills (ratio/logistic/linear formula)
2. Add all flat modifiers
3. Multiply by all percentage modifiers
4. Clamp to bounds (min/max)

---

## Appendix C: Glossary

| Term                    | Definition                                                         |
| ----------------------- | ------------------------------------------------------------------ |
| **Action**              | A game action defined in JSON that can be performed by entities    |
| **Chance-based**        | Action with success probability determined by skills and modifiers |
| **Component**           | Data attached to an entity (ECS pattern)                           |
| **Flat modifier**       | Direct addition/subtraction to chance                              |
| **JSON Logic**          | Rule engine for evaluating conditions in JSON format               |
| **Percentage modifier** | Multiplier applied to chance                                       |
| **Scope**               | Query that returns entities matching criteria                      |
| **Tag**                 | Display text shown when modifier is active                         |
| **Target role**         | Entity position: primary, secondary, tertiary                      |
