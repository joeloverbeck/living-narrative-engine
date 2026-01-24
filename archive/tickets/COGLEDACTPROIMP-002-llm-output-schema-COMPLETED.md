# COGLEDACTPROIMP-002: Add cognitive_ledger to LLM Output Schema V5

## Summary

Add the `cognitive_ledger` field to `LLM_TURN_ACTION_RESPONSE_SCHEMA_V5`. Initially, this field will be **OPTIONAL** to allow a gradual rollout. A later ticket will make it required.

---

## Assumptions & Scope Corrections

- Existing v5 schema coverage lives in `tests/unit/schemas/llmTurnActionResponseSchemaV5.test.js`, so cognitive_ledger coverage will be added there instead of creating a new file under `tests/unit/turns/schemas/`.
- Targeted Jest runs must use `--testPathPatterns` (plural) and should disable coverage (e.g., `--coverage=false`) to avoid global threshold failures.

---

## Files to Touch

| File | Action |
|------|--------|
| `src/turns/schemas/llmOutputSchemas.js` | MODIFY |
| `tests/unit/schemas/llmTurnActionResponseSchemaV5.test.js` | MODIFY (add cognitive_ledger cases) |

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

1. **Existing Test File**: `tests/unit/schemas/llmTurnActionResponseSchemaV5.test.js`
   - Test: V5 schema accepts response WITHOUT cognitive_ledger (optional)
   - Test: V5 schema accepts response WITH valid cognitive_ledger
   - Test: V5 schema rejects cognitive_ledger missing `settled_conclusions`
   - Test: V5 schema rejects cognitive_ledger missing `open_questions`
   - Test: V5 schema rejects cognitive_ledger with >3 settled_conclusions
   - Test: V5 schema rejects cognitive_ledger with >3 open_questions
   - Test: V5 schema rejects cognitive_ledger with empty string items
   - Test: V5 schema rejects cognitive_ledger with additional properties

2. **Existing Tests**
   - `tests/unit/schemas/llmOutputSchemas.test.js` passes (no change expected)
   - `npm run test:unit -- --testPathPatterns="llmOutputSchemas|llmTurnActionResponseSchemaV5" --coverage=false` passes

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
npm run test:unit -- --testPathPatterns="llmOutputSchemas|llmTurnActionResponseSchemaV5" --coverage=false

# Run integration schema validation
npm run test:integration -- --testPathPatterns="llmOutputValidation" --coverage=false

# Verify schema structure
node -e "const s = require('./src/turns/schemas/llmOutputSchemas.js'); console.log(Object.keys(s.LLM_TURN_ACTION_RESPONSE_SCHEMA_V5.properties))"
```

## Status

Completed.

## Outcome

- Added optional `cognitive_ledger` to the v5 action response schema with max-item and min-length constraints.
- Implemented v5 schema unit tests for optional/invalid ledger payloads instead of creating a new test file.
- Verification commands updated to match the repo's `--testPathPatterns` convention with coverage disabled for targeted runs.
