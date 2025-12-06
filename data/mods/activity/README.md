# Activity Metadata Patterns

This document explains how to define activity description metadata for components in the Living Narrative Engine. Activity metadata controls how component states are described in activity summaries shown to players.

## Overview

The engine supports **two complementary patterns** for defining activity metadata:

1. **Inline Pattern** - Embed `activityMetadata` directly in component schemas
2. **Dedicated Pattern** - Use separate `activity:description_metadata` components

Both patterns can coexist in the same project. The system uses a hybrid detection strategy to collect metadata from both sources.

## Pattern Selection Guide

### Use Inline Pattern When:

- ✅ **Simple states** - Binary on/off states (kneeling, standing, sitting)
- ✅ **Binary interactions** - Direct entity-to-entity relationships (following, hugging)
- ✅ **Stable activities** - Descriptions that rarely change or need conditions
- ✅ **Single mode** - Component has only one way to be described

### Use Dedicated Pattern When:

- ✅ **Conditional visibility** - Show/hide descriptions based on component properties
- ✅ **Multiple modes** - Different descriptions for different component states
- ✅ **Groupable activities** - Activities that combine with others in display
- ✅ **Complex logic** - Requires `hideIfTargetHasComponent` or `requiredComponents`
- ✅ **Shared metadata** - Multiple components share same description logic

## Inline Pattern

### Basic Structure

Add an optional `activityMetadata` property to your component's `dataSchema`:

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "your_mod:your_component",
  "description": "Component description",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["entityId"],
    "properties": {
      "entityId": {
        "type": "string",
        "pattern": "^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$"
      },
      "activityMetadata": {
        "type": "object",
        "description": "Inline metadata for activity description generation",
        "additionalProperties": false,
        "properties": {
          "shouldDescribeInActivity": {
            "type": "boolean",
            "default": true
          },
          "template": {
            "type": "string",
            "default": "{actor} is doing something with {target}"
          },
          "targetRole": {
            "type": "string",
            "default": "entityId"
          },
          "priority": {
            "type": "integer",
            "minimum": 0,
            "maximum": 100,
            "default": 50
          }
        }
      }
    }
  }
}
```

### Properties

#### `shouldDescribeInActivity`

- **Type**: Boolean
- **Default**: `true`
- **Description**: Whether this component should appear in activity descriptions
- **Example**: Set to `false` to hide internal state components from player view

#### `template`

- **Type**: String
- **Required**: No (but recommended to set default)
- **Description**: Template string with placeholder variables
- **Placeholders**:
  - `{actor}` - Entity that has this component
  - `{target}` - Entity referenced by the `targetRole` property
  - `{verb}` - (Phase 3) Action verb from metadata
  - `{adverb}` - (Phase 3) Adverb modifier from metadata
- **Examples**:
  - `"{actor} is kneeling before {target}"`
  - `"{actor} is following {target}"`
  - `"{actor} is hugging {target}"`

#### `targetRole`

- **Type**: String
- **Default**: `"entityId"`
- **Description**: Property name in component data containing the target entity ID
- **Common Values**:
  - `"entityId"` - Standard entity reference
  - `"partner"` - For relationship components
  - `"leaderId"` - For following/leadership
  - `"embraced_entity_id"` - Custom property names

#### `priority`

- **Type**: Integer (0-100)
- **Default**: `50`
- **Description**: Display priority for ordering activities. Higher values appear first.
- **Guidelines**:
  - **80-100** - High priority: Kissing, combat actions, kneeling, sexual activities
  - **50-79** - Medium priority: Holding hands, hugging, following, sitting
  - **0-49** - Low priority: Waving, glancing, casual interactions

### Complete Examples

#### Simple Positional State

```json
{
  "id": "positioning:kneeling_before",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["entityId"],
    "properties": {
      "entityId": {
        "type": "string",
        "pattern": "^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$"
      },
      "activityMetadata": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "shouldDescribeInActivity": { "type": "boolean", "default": true },
          "template": {
            "type": "string",
            "default": "{actor} is kneeling before {target}"
          },
          "targetRole": { "type": "string", "default": "entityId" },
          "priority": { "type": "integer", "default": 75 }
        }
      }
    }
  }
}
```

#### Binary Interaction

```json
{
  "id": "companionship:following",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["leaderId"],
    "properties": {
      "leaderId": {
        "type": "string",
        "pattern": "^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$"
      },
      "activityMetadata": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "shouldDescribeInActivity": { "type": "boolean", "default": true },
          "template": {
            "type": "string",
            "default": "{actor} is following {target}"
          },
          "targetRole": { "type": "string", "default": "leaderId" },
          "priority": { "type": "integer", "default": 55 }
        }
      }
    }
  }
}
```

#### High Priority Activity

```json
{
  "id": "kissing:kissing",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["partner"],
    "properties": {
      "partner": {
        "type": "string",
        "pattern": "^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$"
      },
      "activityMetadata": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "shouldDescribeInActivity": { "type": "boolean", "default": true },
          "template": {
            "type": "string",
            "default": "{actor} is kissing {target}"
          },
          "targetRole": { "type": "string", "default": "partner" },
          "priority": { "type": "integer", "default": 85 }
        }
      }
    }
  }
}
```

## Dedicated Pattern

For more complex scenarios, use the dedicated `activity:description_metadata` component. See `/data/mods/activity/components/description_metadata.component.json` for the full schema.

### When to Use Dedicated

```json
{
  "id": "activity:description_metadata",
  "data": {
    "sourceComponent": "positioning:kneeling",
    "descriptionType": "conditional",
    "template": "{actor} is kneeling before {target}",
    "priority": 90,
    "conditions": {
      "showOnlyIfProperty": {
        "property": "posture",
        "equals": "kneeling"
      },
      "hideIfTargetHasComponent": "positioning:lying_down",
      "requiredComponents": ["core:actor", "positioning:can_kneel"]
    },
    "grouping": {
      "groupKey": "positional_state",
      "combineWith": ["standing", "sitting", "lying"]
    }
  }
}
```

## Hybrid Detection Strategy

The system automatically detects and merges metadata from both patterns:

1. **Inline Detection** - Scans component data for `activityMetadata` property
2. **Dedicated Detection** - Finds `activity:description_metadata` components with matching `sourceComponent`
3. **Merge Strategy** - Dedicated components take precedence if both exist for the same source component
4. **Priority Ordering** - Activities sorted by priority (high to low) before display

## Best Practices

### ✅ DO

- Use inline pattern for simple, stable descriptions
- Set appropriate priority values based on activity importance
- Provide clear, readable templates
- Use semantic property names for `targetRole`
- Include meaningful descriptions in metadata properties
- Test that `additionalProperties: false` still works with inline metadata

### ❌ DON'T

- Don't use inline pattern for conditional logic (use dedicated instead)
- Don't set priority > 100 or < 0
- Don't forget to specify `targetRole` if using non-standard property names
- Don't overcomplicate templates - keep them simple and readable
- Don't mix naming conventions - stick to camelCase for property names

## Template Placeholder Reference

| Placeholder | Description                       | Example        |
| ----------- | --------------------------------- | -------------- |
| `{actor}`   | Entity with the component         | "Alice"        |
| `{target}`  | Entity from `targetRole` property | "Bob"          |
| `{verb}`    | Phase 3: Action verb              | "kissing"      |
| `{adverb}`  | Phase 3: Modifier                 | "passionately" |

**Note**: `{verb}` and `{adverb}` are planned for Phase 3 implementation.

## Priority Guidelines Table

| Range  | Semantic Level  | Examples                             |
| ------ | --------------- | ------------------------------------ |
| 90-100 | Critical/Urgent | Combat actions, critical states      |
| 80-89  | Very High       | Kissing, kneeling, sexual activities |
| 70-79  | High            | Hugging, embracing, dancing          |
| 60-69  | Medium-High     | Sitting together, holding hands      |
| 50-59  | Medium          | Following, walking with              |
| 40-49  | Medium-Low      | Talking to, looking at               |
| 30-39  | Low             | Waving, gesturing                    |
| 20-29  | Very Low        | Glancing, noticing                   |
| 0-19   | Minimal         | Passive awareness                    |

## Validation

All inline metadata is validated against JSON Schema:

- `shouldDescribeInActivity` must be boolean
- `template` must be string (if provided)
- `targetRole` must be string (if provided)
- `priority` must be integer 0-100 (if provided)
- No additional properties allowed in `activityMetadata` object

## Backward Compatibility

The inline pattern is **fully backward compatible**:

- `activityMetadata` is optional - omit it to exclude from activity descriptions
- Existing components without metadata work unchanged
- Component validation remains strict with `additionalProperties: false`
- System gracefully handles missing metadata

## Implementation Phases

**Phase 1** (Current): Inline metadata pattern foundation
**Phase 2**: Collection and rendering engine
**Phase 3**: Advanced template variables (`{verb}`, `{adverb}`)
**Phase 4**: Conditional logic and grouping extensions

## Related Files

- Schema: `/data/schemas/component.schema.json`
- Dedicated Component: `/data/mods/activity/components/description_metadata.component.json`
- Example: `/data/mods/positioning/components/kneeling_before.component.json`
- Tests: `/tests/unit/schemas/activityDescriptionMetadata.test.js`
- Tests: `/tests/unit/schemas/inlineActivityMetadata.test.js`
