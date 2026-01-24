# COGLEDACTPROIMP-006: Add Cognitive Ledger Instructions to corePromptText.json

## Summary

Add two instruction blocks to `corePromptText.json`:
1. **Cognitive Ledger Update Rules** - Instructions for the LLM to update the ledger
2. **Confusion Target Rule** - Constraint for inner state integration

---

## Files to Touch

| File | Action |
|------|--------|
| `data/prompts/corePromptText.json` | MODIFY |
| `tests/unit/prompting/corePromptText.cognitiveLedger.test.js` | CREATE |

---

## Out of Scope

- **DO NOT** modify `moodUpdateOnlyInstructionText` (spec confirms no changes needed)
- **DO NOT** modify any other instruction sections beyond what's specified
- **DO NOT** modify any JavaScript files in this ticket
- **DO NOT** modify any response processor files
- **DO NOT** modify any files in `src/`

---

## Implementation Details

### 1. Add Cognitive Ledger Update Rules

**File**: `data/prompts/corePromptText.json`

**Location**: Add to `finalLlmInstructionText` AFTER the "NOTES RULES" section and BEFORE "CRITICAL DISTINCTION - THOUGHTS vs SPEECH"

Add the following text block:

```
COGNITIVE LEDGER UPDATE RULES (CRITICAL):

Your response MUST include a cognitive_ledger with settled_conclusions and open_questions arrays.

Ledger Update Rule (HARD):
- You may move one item from OPEN → SETTLED only if new evidence appeared in the perception log this turn.
- You may move SETTLED → OPEN only if new conflicting evidence appeared this turn.
- Otherwise, keep the ledger unchanged from what was provided.
- Maximum 3 items per array.

What counts as SETTLED:
- Facts you have verified or conclusions you have drawn
- Decisions you have made that don't need revisiting
- Information that has been confirmed

What counts as OPEN:
- Questions you are still investigating
- Uncertainties that lack sufficient evidence
- Decisions that depend on future information
```

### 2. Add Confusion Target Rule

**File**: `data/prompts/corePromptText.json`

**Location**: Add to `finalLlmInstructionText` BEFORE `</inner_state_integration>` tag (inside the inner state integration section)

Add the following text:

```
CONFUSION TARGET RULE: Confusion must attach to open questions only, not to re-evaluating settled conclusions.
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **New Test File**: `tests/unit/prompting/corePromptText.cognitiveLedger.test.js`
   - Test: `finalLlmInstructionText` contains "COGNITIVE LEDGER UPDATE RULES (CRITICAL)"
   - Test: `finalLlmInstructionText` contains "cognitive_ledger with settled_conclusions and open_questions"
   - Test: `finalLlmInstructionText` contains "Ledger Update Rule (HARD)"
   - Test: `finalLlmInstructionText` contains "OPEN → SETTLED only if new evidence"
   - Test: `finalLlmInstructionText` contains "SETTLED → OPEN only if new conflicting evidence"
   - Test: `finalLlmInstructionText` contains "Maximum 3 items per array"
   - Test: `finalLlmInstructionText` contains "CONFUSION TARGET RULE"
   - Test: `finalLlmInstructionText` contains "Confusion must attach to open questions only"
   - Test: Cognitive ledger rules appear BEFORE "CRITICAL DISTINCTION"
   - Test: Confusion target rule appears within inner_state_integration context

2. **Existing Tests**
   - `npm run validate:strict` passes (JSON valid)
   - Existing prompt text tests pass without modification

### Invariants That Must Remain True

1. `moodUpdateOnlyInstructionText` remains unchanged
2. All existing instruction sections remain intact
3. JSON structure remains valid
4. Existing key-value pairs remain unchanged
5. No sections are removed or reordered (beyond inserting new content)

---

## Verification Commands

```bash
# Validate JSON structure
npm run validate:strict

# Run new tests
npm run test:unit -- --testPathPattern="corePromptText.cognitiveLedger"

# Manual verification
node -e "const t = require('./data/prompts/corePromptText.json'); console.log(t.finalLlmInstructionText.includes('COGNITIVE LEDGER UPDATE RULES'))"
```

---

## Dependencies

- **No code dependencies** (this is a data file change)
- Should be deployed WITH COGLEDACTPROIMP-002 to avoid schema validation errors
