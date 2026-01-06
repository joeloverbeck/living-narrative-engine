# MOOANDSEXAROSYS-006: LLM Output Schema and Response Processor Extension

## Summary

Extend the LLM output schema to accept optional `moodUpdate` and `sexualUpdate` objects in LLM responses, and update the response processor to extract these fields.

## Files to Touch

### MODIFY

- `src/turns/schemas/llmOutputSchemas.js` - Add moodUpdate and sexualUpdate to schema
- `src/turns/services/LLMResponseProcessor.js` - Extract new fields in #extractData

## Out of Scope

- MoodUpdateWorkflow (processes extracted data) - see MOOANDSEXAROSYS-007
- Component update logic - see MOOANDSEXAROSYS-007
- Prompt instructions telling LLM about these fields - see MOOANDSEXAROSYS-008
- UI panels - see MOOANDSEXAROSYS-009, MOOANDSEXAROSYS-010
- ActorDataExtractor/CharacterDataXmlBuilder - see MOOANDSEXAROSYS-004, MOOANDSEXAROSYS-005

## Technical Specification

### Schema Extensions

Add to `LLM_TURN_ACTION_RESPONSE_SCHEMA.properties`:

```javascript
moodUpdate: {
  type: 'object',
  additionalProperties: false,
  description: 'Optional mood axis updates. All 7 axes must be provided if present.',
  properties: {
    valence: {
      type: 'integer',
      minimum: -100,
      maximum: 100,
      description: 'Pleasant (+) to unpleasant (-)'
    },
    arousal: {
      type: 'integer',
      minimum: -100,
      maximum: 100,
      description: 'Energized (+) to depleted (-)'
    },
    agency_control: {
      type: 'integer',
      minimum: -100,
      maximum: 100,
      description: 'In control (+) to helpless (-)'
    },
    threat: {
      type: 'integer',
      minimum: -100,
      maximum: 100,
      description: 'Endangered (+) to safe (-)'
    },
    engagement: {
      type: 'integer',
      minimum: -100,
      maximum: 100,
      description: 'Absorbed (+) to indifferent (-)'
    },
    future_expectancy: {
      type: 'integer',
      minimum: -100,
      maximum: 100,
      description: 'Hopeful (+) to hopeless (-)'
    },
    self_evaluation: {
      type: 'integer',
      minimum: -100,
      maximum: 100,
      description: 'Pride (+) to shame (-)'
    }
  },
  required: [
    'valence',
    'arousal',
    'agency_control',
    'threat',
    'engagement',
    'future_expectancy',
    'self_evaluation'
  ]
},
sexualUpdate: {
  type: 'object',
  additionalProperties: false,
  description: 'Optional sexual state updates. Both fields must be provided if present.',
  properties: {
    sex_excitation: {
      type: 'integer',
      minimum: 0,
      maximum: 100,
      description: 'Sexual response activation (accelerator)'
    },
    sex_inhibition: {
      type: 'integer',
      minimum: 0,
      maximum: 100,
      description: 'Sexual response suppression (brake)'
    }
  },
  required: ['sex_excitation', 'sex_inhibition']
}
```

### Important Schema Notes

1. **NOT in `required` array**: Both `moodUpdate` and `sexualUpdate` are OPTIONAL at the top level
2. **ALL fields required IF present**: If LLM provides `moodUpdate`, all 7 axes must be included
3. **`additionalProperties: false`**: Strict validation, no extra fields allowed
4. **`baseline_libido` NOT in sexualUpdate**: This is a trait, not updated by LLM

### LLMResponseProcessor Changes

Modify `#extractData` method to include new fields:

```javascript
#extractData(validatedResponse) {
  return {
    // ... existing fields (chosenIndex, speech, thoughts, notes, etc.)
    chosenIndex: validatedResponse.chosenIndex,
    speech: validatedResponse.speech,
    thoughts: validatedResponse.thoughts,
    notes: validatedResponse.notes,

    // NEW: emotional state updates (may be undefined)
    moodUpdate: validatedResponse.moodUpdate,
    sexualUpdate: validatedResponse.sexualUpdate
  };
}
```

The extracted data is passed to downstream consumers (like MoodUpdateWorkflow).

## Acceptance Criteria

### Schema Validation

- [x] `moodUpdate` schema added with all 7 axes
- [x] `sexualUpdate` schema added with 2 fields
- [x] Both have `additionalProperties: false`
- [x] Both are NOT in top-level `required` array
- [x] `moodUpdate.required` contains all 7 axis names
- [x] `sexualUpdate.required` contains both field names

### Range Validation

- [x] Mood axes reject values < -100 or > 100
- [x] `sex_excitation` rejects values < 0 or > 100
- [x] `sex_inhibition` rejects values < 0 or > 100

### Response Processor

- [x] `#extractData` includes `moodUpdate` field
- [x] `#extractData` includes `sexualUpdate` field
- [x] Both fields are `undefined` if not in response
- [x] Existing extraction logic unchanged

### Backward Compatibility

- [x] Responses WITHOUT moodUpdate/sexualUpdate still validate
- [x] All existing tests pass
- [x] No breaking changes to extractedData structure

### Unit Tests

Additions to existing test files:
- `tests/unit/schemas/llmOutputSchemas.test.js` - Schema validation tests
- `tests/unit/turns/services/LLMResponseProcessor.test.js` - Extraction tests

- [x] Valid response with moodUpdate validates
- [x] Valid response without moodUpdate validates
- [x] Valid response with sexualUpdate validates
- [x] Valid response without sexualUpdate validates
- [x] Response with both moodUpdate and sexualUpdate validates
- [x] Reject moodUpdate with out-of-range values (e.g., valence: 150)
- [x] Reject moodUpdate missing required axis (e.g., no self_evaluation)
- [x] Reject sexualUpdate with out-of-range values (e.g., sex_excitation: -10)
- [x] Reject sexualUpdate with extra properties
- [x] Reject moodUpdate with extra properties

### Test Commands

```bash
# Run schema tests
npm run test:unit -- --testPathPattern="llmOutputSchemas"

# Run response processor tests
npm run test:unit -- --testPathPattern="LLMResponseProcessor"
```

## Example Valid Responses

### With Both Updates

```json
{
  "chosenIndex": 0,
  "speech": "I need to get out of here!",
  "thoughts": "The danger is overwhelming.",
  "moodUpdate": {
    "valence": -45,
    "arousal": 70,
    "agency_control": -20,
    "threat": 80,
    "engagement": 60,
    "future_expectancy": -30,
    "self_evaluation": -10
  },
  "sexualUpdate": {
    "sex_excitation": 5,
    "sex_inhibition": 90
  }
}
```

### Without Updates (Valid)

```json
{
  "chosenIndex": 0,
  "speech": "Hello there.",
  "thoughts": "Nothing unusual."
}
```

### Invalid (Missing Required Axis)

```json
{
  "chosenIndex": 0,
  "moodUpdate": {
    "valence": 10,
    "arousal": 20
    // Missing 5 other axes - INVALID
  }
}
```

## Dependencies

- None (this ticket can be done independently)

## Dependent Tickets

- MOOANDSEXAROSYS-007 (MoodUpdateWorkflow processes the extracted moodUpdate/sexualUpdate)
- MOOANDSEXAROSYS-008 (Prompt instructions tell LLM about these fields)

---

## Outcome

**Status**: ✅ COMPLETED

**Date Completed**: 2026-01-05

### Implementation Summary

All acceptance criteria were met. The implementation followed the plan exactly:

1. **Schema Changes** (`src/turns/schemas/llmOutputSchemas.js`):
   - Added `moodUpdate` property with 7 required axes (valence, arousal, agency_control, threat, engagement, future_expectancy, self_evaluation)
   - Added `sexualUpdate` property with 2 required fields (sex_excitation, sex_inhibition)
   - Both properties are optional at top-level but have strict internal requirements
   - All range validations enforced (-100 to 100 for mood, 0 to 100 for sexual)

2. **Response Processor** (`src/turns/services/LLMResponseProcessor.js`):
   - Updated `#extractData` method to destructure and conditionally include moodUpdate and sexualUpdate
   - Updated JSDoc return type to document new fields

3. **Interface** (`src/turns/interfaces/ILLMResponseProcessor.js`):
   - Updated `LlmProcessingResult` typedef to include moodUpdate and sexualUpdate types

4. **Tests Added**:
   - `tests/unit/schemas/llmOutputSchemas.test.js`: 13 new tests covering moodUpdate and sexualUpdate validation
   - `tests/unit/turns/services/LLMResponseProcessor.test.js`: 6 new tests covering extraction behavior

### Test Results

```
tests/unit/schemas/llmOutputSchemas.test.js: 24 tests passed
tests/unit/turns/services/LLMResponseProcessor.test.js: 19 tests passed
```

### Deviations from Plan

- Corrected test file path reference in ticket (actual path: `tests/unit/schemas/llmOutputSchemas.test.js`, not `tests/unit/turns/schemas/`)
- No other deviations; implementation matched specification exactly
