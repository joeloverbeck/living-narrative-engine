# Specification: Cognitive Ledger and Action Prompt Improvements

## Problem Statement

The LLM action/thought generation prompt has issues causing repetitive and counterproductive behavior:

1. **Re-litigation of settled matters**: The LLM repeatedly mulls over matters that are clearly settled from the conversation context, derailing actual conversations. Humans carry an internal ledger of "settled vs open" matters; the current prompt has no such mechanism.

2. **Excessive thought context**: The prompt includes too many previous thoughts (currently 4-5), when in reality humans only hold the most recent "block" of thought in detailed memory. Previous thoughts have already been rendered into notes if meaningful.

3. **Missing cognitive constraint for confusion**: The existing `<inner_state_integration>` section has no rule preventing confusion from attaching to already-settled conclusions.

## Solution Overview

Implement a "Cognitive Ledger" system that:

1. **Tracks epistemic status**: Maintains arrays of `settled_conclusions` (max 3) and `open_questions` (max 3)
2. **Prevents re-derivation**: Adds hard constraints preventing the LLM from re-arguing settled points
3. **Reduces thought context**: Shows only the LATEST 1 thought in the prompt
4. **Targets confusion appropriately**: Adds rule that confusion must attach to open questions only

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        CURRENT (PROBLEMATIC) FLOW                        │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Perception Log → [4-5 Thoughts] → Action Decision                      │
│  (No epistemic status tracking → model re-litigates everything)          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                          NEW (CORRECTED) FLOW                            │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Perception Log → Cognitive Ledger → [1 Thought] → Action Decision      │
│  (SETTLED/OPEN tracking → model moves forward, not backward)             │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Requirements

### 1. Reduce Thoughts Shown in Prompt

**Current Behavior**: All thoughts from `core:short_term_memory.thoughts` are shown in the prompt (no limit enforced).

**New Behavior**: Only the LATEST 1 thought is shown in the prompt.

**Rationale**: Humans hold only their most recent "thought block" in detail. Previous thoughts have already been rendered into notes if meaningful enough to remember.

**Implementation Location**: `src/prompting/AIPromptContentProvider.js` in `_extractMemoryComponents()` - add `.slice(-1)` after filtering thoughts.

**Note**: The `maxEntries` field in `short_term_memory.component.json` controls storage capacity (how many thoughts are kept in the entity), not prompt display. Storage can remain at 4; only prompt display changes to 1.

---

### 2. New Cognitive Ledger Component

**Component Definition**: Create `data/mods/core/components/cognitive_ledger.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "core:cognitive_ledger",
  "description": "Stores settled conclusions and open questions to prevent re-litigation of resolved matters.",
  "dataSchema": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
      "settled_conclusions": {
        "type": "array",
        "maxItems": 3,
        "items": {
          "type": "string",
          "minLength": 1,
          "description": "A conclusion the character has reached and should not re-derive."
        },
        "default": []
      },
      "open_questions": {
        "type": "array",
        "maxItems": 3,
        "items": {
          "type": "string",
          "minLength": 1,
          "description": "A question the character is still actively considering."
        },
        "default": []
      }
    },
    "required": ["settled_conclusions", "open_questions"],
    "additionalProperties": false
  }
}
```

**Constants**: Add `COGNITIVE_LEDGER_COMPONENT_ID = 'core:cognitive_ledger'` to `src/constants/componentIds.js`.

---

### 3. Add Cognitive Ledger Section to Prompt

**Placement**: Insert AFTER `<perception_log>` section and BEFORE `{thoughtsVoiceGuidance}` / `{thoughtsSection}`.

**Template Update**: In `src/prompting/templates/characterPromptTemplate.js`:

```javascript
<perception_log>
{perceptionLogContent}
</perception_log>

{cognitiveLedgerSection}   // NEW

{thoughtsVoiceGuidance}

{thoughtsSection}
```

**Formatting**: Add `formatCognitiveLedgerSection()` method to `src/prompting/promptDataFormatter.js`:

```xml
<cognitive_ledger>
SETTLED CONCLUSIONS (treat as already integrated; do not re-argue unless NEW evidence appears):
- [settled item 1]
- [settled item 2]

OPEN QUESTIONS (allowed to think about now):
- [open question 1]
- [open question 2]

NO RE-DERIVATION RULE (HARD):
- THOUGHTS may reference a settled conclusion only as a short tag.
- If you feel compelled to re-derive a settled point, convert that impulse into an in-character loop-break and move on.
</cognitive_ledger>
```

**Conditional Rendering**: If the actor does NOT have a `core:cognitive_ledger` component, the entire `<cognitive_ledger>` section is omitted from the prompt (return empty string from formatter).

---

### 4. Update LLM Response Schema

**File**: `src/turns/schemas/llmOutputSchemas.js`

**Changes to `LLM_TURN_ACTION_RESPONSE_SCHEMA_V5`**:

Add `cognitive_ledger` as a **REQUIRED** field:

```javascript
properties: {
  // ... existing properties ...
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
},
required: ['chosenIndex', 'speech', 'thoughts', 'cognitive_ledger'],
```

---

### 5. Add Ledger Update Instructions to Prompt

**File**: `data/prompts/corePromptText.json`

**Location**: Add to `finalLlmInstructionText` after the NOTES RULES section, before "CRITICAL DISTINCTION - THOUGHTS vs SPEECH":

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

---

### 6. Response Handler: OVERWRITE Semantics

**File**: `src/turns/services/LLMResponseProcessor.js`

Update `#extractData()` to extract `cognitive_ledger` from the parsed response.

**New Persistence Hook**: Create `src/ai/cognitiveLedgerPersistenceHook.js`

The hook must use **OVERWRITE** semantics (not additive like notes):

```javascript
// OVERWRITE the component entirely
componentAccess.applyComponent(
  actorEntity,
  COGNITIVE_LEDGER_COMPONENT_ID,
  {
    settled_conclusions: cognitiveLedger.settled_conclusions.slice(0, 3),
    open_questions: cognitiveLedger.open_questions.slice(0, 3),
  }
);
```

**New Listener**: Create `src/ai/cognitiveLedgerPersistenceListener.js`

Subscribe to `ACTION_DECIDED_ID` event (same pattern as `notesPersistenceListener.js`).

**Registration**: Update `src/initialization/initHelpers.js` to register the new listener.

---

### 7. Inner State Integration: Confusion Target Rule

**File**: `data/prompts/corePromptText.json`

**Location**: Add to `finalLlmInstructionText` BEFORE `</inner_state_integration>`:

```
CONFUSION TARGET RULE: Confusion must attach to open questions only, not to re-evaluating settled conclusions.
```

---

### 8. Mood Update Instructions Review

**File**: `data/prompts/corePromptText.json`, field `moodUpdateOnlyInstructionText`

**Current State**: The uncertainty axis is already defined as:
- `+` = highly uncertain/cannot integrate/model doesn't fit
- `-` = highly certain/coherent model/clear understanding

**Current Heuristics Include**:
- "Clear, consistent information received: Uncertainty down"
- "Expectations confirmed: Uncertainty down"
- "Successful prediction/anticipation: Uncertainty down"

**Assessment**: The mood update instructions already handle uncertainty appropriately. When conclusions are reached, the LLM should naturally lower uncertainty. No changes required to mood update instructions.

---

## Architecture Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `data/mods/core/components/cognitive_ledger.component.json` | Component schema definition |
| `src/ai/cognitiveLedgerPersistenceHook.js` | Persist ledger with OVERWRITE semantics |
| `src/ai/cognitiveLedgerPersistenceListener.js` | Listen for ACTION_DECIDED events |

### Modified Files

| File | Changes |
|------|---------|
| `src/constants/componentIds.js` | Add `COGNITIVE_LEDGER_COMPONENT_ID` |
| `src/turns/schemas/llmOutputSchemas.js` | Add `cognitive_ledger` to V5 schema |
| `src/prompting/AIPromptContentProvider.js` | Extract ledger, slice thoughts to 1 |
| `src/prompting/promptDataFormatter.js` | Add `formatCognitiveLedgerSection()` |
| `src/prompting/templates/characterPromptTemplate.js` | Add `{cognitiveLedgerSection}` placeholder |
| `data/prompts/corePromptText.json` | Add ledger rules and CONFUSION TARGET RULE |
| `src/turns/services/LLMResponseProcessor.js` | Extract `cognitive_ledger` from response |
| `src/initialization/initHelpers.js` | Register new listener |

---

## Test Requirements

### New Unit Tests Required

| Test File | Tests |
|-----------|-------|
| `tests/unit/mods/core/components/cognitiveLedger.component.test.js` | Schema validation, max items, required fields |
| `tests/unit/prompting/promptDataFormatter.cognitiveLedger.test.js` | `formatCognitiveLedgerSection()` with null, empty arrays, populated arrays, [None yet] placeholders |
| `tests/unit/prompting/AIPromptContentProvider.cognitiveLedger.test.js` | Ledger extraction, null handling, thoughts slicing to 1 |
| `tests/unit/turns/schemas/llmOutputSchemas.cognitiveLedger.test.js` | V5 schema validation with cognitive_ledger field |
| `tests/unit/ai/cognitiveLedgerPersistenceHook.test.js` | OVERWRITE semantics, max 3 enforcement, invalid input handling |
| `tests/unit/ai/cognitiveLedgerPersistenceListener.test.js` | Event subscription, entity lookup, error handling |

### New Integration Tests Required

| Test File | Tests |
|-----------|-------|
| `tests/integration/ai/cognitiveLedgerPersistence.integration.test.js` | End-to-end persistence flow |
| `tests/integration/prompting/cognitiveLedgerPromptGeneration.integration.test.js` | Full prompt generation with/without ledger |

### Existing Tests to Update

| Test File | Changes |
|-----------|---------|
| `tests/unit/prompting/promptDataFormatter.test.js` | Add tests for new formatter method |
| `tests/unit/turns/schemas/llmOutputSchemas.test.js` | Update for `cognitive_ledger` required field |
| `tests/unit/prompting/AIPromptContentProvider.promptData.test.js` | Update for thoughts slicing, ledger extraction |
| `tests/unit/prompting/AIPromptContentProvider.helpers.test.js` | Update for `_extractCognitiveLedger()` |
| `tests/integration/prompting/promptBuilder.test.js` | Update for new template placeholder |
| `tests/integration/schemas/llmOutputValidation.integration.test.js` | Add cognitive_ledger validation cases |

---

## Risk Assessment

### High Risk

1. **Schema Breaking Change**: Adding `cognitive_ledger` as required in V5 schema will break existing LLM responses until prompts are updated.
   - **Mitigation**: Deploy prompt changes BEFORE making schema field required. Consider making field optional initially during transition.

2. **First Turn Initialization**: Actors without `cognitive_ledger` component need graceful handling.
   - **Mitigation**: `formatCognitiveLedgerSection()` returns empty string when component is null/missing. LLM generates initial ledger on first response.

### Medium Risk

3. **Thoughts Reduction Impact**: Reducing from 4-5 to 1 thought may affect LLM context understanding.
   - **Mitigation**: Monitor LLM behavior after deployment. Could adjust to 2 thoughts if needed.

4. **Prompt Token Budget**: New `<cognitive_ledger>` section adds ~100-200 tokens per prompt.
   - **Assessment**: Within acceptable limits based on existing prompt structure.

### Low Risk

5. **Persistence Listener Ordering**: New listener must not interfere with existing thought/notes persistence.
   - **Mitigation**: All listeners operate independently on same event.

---

## Implementation Sequence

### Phase 1: Schema and Component Infrastructure
1. Create `cognitive_ledger.component.json`
2. Add `COGNITIVE_LEDGER_COMPONENT_ID` constant
3. Update `llmOutputSchemas.js` (make `cognitive_ledger` OPTIONAL initially)
4. Write unit tests for component schema

### Phase 2: Prompt Pipeline Changes
1. Update `promptDataFormatter.js` with `formatCognitiveLedgerSection()`
2. Update `AIPromptContentProvider.js` (ledger extraction + thoughts slicing)
3. Update `characterPromptTemplate.js` with placeholder
4. Update `corePromptText.json` with instructions
5. Write unit tests for formatting and extraction

### Phase 3: Response Processing and Persistence
1. Update `LLMResponseProcessor.js` for extraction
2. Create `cognitiveLedgerPersistenceHook.js`
3. Create `cognitiveLedgerPersistenceListener.js`
4. Register listener in `initHelpers.js`
5. Write unit and integration tests

### Phase 4: Finalization
1. Make `cognitive_ledger` REQUIRED in V5 schema
2. Run full test suite
3. Manual testing with actual LLM
4. Update any affected documentation

---

## Verification Plan

### Unit Test Verification
```bash
npm run test:unit -- --testPathPattern="cognitiveLedger|promptDataFormatter|AIPromptContentProvider|llmOutputSchemas"
```

### Integration Test Verification
```bash
npm run test:integration -- --testPathPattern="cognitiveLedger|promptGeneration"
```

### Manual Verification
1. Start the application with `npm run dev`
2. Navigate to a character entity
3. Click "Prompt to LLM" button to view generated prompt
4. Verify `<cognitive_ledger>` section appears (or is absent on first turn)
5. Verify only 1 thought appears in `<thoughts>` section
6. Submit a turn and verify the cognitive_ledger persists to the entity
7. On next turn, verify the persisted ledger appears in the prompt

### Schema Validation Verification
```bash
npm run validate:strict
```

---

## Appendix: Key File Locations

| Purpose | File Path |
|---------|-----------|
| Component schema | `data/mods/core/components/cognitive_ledger.component.json` |
| Component ID constants | `src/constants/componentIds.js` |
| Response schema | `src/turns/schemas/llmOutputSchemas.js` |
| Prompt content provider | `src/prompting/AIPromptContentProvider.js` |
| Prompt data formatter | `src/prompting/promptDataFormatter.js` |
| Prompt template | `src/prompting/templates/characterPromptTemplate.js` |
| Prompt text content | `data/prompts/corePromptText.json` |
| Response processor | `src/turns/services/LLMResponseProcessor.js` |
| Initialization helpers | `src/initialization/initHelpers.js` |
