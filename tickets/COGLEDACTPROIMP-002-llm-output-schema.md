# COGLEDACTPROIMP-002: Add cognitive_ledger to LLM Output Schema V5

## Summary

Add the `cognitive_ledger` field to `LLM_TURN_ACTION_RESPONSE_SCHEMA_V5`. Initially, this field will be **OPTIONAL** to allow a gradual rollout. A later ticket will make it required.

---

## Files to Touch

| File | Action |
|------|--------|
| `src/turns/schemas/llmOutputSchemas.js` | MODIFY |
| `tests/unit/turns/schemas/llmOutputSchemas.cognitiveLedger.test.js` | CREATE |
| `tests/unit/turns/schemas/llmOutputSchemas.test.js` | MODIFY (add cognitive_ledger cases) |

---

## Out of Scope

- **DO NOT** make `cognitive_ledger` required yet (that's COGLEDACTPROIMP-008)
- **DO NOT** modify `LLM_TURN_ACTION_RESPONSE_SCHEMA` (v4 legacy)
- **DO NOT** modify `LLM_MOOD_UPDATE_RESPONSE_SCHEMA`
- **DO NOT** modify any prompt files
- **DO NOT** modify any response processor files
- **DO NOT** modify any files in `src/prompting/`
- **DO NOT** modify any files in `src/ai/`
- **DO NOT** modify `corePromptText.json`

---

## Implementation Details

### Modify V5 Schema

**File**: `src/turns/schemas/llmOutputSchemas.js`

Add `cognitive_ledger` to `LLM_TURN_ACTION_RESPONSE_SCHEMA_V5.properties`:

```javascript
cognitive_ledger: {
  type: 'object',
  additionalProperties: false,
  description: 'Cognitive ledger tracking settled conclusions and open questions',
  properties: {
    settled_conclusions: {
      type: 'array',
      description: 'Conclusions already reached (do not re-derive)',
      items: { type: 'string', minLength: 1 },
      maxItems: 3,
    },
    open_questions: {
      type: 'array',
      description: 'Questions still being actively considered',
      items: { type: 'string', minLength: 1 },
      maxItems: 3,
    },
  },
  required: ['settled_conclusions', 'open_questions'],
},
```

**Note**: Do NOT add `cognitive_ledger` to the `required` array yet.

---

## Acceptance Criteria

### Tests That Must Pass

1. **New Test File**: `tests/unit/turns/schemas/llmOutputSchemas.cognitiveLedger.test.js`
   - Test: V5 schema accepts response WITHOUT cognitive_ledger (optional)
   - Test: V5 schema accepts response WITH valid cognitive_ledger
   - Test: V5 schema rejects cognitive_ledger missing `settled_conclusions`
   - Test: V5 schema rejects cognitive_ledger missing `open_questions`
   - Test: V5 schema rejects cognitive_ledger with >3 settled_conclusions
   - Test: V5 schema rejects cognitive_ledger with >3 open_questions
   - Test: V5 schema rejects cognitive_ledger with empty string items
   - Test: V5 schema rejects cognitive_ledger with additional properties

2. **Existing Tests**
   - `tests/unit/turns/schemas/llmOutputSchemas.test.js` passes (may need updates for new optional field)
   - `npm run test:unit -- --testPathPattern="llmOutputSchemas"` passes

### Invariants That Must Remain True

1. `LLM_TURN_ACTION_RESPONSE_SCHEMA` (v4) remains unchanged
2. `LLM_MOOD_UPDATE_RESPONSE_SCHEMA` remains unchanged
3. All existing required fields in V5 remain required
4. Responses without `cognitive_ledger` still validate successfully
5. Schema IDs remain unchanged

---

## Verification Commands

```bash
# Run schema tests
npm run test:unit -- --testPathPattern="llmOutputSchemas"

# Run integration schema validation
npm run test:integration -- --testPathPattern="llmOutputValidation"

# Verify schema structure
node -e "const s = require('./src/turns/schemas/llmOutputSchemas.js'); console.log(Object.keys(s.LLM_TURN_ACTION_RESPONSE_SCHEMA_V5.properties))"
```
