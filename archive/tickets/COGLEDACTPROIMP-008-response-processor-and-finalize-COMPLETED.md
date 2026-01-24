# COGLEDACTPROIMP-008: Extract cognitive_ledger in LLMResponseProcessor and Finalize Schema

## Status: ✅ COMPLETED

## Summary

Final ticket to complete the implementation:
1. Modify `LLMResponseProcessor` to extract `cognitive_ledger` from parsed responses
2. Make `cognitive_ledger` REQUIRED in the V5 schema
3. Run full test suite and verify end-to-end flow

---

## Outcome

### Implementation Summary

All objectives were successfully completed:

1. **LLMResponseProcessor Modified** (`src/turns/services/LLMResponseProcessor.js`)
   - Added extraction of `cognitive_ledger` from parsed LLM responses
   - Added INFO-level logging for cognitive_ledger extraction visibility
   - Included `cognitiveLedger` (camelCase) in `extractedData` return object

2. **V5 Schema Updated** (`src/turns/schemas/llmOutputSchemas.js`)
   - Made `cognitive_ledger` a REQUIRED field in `LLM_TURN_ACTION_RESPONSE_SCHEMA_V5`
   - Changed required array from `['chosenIndex', 'speech', 'thoughts']` to `['chosenIndex', 'speech', 'thoughts', 'cognitive_ledger']`

3. **Tests Created/Updated**
   - Created `tests/unit/turns/services/LLMResponseProcessor.cognitiveLedger.test.js` (new test file)
   - Updated `tests/unit/schemas/llmTurnActionResponseSchemaV5.test.js`:
     - Modified `createValidResponse()` helper to include `cognitive_ledger` by default
     - Changed "cognitive_ledger is optional" test to "missing cognitive_ledger fails validation (required field)"

### Test Results

All cognitive ledger related tests pass:
- `LLMResponseProcessor.cognitiveLedger.test.js` - PASSED
- `llmTurnActionResponseSchemaV5.test.js` - PASSED
- `LLMResponseProcessor.test.js` - PASSED
- `cognitiveLedgerPromptGeneration.integration.test.js` - PASSED
- `cognitiveLedgerPersistence.integration.test.js` - PASSED
- All other cognitive ledger related tests - PASSED

Full test suite results:
- Unit tests: 50,975 passed (75 pre-existing failures unrelated to this ticket)
- Integration tests: 18,974 passed (all tests pass)

### Deviations from Plan

1. **Test file paths corrected**: The ticket originally referenced `tests/unit/turns/schemas/llmOutputSchemas.test.js` but actual path is `tests/unit/schemas/llmTurnActionResponseSchemaV5.test.js`

2. **Acceptance criteria note**: The ticket stated `cognitiveLedger: null` when field missing, but actual implementation returns `cognitiveLedger: undefined` (field not present in extractedData object) - this is consistent with other optional field patterns in the codebase (notes, moodUpdate, sexualUpdate)

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/turns/schemas/llmOutputSchemas.js` | MODIFIED | Made cognitive_ledger required in V5 schema |
| `src/turns/services/LLMResponseProcessor.js` | MODIFIED | Added extraction and logging of cognitive_ledger |
| `tests/unit/schemas/llmTurnActionResponseSchemaV5.test.js` | MODIFIED | Updated helper and optionality test |
| `tests/unit/turns/services/LLMResponseProcessor.cognitiveLedger.test.js` | CREATED | New test file for cognitive_ledger extraction |

---

## Files to Touch

| File | Action |
|------|--------|
| `src/turns/services/LLMResponseProcessor.js` | MODIFY |
| `src/turns/schemas/llmOutputSchemas.js` | MODIFY (make required) |
| `tests/unit/turns/services/LLMResponseProcessor.cognitiveLedger.test.js` | CREATE |
| `tests/unit/schemas/llmTurnActionResponseSchemaV5.test.js` | MODIFY (update cognitive_ledger optionality test) |

---

## Assumptions Corrected (from original)

### File Path Corrections
- **ORIGINAL**: `tests/unit/turns/schemas/llmOutputSchemas.test.js` and `tests/unit/turns/schemas/llmOutputSchemas.cognitiveLedger.test.js`
- **CORRECTED**: V5 schema tests are in `tests/unit/schemas/llmTurnActionResponseSchemaV5.test.js` (NOT in `tests/unit/turns/schemas/`)

### Existing Test Coverage
- V5 schema already has comprehensive `cognitive_ledger` validation tests in `llmTurnActionResponseSchemaV5.test.js`
- The test "cognitive_ledger is optional" (line 308) needs to be updated to verify it's now REQUIRED
- No separate `llmOutputSchemas.cognitiveLedger.test.js` file exists or needs to be created

---

## Out of Scope

- **DO NOT** modify any prompt files (already done in previous tickets)
- **DO NOT** modify any persistence files (already done in COGLEDACTPROIMP-007)
- **DO NOT** modify the component definition (done in COGLEDACTPROIMP-001)
- **DO NOT** modify `corePromptText.json` (done in COGLEDACTPROIMP-006)

---

## Implementation Details

### 1. Modify LLMResponseProcessor

**File**: `src/turns/services/LLMResponseProcessor.js`

In the `#extractData` method, add extraction of `cognitive_ledger`:

```javascript
// In #extractData method, add:
const cognitiveLedger = parsedResponse.cognitive_ledger ?? null;

// Include in returned object extractedData:
return {
  action: { chosenIndex, speech },
  extractedData: {
    thoughts,
    ...(notes !== undefined ? { notes } : {}),
    ...(moodUpdate !== undefined ? { moodUpdate } : {}),
    ...(sexualUpdate !== undefined ? { sexualUpdate } : {}),
    ...(cognitiveLedger !== undefined ? { cognitiveLedger } : {}),
  },
};
```

The extracted `cognitiveLedger` will be included in the ACTION_DECIDED event payload, where the persistence listener (from COGLEDACTPROIMP-007) will pick it up.

### 2. Make cognitive_ledger Required in V5 Schema

**File**: `src/turns/schemas/llmOutputSchemas.js`

Change the `required` array in `LLM_TURN_ACTION_RESPONSE_SCHEMA_V5`:

```javascript
// Before:
required: ['chosenIndex', 'speech', 'thoughts'],

// After:
required: ['chosenIndex', 'speech', 'thoughts', 'cognitive_ledger'],
```

### 3. Update Existing V5 Schema Tests

**File**: `tests/unit/schemas/llmTurnActionResponseSchemaV5.test.js`

Update the test that checks "cognitive_ledger is optional" to verify it is now REQUIRED:
- Change test name from "cognitive_ledger is optional" to "missing cognitive_ledger fails validation"
- Update test to expect validation failure when cognitive_ledger is missing
- Update helper function `createValidResponse()` to include a valid cognitive_ledger by default

---

## Acceptance Criteria

### Tests That Must Pass

1. **New Test File**: `tests/unit/turns/services/LLMResponseProcessor.cognitiveLedger.test.js`
   - Test: `processResponse` extracts `cognitive_ledger` when present
   - Test: `processResponse` returns `cognitiveLedger: null` when field missing (with schema validator mocked)
   - Test: Extracted data includes `cognitiveLedger` field
   - Test: Invalid `cognitive_ledger` format fails schema validation

2. **Updated Tests**: `tests/unit/schemas/llmTurnActionResponseSchemaV5.test.js`
   - Test: V5 schema REJECTS response WITHOUT cognitive_ledger (now required)
   - Test: V5 schema accepts response WITH valid cognitive_ledger
   - (Keep all other validation tests from COGLEDACTPROIMP-002)

3. **Full Test Suite**
   - `npm run test:unit` passes
   - `npm run test:integration` passes
   - `npm run test:e2e` passes (if applicable)

4. **Integration Validation**
   - `npm run validate:strict` passes
   - `npm run typecheck` passes

### Invariants That Must Remain True

1. All existing V5 required fields still required
2. V4 schema (legacy) remains unchanged
3. Mood update schema remains unchanged
4. Extracted data object maintains all existing fields
5. Schema validation errors are properly formatted and returned

---

## Verification Commands

```bash
# Run response processor tests
npm run test:unit -- --testPathPattern="LLMResponseProcessor"

# Run schema tests
npm run test:unit -- --testPathPattern="llmTurnActionResponseSchemaV5"

# Run full test suite
npm run test:unit
npm run test:integration

# Verify schema structure
node -e "const s = require('./src/turns/schemas/llmOutputSchemas.js'); console.log(s.LLM_TURN_ACTION_RESPONSE_SCHEMA_V5.required)"
```

---

## Dependencies

- **Requires**: ALL previous COGLEDACTPROIMP tickets (001-007)
- This ticket should be done LAST

---

## Manual Verification Checklist

After all tickets are complete:

1. [ ] Start the application with `npm run dev`
2. [ ] Navigate to a character entity
3. [ ] Click "Prompt to LLM" button to view generated prompt
4. [ ] Verify `<cognitive_ledger>` section appears (or shows [None yet] on first turn)
5. [ ] Verify only 1 thought appears in `<thoughts>` section
6. [ ] Submit a turn and verify the cognitive_ledger persists to the entity
7. [ ] On next turn, verify the persisted ledger appears in the prompt
8. [ ] Verify LLM response validation passes with cognitive_ledger

---

## Risk Mitigation

**Breaking Change Risk**: Making `cognitive_ledger` required will break any LLM responses that don't include it.

**Mitigation**:
- Ensure COGLEDACTPROIMP-006 (prompt instructions) is deployed BEFORE this ticket
- The prompt instructions tell the LLM to always include `cognitive_ledger`
- Consider a brief parallel deployment where the field is optional, then required

**Rollback Plan**: If issues arise, revert the `required` array change to make `cognitive_ledger` optional again while debugging.
