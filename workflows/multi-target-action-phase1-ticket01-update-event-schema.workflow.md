# Ticket 01: Update Event Schema for Multi-Target Support

## Overview

Enhance the `attempt_action.event.json` schema to support multi-target actions while maintaining full backward compatibility with existing single-target events. This is the foundational change that enables the multi-target action system.

## Dependencies

- None (foundational ticket)

## Blocks

- Ticket 02: Create Schema Validation Tests
- Ticket 07: Implement Multi-Target Data Extraction
- All subsequent multi-target implementation tickets

## Priority: Critical

## Estimated Time: 4-6 hours

## Background

The current `attempt_action.event.json` schema only supports single-target actions via the `targetId` field. The specification requires enhancing this schema to support a `targets` object containing multiple named targets while maintaining the legacy `targetId` field for backward compatibility.

## Implementation Details

### 1. Update Event Schema File

**File**: `data/mods/core/events/attempt_action.event.json`

Replace the current schema with the enhanced version:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "id": "core:attempt_action",
  "eventName": "core:attempt_action",
  "description": "Enhanced event for both single and multi-target actions",
  "dataSchema": {
    "type": "object",
    "properties": {
      "eventName": {
        "type": "string",
        "const": "core:attempt_action",
        "description": "Event identifier for action attempts"
      },
      "actorId": {
        "type": "string",
        "description": "ID of the entity performing the action",
        "minLength": 1
      },
      "actionId": {
        "type": "string", 
        "description": "ID of the action being performed",
        "minLength": 1
      },
      "targets": {
        "type": "object",
        "description": "Multi-target structure with named targets",
        "additionalProperties": {
          "type": "string",
          "minLength": 1,
          "description": "Target entity ID"
        },
        "examples": [
          {
            "primary": "entity_123",
            "secondary": "entity_456"
          },
          {
            "person": "alice_789",
            "clothing": "dress_012"
          },
          {
            "item": "knife_345",
            "target": "goblin_678"
          }
        ]
      },
      "targetId": {
        "type": ["string", "null"],
        "description": "Primary target for backward compatibility with legacy rules",
        "minLength": 1
      },
      "originalInput": {
        "type": "string",
        "description": "Original command text entered by user",
        "minLength": 1
      },
      "timestamp": {
        "type": "number",
        "description": "Event creation timestamp",
        "minimum": 0
      }
    },
    "required": ["eventName", "actorId", "actionId", "originalInput"],
    "additionalProperties": false,
    "allOf": [
      {
        "description": "Must have either targets object or legacy targetId",
        "anyOf": [
          { 
            "required": ["targets"],
            "properties": {
              "targets": {
                "type": "object",
                "minProperties": 1
              }
            }
          },
          { 
            "required": ["targetId"],
            "properties": {
              "targetId": {
                "type": "string",
                "minLength": 1
              }
            }
          }
        ]
      },
      {
        "description": "If targets exist, targetId should be primary target",
        "if": {
          "properties": {
            "targets": { 
              "type": "object",
              "minProperties": 1
            }
          },
          "required": ["targets"]
        },
        "then": {
          "properties": {
            "targetId": {
              "type": "string",
              "minLength": 1,
              "description": "Should match primary target when targets object exists"
            }
          },
          "required": ["targetId"]
        }
      }
    ]
  }
}
```

### 2. Add Schema Documentation

Add comprehensive examples and validation rules to the schema:

```json
{
  "examples": [
    {
      "description": "Legacy single-target event (backward compatibility)",
      "data": {
        "eventName": "core:attempt_action",
        "actorId": "actor_123",
        "actionId": "core:follow",
        "targetId": "target_456",
        "originalInput": "follow Alice",
        "timestamp": 1640995200000
      }
    },
    {
      "description": "Multi-target event with item and target",
      "data": {
        "eventName": "core:attempt_action",
        "actorId": "actor_123",
        "actionId": "combat:throw",
        "targets": {
          "item": "knife_789",
          "target": "goblin_012"
        },
        "targetId": "knife_789",
        "originalInput": "throw knife at goblin",
        "timestamp": 1640995200000
      }
    },
    {
      "description": "Multi-target event with person and clothing",
      "data": {
        "eventName": "core:attempt_action",
        "actorId": "actor_123",
        "actionId": "interaction:adjust",
        "targets": {
          "person": "alice_456",
          "clothing": "dress_789"
        },
        "targetId": "alice_456",
        "originalInput": "adjust Alice's red dress",
        "timestamp": 1640995200000
      }
    },
    {
      "description": "Single-target event using targets object",
      "data": {
        "eventName": "core:attempt_action",
        "actorId": "actor_123",
        "actionId": "core:follow",
        "targets": {
          "primary": "target_456"
        },
        "targetId": "target_456",
        "originalInput": "follow Alice",
        "timestamp": 1640995200000
      }
    }
  ]
}
```

### 3. Validation Rules Implementation

The schema implements these validation rules:

1. **Required Fields**: `eventName`, `actorId`, `actionId`, `originalInput` are always required
2. **Target Requirements**: Must have either `targets` object OR `targetId` (not both optional)
3. **Targets Structure**: When present, `targets` must be an object with at least one property
4. **Target Consistency**: When `targets` exists, `targetId` must also exist and should represent the primary target
5. **String Validation**: All string fields must have minimum length of 1 (no empty strings)
6. **Timestamp Validation**: Must be a non-negative number when present

### 4. Backward Compatibility Verification

Ensure these legacy event formats remain valid:

```javascript
// Current legacy format - should continue to validate
const legacyEvent = {
  eventName: 'core:attempt_action',
  actorId: 'actor_123',
  actionId: 'core:follow',
  targetId: 'target_456',
  originalInput: 'follow Alice'
};

// Current legacy format with timestamp - should continue to validate
const legacyEventWithTimestamp = {
  eventName: 'core:attempt_action',
  actorId: 'actor_123',
  actionId: 'core:follow',
  targetId: 'target_456',
  originalInput: 'follow Alice',
  timestamp: 1640995200000
};
```

## Testing Requirements

### 1. Schema Validation Tests

Create test cases for the following scenarios:

```javascript
// Valid cases
const validCases = [
  {
    name: 'Legacy single-target event',
    data: { /* legacy format */ },
    shouldValidate: true
  },
  {
    name: 'Multi-target event with item and target',
    data: { /* multi-target format */ },
    shouldValidate: true
  },
  {
    name: 'Single-target event using targets object',
    data: { /* single target in targets format */ },
    shouldValidate: true
  }
];

// Invalid cases
const invalidCases = [
  {
    name: 'Missing required fields',
    data: { eventName: 'core:attempt_action' },
    shouldValidate: false
  },
  {
    name: 'No targets or targetId',
    data: { 
      eventName: 'core:attempt_action',
      actorId: 'actor_123',
      actionId: 'core:action',
      originalInput: 'test'
    },
    shouldValidate: false
  },
  {
    name: 'Empty targets object',
    data: { 
      eventName: 'core:attempt_action',
      actorId: 'actor_123',
      actionId: 'core:action',
      targets: {},
      originalInput: 'test'
    },
    shouldValidate: false
  },
  {
    name: 'Invalid target ID type',
    data: { 
      eventName: 'core:attempt_action',
      actorId: 'actor_123',
      actionId: 'core:action',
      targets: { primary: 123 },
      targetId: 'valid_id',
      originalInput: 'test'
    },
    shouldValidate: false
  }
];
```

### 2. Performance Requirements

- Schema validation should complete within 5ms for typical events
- Memory usage should not increase by more than 1KB per event
- Validation performance should not degrade with multiple targets

## Success Criteria

1. **Schema Validation**: Enhanced schema validates all test cases correctly
2. **Backward Compatibility**: All existing event formats continue to validate successfully
3. **Multi-Target Support**: New multi-target event formats validate correctly
4. **Documentation**: Schema includes comprehensive examples and documentation
5. **Performance**: No measurable performance regression in validation
6. **Error Messages**: Clear, actionable error messages for invalid events

## Files Modified

- `data/mods/core/events/attempt_action.event.json`

## Files Created

- None (schema update only)

## Validation Steps

1. Run existing event validation tests to ensure no regressions
2. Validate sample legacy events against enhanced schema
3. Validate sample multi-target events against enhanced schema
4. Verify error messages are clear and helpful
5. Test schema with AJV validator used by the engine
6. Measure validation performance before and after changes

## Notes

- This change is purely additive - no existing functionality is removed
- The schema uses JSON Schema draft-07 specification
- All string fields require minimum length to prevent empty string issues
- The `allOf` construct ensures proper validation of both legacy and enhanced formats
- Examples in the schema serve as both documentation and test cases

## Risk Assessment

**Low Risk**: This is a schema-only change that adds optional fields while maintaining all existing required fields and validation rules. The backward compatibility requirements are explicitly tested and validated.

## Next Steps

After this ticket completion:
1. Ticket 02: Create comprehensive validation tests
2. Ticket 03: Add multi-target validation rules
3. Begin command processor enhancement (Phase 2)