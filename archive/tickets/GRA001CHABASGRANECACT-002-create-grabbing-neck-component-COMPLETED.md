# GRA001CHABASGRANECACT-002: Create grabbing_neck Component

## Summary
Create the `grabbing_neck.component.json` file that marks an actor who is actively grabbing another entity's neck. This is the "active role" component.

## File List (Files to Touch)

### Files to Create
- `data/mods/grabbing-states/components/grabbing_neck.component.json`

### Files to Modify
- `data/mods/grabbing-states/mod-manifest.json` (add components list so the new component is registered)

## Out of Scope

**DO NOT modify or touch:**
- `data/mods/grabbing-states/components/neck_grabbed.component.json` (separate ticket)
- Any files in `data/mods/grabbing/`
- `data/game.json`
- Any source code in `src/`
- Any schema files in `data/schemas/`

## Implementation Details

### grabbing_neck.component.json Content

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "grabbing-states:grabbing_neck",
  "description": "Marks an actor who is actively grabbing another entity's neck, physically controlling them.",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["grabbed_entity_id", "initiated"],
    "properties": {
      "grabbed_entity_id": {
        "type": "string",
        "description": "The ID of the entity whose neck is being grabbed",
        "pattern": "^([a-zA-Z0-9_]+:[a-zA-Z0-9_-]+|[a-zA-Z0-9_]+)$"
      },
      "initiated": {
        "type": "boolean",
        "description": "Whether this entity initiated the grabbing interaction"
      },
      "consented": {
        "type": "boolean",
        "description": "Whether the grabbed entity has consented",
        "default": false
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
            "default": "{actor} is grabbing {target}'s neck"
          },
          "targetRole": {
            "type": "string",
            "default": "grabbed_entity_id"
          },
          "priority": {
            "type": "integer",
            "minimum": 0,
            "maximum": 100,
            "default": 70,
            "description": "Higher than restraining (67) as neck grabbing is more immediately threatening"
          }
        }
      }
    }
  }
}
```

## Acceptance Criteria

### Tests That Must Pass
- `npm run validate` completes without errors
- Component schema validation passes (JSON is valid against component.schema.json)

### Invariants That Must Remain True
- Component ID matches pattern: `grabbing-states:grabbing_neck`
- Component ID namespace (`grabbing-states`) matches the containing mod ID
- Required fields are `grabbed_entity_id` and `initiated`
- `priority` value is 70 (higher than `restraining` at 67)
- `targetRole` correctly references the `grabbed_entity_id` field
- `data/mods/grabbing-states/mod-manifest.json` includes the component in `content.components`
- No changes to any existing mod functionality
- Entity ID pattern allows both namespaced (`mod:id`) and simple (`id`) formats

## Verification Steps

1. File exists: `data/mods/grabbing-states/components/grabbing_neck.component.json`
2. JSON is syntactically valid
3. `npm run validate` passes
4. `data/mods/grabbing-states/mod-manifest.json` lists `grabbing_neck.component.json` under `content.components`
5. Component follows the established pattern from `physical-control-states:restraining`

## Dependencies
- GRA001CHABASGRANECACT-001 (mod structure must exist first)

## Blocked By
- GRA001CHABASGRANECACT-001

## Blocks
- GRA001CHABASGRANECACT-004 (grabbing mod dependency update)
- GRA001CHABASGRANECACT-005 (new action references this component)
- GRA001CHABASGRANECACT-007 (rule adds this component)
- GRA001CHABASGRANECACT-012 (component validation tests)

## Status
Completed

## Outcome
- Added `data/mods/grabbing-states/components/grabbing_neck.component.json` with the specified schema and activity metadata defaults.
- Registered the component in `data/mods/grabbing-states/mod-manifest.json` under `content.components` (the manifest previously had no content entries).
