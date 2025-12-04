# HEACALOVE-002: Add health cap properties to anatomy:vital_organ component schema

## Status: ✅ COMPLETED

## Overview
Add `healthCapThreshold` and `healthCapValue` properties to the `anatomy:vital_organ` component schema to enable data-driven vital organ health caps.

## Problem
Critical damage to vital organs (heart, brain, spine) should impose a maximum cap on overall health percentage. Currently there's no mechanism for this. Hardcoding would violate modding-first principles.

## Solution
Extend the existing `anatomy:vital_organ` component with cap properties that the service can read at runtime.

## File to Modify
`data/mods/anatomy/components/vital_organ.component.json`

## Current Schema
```json
{
  "id": "anatomy:vital_organ",
  "dataSchema": {
    "properties": {
      "organType": {
        "type": "string",
        "enum": ["brain", "heart", "spine"]
      },
      "deathMessage": {
        "type": "string"
      }
    },
    "required": ["organType"]
  }
}
```

## Implementation

Add the following properties to the `dataSchema.properties` object:

```json
"healthCapThreshold": {
  "type": "number",
  "description": "When organ health percentage falls below this threshold, apply overall health cap",
  "minimum": 0,
  "maximum": 100,
  "default": 20
},
"healthCapValue": {
  "type": "number",
  "description": "Maximum overall health percentage when organ is critically damaged",
  "minimum": 0,
  "maximum": 100,
  "default": 30
}
```

## Behavior
- When a vital organ's health percentage falls below `healthCapThreshold`, the overall health is capped at `healthCapValue`
- Default behavior: If heart/brain at <20% health, overall health cannot exceed 30%
- Modders can customize per-organ: spine might have threshold 15 and cap 40

## Acceptance Criteria
- [x] Both properties added to component schema
- [x] Schema validates with `npm run validate`
- [x] Both properties have appropriate descriptions
- [x] Default values are reasonable (threshold: 20, cap: 30)
- [x] Both have min/max constraints (0-100)
- [x] Properties are optional (not in `required` array)

## Dependencies
None - this is independent of HEACALOVE-001.

## Follow-up Tickets
- HEACALOVE-003: Service will read these properties
- HEACALOVE-005: Vital organ entities will use these properties

---

## Outcome

### What was planned
- Add two new optional properties (`healthCapThreshold` and `healthCapValue`) to the `anatomy:vital_organ` component schema

### What was actually changed

**Files Modified:**

1. **`data/mods/anatomy/components/vital_organ.component.json`**
   - Added `healthCapThreshold` property with type number, min 0, max 100, default 20
   - Added `healthCapValue` property with type number, min 0, max 100, default 30
   - Both properties have descriptive documentation

2. **`tests/unit/schemas/core-and-anatomy.allComponents.schema.test.js`**
   - Added 16 new tests in a dedicated `describe` block for HEACALOVE-002
   - Tests cover: valid cases (individual properties, both properties, with deathMessage, boundary values)
   - Tests cover: invalid cases (wrong types, out-of-range values)
   - Tests cover: backward compatibility (no health cap properties, deathMessage only)

### Validation Results
- `npm run validate` passes (0 violations across 51 mods)
- All 16 new HEACALOVE-002 schema tests pass
- All 16 existing vital organ integration tests pass
- No breaking changes to public APIs or existing entities

### Deviation from Plan
None - implementation matched the original ticket exactly.
