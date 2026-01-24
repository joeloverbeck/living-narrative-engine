# TEMORIAXI-001: Schema Foundation - Add temporal_orientation to Data Schemas

## Status: ✅ COMPLETED

## Summary

Add the `temporal_orientation` axis to the mood component schema and emotion prototypes lookup schema. This is the foundational ticket that enables all subsequent work.

## Priority: Critical | Effort: Low

## Rationale

The `temporal_orientation` axis needs to exist in the schema definitions before any code can reference it. This ticket establishes the single source of truth for the axis definition.

## Files to Touch

| File | Change Type |
|------|-------------|
| `data/mods/core/components/mood.component.json` | **Modify** - Add temporal_orientation property |
| `data/mods/core/lookups/emotion_prototypes.lookup.json` | **Modify** - Add temporal_orientation to weights schema |

## Out of Scope

- **DO NOT** modify `src/constants/moodAffectConstants.js` - that's TEMORIAXI-002
- **DO NOT** modify `src/turns/schemas/llmOutputSchemas.js` - that's TEMORIAXI-003
- **DO NOT** modify `src/domUI/emotionalStatePanel.js` - that's TEMORIAXI-004
- **DO NOT** modify `data/prompts/corePromptText.json` - that's TEMORIAXI-005
- **DO NOT** update any test files - that's TEMORIAXI-006 and TEMORIAXI-007
- **DO NOT** modify any emotion prototype data values (weights/gates) - that's out of scope per spec Section 7

## Implementation Details

### 1. Modify: data/mods/core/components/mood.component.json

#### Change 1.1: Update description (line 4)
```json
// BEFORE:
"description": "Tracks the 10 mood axes that define a character's current affective/regulatory state. Each axis ranges from -100 to +100.",

// AFTER:
"description": "Tracks the 11 mood axes that define a character's current affective/regulatory state. Each axis ranges from -100 to +100.",
```

#### Change 1.2: Add temporal_orientation property after future_expectancy (around line 49)
Insert after the `future_expectancy` property block:
```json
"temporal_orientation": {
  "type": "integer",
  "minimum": -100,
  "maximum": 100,
  "default": 0,
  "description": "Future-focused (+) to past-focused (-). Mental time direction. +100=strongly future-oriented (planning, anticipation), 0=present-focused (flow, mindfulness), -100=strongly past-oriented (reminiscence, rumination, nostalgia)."
},
```

#### Change 1.3: Add to required array (around line 79-90)
Insert `"temporal_orientation"` after `"future_expectancy"` in the required array:
```json
"required": [
  "valence",
  "arousal",
  "agency_control",
  "threat",
  "engagement",
  "future_expectancy",
  "temporal_orientation",
  "self_evaluation",
  "affiliation",
  "inhibitory_control",
  "uncertainty"
],
```

### 2. Modify: data/mods/core/lookups/emotion_prototypes.lookup.json

#### Change 2.1: Add temporal_orientation to weights schema (around line 40-45)
Insert after `future_expectancy` property in `dataSchema.properties.weights.properties`:
```json
"temporal_orientation": {
  "type": "number",
  "minimum": -1,
  "maximum": 1
},
```

## Acceptance Criteria

### Tests That Must Pass
- `npm run validate` passes with no schema errors
- `npm run validate:strict` passes (if available)
- Existing unit tests in `tests/unit/mods/core/lookups/emotionPrototypes.lookup.test.js` continue to pass

### Tests Expected to Fail (Fixed in TEMORIAXI-006)
- `tests/unit/mods/core/components/mood.component.test.js` - Will fail until test fixtures are updated to include `temporal_orientation`

### Invariants That Must Remain True
- All existing mood axes remain functional and unchanged
- The mood component schema still validates existing entity data (default value of 0 handles missing data)
- No existing emotion prototype definitions are broken (they don't require the new weight)
- The `emotion_prototypes.lookup.json` schema allows but does not require `temporal_orientation` in weights

### Manual Verification
After changes:
```bash
npm run validate
```
Should complete with no errors related to mood or emotion_prototypes schemas.

## Dependencies

- None - this is the first ticket in the series

## Downstream Test Impacts

**Note**: After completing this schema change, the following test file will fail until TEMORIAXI-006 is completed:
- `tests/unit/mods/core/components/mood.component.test.js` - Test fixtures need `temporal_orientation` field added

This is expected because the test file explicitly provides all required fields and doesn't use schema defaults. The `emotionPrototypes.lookup.test.js` tests continue to pass because they validate against the weights schema which allows (but doesn't require) `temporal_orientation`.

## Notes

- The default value of `0` (present-focused) is safe for existing saved games
- The emotion prototypes schema uses `additionalProperties: false` for weights, so temporal_orientation MUST be added to the schema to allow prototypes with this weight
- Position of temporal_orientation in required array: after future_expectancy, before self_evaluation (grouping temporal-related axes)

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Schema Changes (As Planned):**
- ✅ `data/mods/core/components/mood.component.json`:
  - Updated description from "10 mood axes" to "11 mood axes"
  - Added `temporal_orientation` property with correct type, range, default, and description
  - Added `temporal_orientation` to required array after `future_expectancy`

- ✅ `data/mods/core/lookups/emotion_prototypes.lookup.json`:
  - Added `temporal_orientation` to weights schema properties

**Ticket Corrections Made During Implementation:**
- 🔧 Fixed incorrect assumption in ticket notes: The schema uses `additionalProperties: false` (not `true` as originally stated in ticket notes line 121)

**Validation Results:**
- ✅ `npm run validate` passes with no errors
- ✅ `emotionPrototypes.lookup.test.js` - 1040 tests pass
- ⚠️ `mood.component.test.js` - 8 tests fail (expected, documented for TEMORIAXI-006)

**No Deviations:** All planned changes were implemented exactly as specified. The only modification to the ticket was correcting the documentation about `additionalProperties` to reflect the actual schema behavior.
