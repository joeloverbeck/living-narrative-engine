# COGLEDACTPROIMP-008: Extract cognitive_ledger in LLMResponseProcessor and Finalize Schema

## Summary

Final ticket to complete the implementation:
1. Modify `LLMResponseProcessor` to extract `cognitive_ledger` from parsed responses
2. Make `cognitive_ledger` REQUIRED in the V5 schema
3. Run full test suite and verify end-to-end flow

---

## Files to Touch

| File | Action |
|------|--------|
| `src/turns/services/LLMResponseProcessor.js` | MODIFY |
| `src/turns/schemas/llmOutputSchemas.js` | MODIFY (make required) |
| `tests/unit/turns/services/LLMResponseProcessor.cognitiveLedger.test.js` | CREATE |
| `tests/unit/turns/schemas/llmOutputSchemas.test.js` | MODIFY |
| `tests/unit/turns/schemas/llmOutputSchemas.cognitiveLedger.test.js` | MODIFY |

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

// Include in returned object:
return {
  // ... existing fields ...
  cognitiveLedger,
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

### 3. Update Existing Tests

**File**: `tests/unit/turns/schemas/llmOutputSchemas.test.js`

Update any existing V5 schema tests to include `cognitive_ledger` in their test payloads now that it's required.

**File**: `tests/unit/turns/schemas/llmOutputSchemas.cognitiveLedger.test.js`

Update the test that checks "V5 schema accepts response WITHOUT cognitive_ledger" - this test should now FAIL (or be removed/inverted) since `cognitive_ledger` is required.

---

## Acceptance Criteria

### Tests That Must Pass

1. **New Test File**: `tests/unit/turns/services/LLMResponseProcessor.cognitiveLedger.test.js`
   - Test: `processResponse` extracts `cognitive_ledger` when present
   - Test: `processResponse` returns `cognitiveLedger: null` when field missing
   - Test: Extracted data includes `cognitiveLedger` field
   - Test: Invalid `cognitive_ledger` format fails schema validation

2. **Updated Tests**: `tests/unit/turns/schemas/llmOutputSchemas.cognitiveLedger.test.js`
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
npm run test:unit -- --testPathPattern="llmOutputSchemas"

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
