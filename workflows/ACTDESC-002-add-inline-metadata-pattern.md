# ACTDESC-002: Add Inline Activity Metadata Pattern

## Status
✅ **Complete**

## Phase
**Phase 1: Foundation** (Week 1)

## Description
Define and document the inline activity metadata pattern that allows existing components to include activity description metadata directly within their component data, without requiring dedicated metadata components.

## Background
For simple activity descriptions, requiring a dedicated metadata component creates unnecessary overhead. The inline pattern allows components like `positioning:kneeling_before` to include description metadata directly in their schema.

**Note**: A dedicated `activity:description_metadata` component already exists in the codebase. This ticket focuses specifically on the **inline pattern**, which is complementary to the dedicated approach. The system will support a hybrid detection strategy (design doc lines 497-527) where both patterns can coexist.

**Reference**: Design document lines 179-284 (Approach 1: Inline Activity Metadata)

## Objectives
- Define standard inline metadata structure
- Create schema fragment for `activityMetadata` property
- Document usage patterns for mod developers
- Provide example implementations

## Technical Specification

### Standard Inline Metadata Structure
```json
{
  "activityMetadata": {
    "type": "object",
    "description": "Metadata for activity description generation",
    "properties": {
      "shouldDescribeInActivity": {
        "type": "boolean",
        "default": true
      },
      "template": {
        "type": "string",
        "description": "Template with {actor} and {target} placeholders"
      },
      "targetRole": {
        "type": "string",
        "default": "entityId",
        "description": "Property containing target entity ID"
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
```

### Example Component Schema Extension
Update one existing component schema (e.g., `positioning:kneeling_before`) to include the inline metadata pattern as an example.

## Acceptance Criteria
- [x] Inline metadata structure clearly defined
- [x] Schema fragment can be included in any component schema
- [x] Example component schema updated with inline metadata
- [x] Documentation explains when to use inline vs dedicated
- [x] Template placeholder syntax documented ({actor}, {target})
- [x] Default values specified appropriately

## Dependencies
- None (can be done in parallel with ACTDESC-001)

## Testing Requirements
**Note**: Tests for the dedicated `activity:description_metadata` pattern already exist in `tests/unit/schemas/activityDescriptionMetadata.test.js`. The following tests are needed specifically for the **inline pattern**:

- Validate that components with inline `activityMetadata` property pass schema validation
- Test that activityMetadata is optional (backward compatibility)
- Test that invalid template formats are rejected
- Verify default values apply correctly
- Ensure components can include inline metadata without breaking existing validation

## Implementation Notes
1. **Decision Matrix** (from design doc lines 488-495):
   - Use **inline** for: Simple states, binary interactions, stable activities
   - Use **dedicated** for: Conditional visibility, multiple modes, groupable activities

2. **Template Syntax**:
   - `{actor}` - Replaced with entity performing the activity
   - `{target}` - Replaced with target entity name
   - `{verb}` - (Phase 3) Replaced with verb from metadata
   - `{adverb}` - (Phase 3) Replaced with adverb modifier

3. **Priority Guidelines** (0-100 range, default: 50):
   - 80-100: High priority - kissing, combat actions, kneeling
   - 50-79: Medium priority - holding hands, hugging, following
   - 0-49: Low priority - waving, glancing, casual interactions

   **Note**: Priority determines rendering order in activity descriptions. Higher priority activities appear first.

## Files to Modify
1. Create documentation: `data/mods/activity/README.md` (note: `data/mods/activity/` directory already exists)
2. Update example schema: `data/mods/positioning/components/kneeling_before.component.json`

**Note**: The dedicated `activity:description_metadata` component schema already exists and can be referenced for consistency.

## Example Implementation
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "positioning:kneeling_before",
  "description": "Tracks which entity the component holder is kneeling before",
  "dataSchema": {
    "type": "object",
    "required": ["entityId"],
    "properties": {
      "entityId": {
        "type": "string",
        "description": "The entity being knelt before"
      },
      "activityMetadata": {
        "type": "object",
        "properties": {
          "shouldDescribeInActivity": { "type": "boolean", "default": true },
          "template": { "type": "string", "default": "{actor} is kneeling before {target}" },
          "targetRole": { "type": "string", "default": "entityId" },
          "priority": { "type": "integer", "default": 75 }
        }
      }
    }
  }
}
```

## Reference Files
- Design document: `brainstorming/ACTDESC-activity-description-composition-design.md` (lines 179-284, 488-609)
- Existing component schemas: `data/mods/*/components/*.component.json`

## Success Metrics
- Clear documentation for mod developers
- Example implementation validates successfully
- Pattern is simple enough for common use cases
- Supports 80% of activity description scenarios

## Implementation Context
**Phase 1 Focus**: This ticket specifically addresses the inline metadata pattern. Phase 2 (dedicated `activity:description_metadata` component) is already partially implemented in the codebase.

**Hybrid Approach**: The system will support both inline and dedicated patterns simultaneously, using the hybrid detection strategy described in design doc lines 497-527. This allows flexibility in how mod developers choose to structure their activity metadata.

## Related Tickets
- **Blocks**: ACTDESC-006 (Inline metadata collection)
- **Related**: ACTDESC-001 (Dedicated metadata schema) - Note: Partially implemented
- **Related**: ACTDESC-023 (Mod developer documentation)
