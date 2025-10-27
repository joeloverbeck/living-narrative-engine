# Activity Metadata Authoring Guide

The system supports two complementary authoring patterns:

1. **Inline metadata** – embed an `activityMetadata` object directly in component schemas.
2. **Dedicated metadata** – use separate `activity:description_metadata` components that map
   back to source components.

Use whichever option matches the complexity of your activity logic. Both patterns can coexist
for the same actor, and the service will merge the resulting metadata set.

## Inline Metadata

Inline metadata is ideal for simple, binary activities that closely follow an existing
component's lifecycle (kneeling, following, hugging, etc.). Add an optional
`activityMetadata` property to the component schema and populate it when the component is
instantiated.

### Schema structure

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "positioning:kneeling_before",
  "dataSchema": {
    "type": "object",
    "required": ["entityId"],
    "properties": {
      "entityId": {
        "type": "string",
        "pattern": "^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$"
      },
      "activityMetadata": {
        "type": "object",
        "description": "Inline metadata for activity description generation",
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

### Field reference

| Field | Description |
| --- | --- |
| `shouldDescribeInActivity` | Toggle visibility without removing metadata. Set to `false` for debugging or hidden states. |
| `template` | Template string with `{actor}`, `{target}`, `{verb}`, `{adverb}` placeholders. |
| `targetRole` | Property on the component data that points to the target entity ID. |
| `priority` | Integer (0-100) used for sorting. Higher values render earlier. |

### Tips

* Add defaults in the schema so mods can omit values safely.
* Use inline metadata when only one activity phrase is possible for the component.
* When toggling visibility at runtime, modify the component data rather than deleting the
  metadata object—caching relies on deterministic shapes.

## Dedicated Metadata Components

Use `activity:description_metadata` when an activity requires conditional logic, multiple
output modes, or grouping rules shared across components. Dedicated metadata decouples the
rendering behaviour from the source component and is discovered by the service at runtime.

### Schema structure

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "activity:description_metadata",
  "dataSchema": {
    "type": "object",
    "required": ["sourceComponent", "descriptionType"],
    "properties": {
      "sourceComponent": {
        "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
      },
      "descriptionType": {
        "type": "string",
        "enum": ["template", "verb", "custom", "conditional"]
      },
      "template": { "type": "string" },
      "verb": { "type": "string" },
      "adverb": { "type": "string" },
      "targetRole": { "type": "string", "default": "entityId" },
      "priority": { "type": "integer", "default": 50 },
      "conditions": {
        "type": "object",
        "properties": {
          "showOnlyIfProperty": {
            "type": "object",
            "properties": {
              "property": { "type": "string" },
              "equals": {}
            }
          },
          "hideIfTargetHasComponent": {
            "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
          },
          "requiredComponents": {
            "type": "array",
            "items": {
              "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
            }
          }
        }
      },
      "grouping": {
        "type": "object",
        "properties": {
          "groupKey": { "type": "string" },
          "combineWith": {
            "type": "array",
            "items": { "type": "string" }
          }
        }
      }
    }
  }
}
```

### Common use cases

* Multiple templates for a single component based on state flags.
* Hiding activities when the target already exposes an equivalent descriptor.
* Grouping related activities (e.g., intimate interactions) into combined phrases.
* Sharing verb/adverb combinations across several components.

### Authoring workflow

1. Create an entity that includes the `activity:description_metadata` component.
2. Point `sourceComponent` to the component the metadata describes.
3. Populate `template`, `verb`, or `descriptionType` specific fields.
4. Configure optional `conditions` and `grouping` blocks for advanced behaviour.
5. Ensure the entity is instantiated when the source component exists (typically via mod
   scripts or data-driven spawn tables).

## Choosing a Pattern

| Requirement | Recommendation |
| --- | --- |
| Single phrase, no conditions | Inline metadata |
| Needs JSON Logic conditions | Dedicated metadata |
| Shared description for multiple components | Dedicated metadata |
| Simple toggleable visibility | Inline metadata |
| Complex grouping or adverb injection | Dedicated metadata |

Most large mods use both: inline metadata for straightforward posture/relationship states
and dedicated metadata for conditional, multi-entity experiences.

## Validation

Add schema tests or rely on the existing validation suites:

* `tests/unit/schemas/inlineActivityMetadata.test.js` verifies inline schema constraints.
* `tests/unit/anatomy/services/activityDescriptionService.test.js` exercises discovery logic
  for both patterns and ensures invalid metadata is ignored gracefully.
