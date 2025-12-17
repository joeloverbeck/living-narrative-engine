# SENAWAPEREVE-006: Extend Operation Schemas for Sense Awareness

**Status**: COMPLETED
**Priority**: HIGH
**Effort**: Small
**Completed**: 2025-12-17

## Summary

Extend the `DISPATCH_PERCEPTIBLE_EVENT` and `ADD_PERCEPTION_LOG_ENTRY` operation schemas with new optional fields for alternate descriptions and sense-aware filtering control.

## File list it expects to touch

- **Modify**: `data/schemas/operations/dispatchPerceptibleEvent.schema.json`
- **Modify**: `data/schemas/operations/addPerceptionLogEntry.schema.json`

## Out of scope (must NOT change)

- Handler implementation changes (handled in SENAWAPEREVE-007)
- Using these fields in any rules (handled in SENAWAPEREVE-008)
- Creating example rules
- Any code files
- The common.schema.json (handled in SENAWAPEREVE-001)
- Any other operation schemas

## Acceptance criteria

### Specific tests that must pass

- `npm run validate` passes
- `npm run test:unit -- --testPathPattern="schemas"` passes
- Existing rules using these operations continue to validate

### Invariants that must remain true

- All new fields are optional with sensible defaults
- Default behavior unchanged (backward compatibility)
- Existing rules work without modification
- `additionalProperties: false` still enforced (new fields explicitly defined)

## Implementation details

### dispatchPerceptibleEvent.schema.json additions

Add to `properties`:

```json
"alternate_descriptions": {
  "type": "object",
  "description": "Alternative event descriptions for different sensory contexts",
  "properties": {
    "auditory": {
      "type": "string",
      "description": "Description when perceived through hearing (sounds, speech)"
    },
    "tactile": {
      "type": "string",
      "description": "Description when perceived through touch (vibrations, contact)"
    },
    "olfactory": {
      "type": "string",
      "description": "Description when perceived through smell"
    },
    "limited": {
      "type": "string",
      "description": "Fallback description when primary and specific senses unavailable"
    }
  },
  "additionalProperties": false
},
"sense_aware": {
  "type": "boolean",
  "default": true,
  "description": "When true (default), applies sense-based filtering. When false, all recipients receive the event regardless of sensory state (useful for debugging or special cases)."
}
```

### addPerceptionLogEntry.schema.json additions

Add to `properties` in the `entry` object definition:

```json
"perceivedVia": {
  "type": "string",
  "description": "The sense through which this event was perceived (for debugging)"
},
"originalDescription": {
  "type": "string",
  "description": "The original visual description before sense filtering"
}
```

Also add to top-level parameters to pass through:

```json
"alternate_descriptions": {
  "type": "object",
  "description": "Alternative descriptions passed from dispatch operation"
},
"sense_aware": {
  "type": "boolean",
  "default": true,
  "description": "Whether to apply sense filtering"
}
```

### Validation test cases

After implementation, these should validate:

```json
// Existing rule (no new fields) - should still work
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.locationId}",
    "description_text": "Bob waves.",
    "perception_type": "social.gesture",
    "actor_id": "{context.actorId}"
  }
}

// New rule with alternate descriptions
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.locationId}",
    "description_text": "Bob waves his hand in greeting.",
    "perception_type": "social.gesture",
    "actor_id": "{context.actorId}",
    "alternate_descriptions": {
      "auditory": "You hear rustling fabric as someone gestures nearby.",
      "tactile": "You feel a slight breeze from movement nearby.",
      "limited": "You sense activity nearby."
    }
  }
}

// Rule with sense_aware disabled
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.locationId}",
    "description_text": "The ground shakes.",
    "perception_type": "state.observable_change",
    "actor_id": "{context.actorId}",
    "sense_aware": false
  }
}
```

## Dependencies

- SENAWAPEREVE-001 (senseCategory definition available - conceptual)

## Dependent tickets

- SENAWAPEREVE-007 (handlers interpret these new fields)
- SENAWAPEREVE-008 (example rule uses these fields)

---

## Outcome

### What was planned vs what was implemented

**Planned**: All schema changes as specified in the ticket.

**Implemented**: All schema changes were implemented exactly as planned. No deviations from the original ticket.

### Files modified

1. **`data/schemas/operations/dispatchPerceptibleEvent.schema.json`**
   - Added `alternate_descriptions` object with `auditory`, `tactile`, `olfactory`, and `limited` properties
   - Added `sense_aware` boolean with `default: true`
   - Both fields are optional to maintain backward compatibility

2. **`data/schemas/operations/addPerceptionLogEntry.schema.json`**
   - Added `perceivedVia` and `originalDescription` to the `entry` object properties
   - Added `alternate_descriptions` object at top-level parameters
   - Added `sense_aware` boolean at top-level parameters
   - All fields are optional to maintain backward compatibility

### Tests created

**New test file**: `tests/unit/schemas/senseAwareOperationSchemas.test.js`

17 tests covering:

1. **DISPATCH_PERCEPTIBLE_EVENT schema (9 tests)**
   - Backward compatibility (existing operations without new fields)
   - Full `alternate_descriptions` validation
   - Partial `alternate_descriptions` (auditory only)
   - Olfactory alternate description
   - `sense_aware: true` (explicit default)
   - `sense_aware: false` (bypass filtering)
   - Combined `alternate_descriptions` and `sense_aware`
   - Rejection of additional properties in `alternate_descriptions`
   - Rejection of non-boolean `sense_aware` value

2. **ADD_PERCEPTION_LOG_ENTRY schema (8 tests)**
   - Backward compatibility (existing operations without new fields)
   - Entry with `perceivedVia`
   - Entry with `originalDescription`
   - Entry with both `perceivedVia` and `originalDescription`
   - Top-level `alternate_descriptions`
   - Top-level `sense_aware`
   - All new fields combined
   - Placeholder `recipient_ids` string (existing behavior preserved)

### Validation results

- `npm run validate`: ✅ PASSED
- `npm run test:unit -- --testPathPattern="schemas"`: ✅ PASSED (all 65 test suites, 1354 tests)
- New test file: ✅ PASSED (17/17 tests)

### Ticket assumptions verified

All ticket assumptions were correct:
- `senseCategory` definition already exists in `common.schema.json` (SENAWAPEREVE-001 complete)
- Both operation schemas supported the new fields without conflicts
- `additionalProperties: false` is correctly enforced for `alternate_descriptions` in dispatchPerceptibleEvent
- All new fields are optional, preserving backward compatibility
