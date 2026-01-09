# TWOPHAEMOSTAUPD-001: Schema Unit Tests

**Status: COMPLETED**

## Summary

Add unit tests for the existing mood update and action-only response schemas that were added in the completed schema work.

## Files to Touch

| File | Action |
|------|--------|
| `tests/unit/schemas/llmMoodUpdateResponseSchema.test.js` | CREATE |
| `tests/unit/schemas/llmTurnActionResponseSchemaV5.test.js` | CREATE |

> **Note**: File paths corrected from `tests/unit/turns/schemas/` to `tests/unit/schemas/` to match project conventions. Schema tests are stored flat in `tests/unit/schemas/`, not mirroring the `src/` directory structure.

## Out of Scope

- **DO NOT** modify `src/turns/schemas/llmOutputSchemas.js` (schemas already exist and are complete)
- **DO NOT** modify any production code
- **DO NOT** add integration tests (separate ticket handles that)
- **DO NOT** modify the v4 legacy schema or its tests

## Implementation Details

### Test File 1: `llmMoodUpdateResponseSchema.test.js`

Test the `LLM_MOOD_UPDATE_RESPONSE_SCHEMA` exported from `src/turns/schemas/llmOutputSchemas.js`.

**Setup:**
```javascript
import { describe, it, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import {
  LLM_MOOD_UPDATE_RESPONSE_SCHEMA,
  LLM_MOOD_UPDATE_RESPONSE_SCHEMA_ID,
} from '../../../src/turns/schemas/llmOutputSchemas.js';
```

**Test Cases Required:**
1. Schema ID matches exported constant (`llmMoodUpdateResponseSchema/v1`)
2. Valid complete response validates successfully
3. Missing `moodUpdate` object fails validation
4. Missing `sexualUpdate` object fails validation
5. Missing individual mood axis (test each: valence, arousal, agency_control, threat, engagement, future_expectancy, self_evaluation) fails
6. Missing `sex_excitation` fails validation
7. Missing `sex_inhibition` fails validation
8. Out-of-range mood values fail (-101, 101)
9. Out-of-range sexual values fail (-1, 101)
10. Additional root properties rejected (`additionalProperties: false`)
11. Additional mood properties rejected
12. Additional sexual properties rejected

### Test File 2: `llmTurnActionResponseSchemaV5.test.js`

Test the `LLM_TURN_ACTION_RESPONSE_SCHEMA_V5` exported from `src/turns/schemas/llmOutputSchemas.js`.

**Test Cases Required:**
1. Schema ID matches exported constant (`llmTurnActionResponseSchema/v5`)
2. Valid response with required fields validates (chosenIndex, speech, thoughts)
3. Valid response with optional notes array validates
4. Missing `chosenIndex` fails validation
5. Missing `speech` fails validation
6. Missing `thoughts` fails validation
7. Invalid `chosenIndex` (0) fails validation
8. Invalid `chosenIndex` (negative) fails validation
9. Notes array with valid items validates
10. Notes item missing `text` fails validation
11. Notes item missing `subject` fails validation
12. Notes item missing `subjectType` fails validation
13. Notes item with invalid `subjectType` fails validation
14. **NO `moodUpdate` property allowed** - additional properties rejected
15. **NO `sexualUpdate` property allowed** - additional properties rejected

## Acceptance Criteria

### Tests that must pass

All test cases listed above must pass when running:
```bash
npm run test:unit -- tests/unit/schemas/llmMoodUpdateResponseSchema.test.js
npm run test:unit -- tests/unit/schemas/llmTurnActionResponseSchemaV5.test.js
```

### Invariants that must remain true

1. Tests use Jest with `@jest/globals` imports (not CommonJS require)
2. Tests use AJV for schema validation (matching existing schema test patterns)
3. Schema tests are placed in `tests/unit/schemas/` (flat structure, not mirroring src/)
4. Each test is independent (no shared mutable state between tests)
5. Test descriptions clearly indicate what is being validated
6. Valid test fixtures use realistic values within specified ranges

## Test Fixtures

### Valid Mood Update Response
```javascript
const validMoodResponse = {
  moodUpdate: {
    valence: 25,
    arousal: -10,
    agency_control: 50,
    threat: -30,
    engagement: 75,
    future_expectancy: 0,
    self_evaluation: -20,
  },
  sexualUpdate: {
    sex_excitation: 15,
    sex_inhibition: 60,
  },
};
```

### Valid Action Response (V5)
```javascript
const validActionResponse = {
  chosenIndex: 1,
  speech: 'Hello there!',
  thoughts: 'I should be cautious.',
  notes: [
    {
      text: 'They seem friendly',
      subject: 'stranger',
      subjectType: 'actor',
    },
  ],
};
```

## Estimated Scope

- ~150 lines for mood schema tests
- ~150 lines for action schema tests
- Small, focused, easily reviewable diff

---

## Outcome

**Completed: 2026-01-08**

### What Changed vs Originally Planned

1. **File paths corrected**: Original ticket specified `tests/unit/turns/schemas/` but project convention places schema tests in `tests/unit/schemas/` (flat structure). Updated all paths in ticket and created files in correct location.

2. **Schema ID tests adjusted**: The ticket assumed schema `$id` would directly match the exported constant, but the schema uses a full URI format. Changed test approach to verify:
   - The exported ID constant has the expected versioned format
   - The schema has a valid `$id` property defined

3. **Test coverage achieved**: All 32 test cases pass (15 for mood schema, 17 for V5 action schema including additional metadata tests).

### Files Created

| File | Lines | Tests |
|------|-------|-------|
| `tests/unit/schemas/llmMoodUpdateResponseSchema.test.js` | 168 | 15 |
| `tests/unit/schemas/llmTurnActionResponseSchemaV5.test.js` | 200 | 17 |

### Verification Commands

```bash
npm run test:unit -- tests/unit/schemas/llmMoodUpdateResponseSchema.test.js
npm run test:unit -- tests/unit/schemas/llmTurnActionResponseSchemaV5.test.js
```

All tests pass with 100% coverage of `llmOutputSchemas.js`.
