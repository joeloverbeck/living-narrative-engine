# GRA001CHABASGRANECACT-003: Create neck_grabbed Component

## Summary
Create the `neck_grabbed.component.json` file that marks an entity whose neck is currently being grabbed. This is the "passive role" component.

## File List (Files to Touch)

### Files to Create
- `data/mods/grabbing-states/components/neck_grabbed.component.json`

### Files to Modify
- `data/mods/grabbing-states/mod-manifest.json` (add `neck_grabbed.component.json` to `content.components`)

## Out of Scope

**DO NOT modify or touch:**
- `data/mods/grabbing-states/components/grabbing_neck.component.json` (separate ticket)
- Any files in `data/mods/grabbing/`
- `data/game.json`
- Any source code in `src/`
- Any schema files in `data/schemas/`

## Implementation Details

### neck_grabbed.component.json Content

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "grabbing-states:neck_grabbed",
  "description": "Marks an entity whose neck is currently being grabbed by another actor.",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["grabbing_entity_id"],
    "properties": {
      "grabbing_entity_id": {
        "type": "string",
        "description": "The ID of the entity grabbing this actor's neck",
        "pattern": "^([a-zA-Z0-9_]+:[a-zA-Z0-9_-]+|[a-zA-Z0-9_]+)$"
      },
      "consented": {
        "type": "boolean",
        "description": "Whether this entity consents to being grabbed",
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
            "default": "{actor}'s neck is grabbed by {target}"
          },
          "targetRole": {
            "type": "string",
            "default": "grabbing_entity_id"
          },
          "priority": {
            "type": "integer",
            "minimum": 0,
            "maximum": 100,
            "default": 66,
            "description": "Slightly lower than grabbing_neck (70) to keep active role first"
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
- Component ID matches pattern: `grabbing-states:neck_grabbed`
- Component ID namespace (`grabbing-states`) matches the containing mod ID
- Required field is only `grabbing_entity_id` (passive role doesn't need `initiated`)
- `priority` value is 66 (lower than `grabbing_neck` at 70, keeping active role first)
- `targetRole` correctly references the `grabbing_entity_id` field
- No changes to any existing mod functionality
- Entity ID pattern allows both namespaced (`mod:id`) and simple (`id`) formats

## Verification Steps

1. File exists: `data/mods/grabbing-states/components/neck_grabbed.component.json`
2. JSON is syntactically valid
3. `npm run validate` passes
4. Component follows the established pattern from `physical-control-states:being_restrained`
5. `data/mods/grabbing-states/mod-manifest.json` lists `neck_grabbed.component.json` in `content.components`

## Dependencies
- GRA001CHABASGRANECACT-001 (mod structure must exist first)

## Blocked By
- GRA001CHABASGRANECACT-001

## Blocks
- GRA001CHABASGRANECACT-004 (grabbing mod dependency update)
- GRA001CHABASGRANECACT-005 (new action references this component in forbidden_components)
- GRA001CHABASGRANECACT-007 (rule adds this component to target)
- GRA001CHABASGRANECACT-012 (component validation tests)

## Status

Completed.

## Outcome

Created `neck_grabbed.component.json` and updated `grabbing-states` manifest to register it (manifest update was required; original scope assumed it already existed).
