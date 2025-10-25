# ACTDESC-001: Create Activity Description Metadata Schema

## Status
🟡 **Pending**

## Phase
**Phase 1: Foundation** (Week 1)

## Description
Create the `activity:description_metadata` component schema that will be used for dedicated metadata components. This schema defines how activity descriptions are declared and configured through component metadata.

## Background
The activity description system needs a dedicated component type for complex scenarios that require conditional visibility, priority management, and rich metadata. This complements the simpler inline metadata approach for basic activities.

**Reference**: Design document lines 293-388 (Approach 2: Dedicated Metadata Components)

## Objectives
- Create JSON schema for `activity:description_metadata` component
- Define all metadata properties (sourceComponent, descriptionType, verb, template, etc.)
- Add validation rules and property constraints
- Support future extensibility

## Technical Specification

### File to Create
`data/schemas/components/activity/description_metadata.component.json`

### Schema Properties
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "activity:description_metadata",
  "description": "Metadata for generating activity descriptions from related components",
  "dataSchema": {
    "type": "object",
    "required": ["sourceComponent", "descriptionType"],
    "properties": {
      "sourceComponent": {
        "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/componentId"
      },
      "descriptionType": {
        "type": "string",
        "enum": ["template", "verb", "custom", "conditional"]
      },
      "template": { "type": "string" },
      "verb": { "type": "string" },
      "adverb": { "type": "string" },
      "targetRole": { "type": "string", "default": "entityId" },
      "priority": { "type": "integer", "minimum": 0, "maximum": 100, "default": 50 },
      "conditions": {
        "type": "object",
        "properties": {
          "showOnlyIfProperty": { "type": "object" },
          "hideIfTargetHasComponent": { "$ref": "..." },
          "requiredComponents": { "type": "array" }
        }
      },
      "grouping": {
        "type": "object",
        "properties": {
          "groupKey": { "type": "string" },
          "combineWith": { "type": "array" }
        }
      }
    }
  }
}
```

## Acceptance Criteria
- [ ] Schema file created at correct location
- [ ] All required properties defined with correct types
- [ ] Enum values match design specification
- [ ] References to common schema definitions work correctly
- [ ] Default values specified where appropriate
- [ ] Schema validates successfully with AJV
- [ ] Schema includes clear description and property documentation

## Dependencies
- None (foundation ticket)

## Testing Requirements
- Create validation test to ensure schema loads correctly
- Test that valid metadata validates successfully
- Test that invalid metadata is rejected with clear errors
- Test all enum values are accepted
- Test required vs optional properties

## Implementation Notes
1. Follow existing component schema patterns in `data/schemas/components/`
2. Use common schema definitions for reusable types (componentId, namespacedId)
3. Ensure description field clearly explains purpose for mod developers
4. Consider future extensibility when defining structure

## Reference Files
- Existing component schemas: `data/schemas/components/core/*.component.json`
- Common schema definitions: `data/schemas/common.schema.json`
- Design document: `brainstorming/ACTDESC-activity-description-composition-design.md` (lines 293-388)

## Success Metrics
- Schema validates with zero errors
- Can be referenced by other schemas
- Clear validation error messages for developers
- Supports all use cases from design document

## Related Tickets
- **Blocks**: ACTDESC-007 (Dedicated metadata collection)
- **Related**: ACTDESC-002 (Inline metadata pattern)
