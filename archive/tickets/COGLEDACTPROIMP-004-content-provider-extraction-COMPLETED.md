# COGLEDACTPROIMP-004: Extract Cognitive Ledger and Slice Thoughts in AIPromptContentProvider

## Summary

Modify `AIPromptContentProvider` to:
1. Extract the cognitive ledger from the actor entity components
2. Slice thoughts to show only the LATEST 1 (instead of all)
3. Provide cognitive ledger data to the prompt pipeline (formatter will emit `cognitiveLedgerSection`)

---

## Files to Touch

| File | Action |
|------|--------|
| `src/prompting/AIPromptContentProvider.js` | MODIFY |
| `src/prompting/promptDataFormatter.js` | MODIFY (wire `cognitiveLedgerSection` into `formatPromptData`) |
| `tests/unit/prompting/AIPromptContentProvider.cognitiveLedger.test.js` | CREATE |
| `tests/unit/prompting/AIPromptContentProvider.helpers.test.js` | MODIFY (thoughts slicing + ledger extraction) |
| `tests/unit/prompting/AIPromptContentProvider.getMoodUpdatePromptData.test.js` | MODIFY (thoughts slicing) |
| `tests/unit/prompting/AIPromptContentProvider.test.js` | MODIFY (promptData shape) |
| `tests/unit/prompting/promptDataFormatter.test.js` | MODIFY (promptData includes `cognitiveLedgerSection`) |

---

## Out of Scope

- **DO NOT** modify `characterPromptTemplate.js` (that's COGLEDACTPROIMP-005)
- **DO NOT** modify `corePromptText.json` (that's COGLEDACTPROIMP-006)
- **DO NOT** modify any response processor files
- **DO NOT** modify any files in `src/ai/`
- **DO NOT** modify any files in `src/turns/`

Note: `promptDataFormatter.js` already has `formatCognitiveLedgerSection()` from COGLEDACTPROIMP-003; this ticket only wires it into `formatPromptData`.

---

## Implementation Details

### Current-State Corrections (Assumptions)

- `COGNITIVE_LEDGER_COMPONENT_ID` already exists in `src/constants/componentIds.js` (COGLEDACTPROIMP-001).
- `PromptDataFormatter.formatCognitiveLedgerSection()` already exists and is used by `PromptBuilder`, not by `AIPromptContentProvider`.
- `AIPromptContentProvider` should return raw `cognitiveLedger` data; `PromptDataFormatter` will emit `cognitiveLedgerSection`.

### 1. Import the Component ID

At top of file, add import:

```javascript
import { COGNITIVE_LEDGER_COMPONENT_ID } from '../constants/componentIds.js';
```

### 2. Modify _extractMemoryComponents Method

**Current behavior**: Returns all thoughts from `core:short_term_memory.thoughts`

**New behavior**:
- Slice thoughts to only the last 1: `.slice(-1)`
- This preserves storage capacity (4 in component) but limits prompt display

Find the line that extracts thoughts and add `.slice(-1)`:

```javascript
// Before
const thoughtsArray = Array.isArray(memoryComp?.thoughts)
  ? memoryComp.thoughts.filter((t) => t && t.text)
  : [];

// After
const thoughtsArray = Array.isArray(memoryComp?.thoughts)
  ? memoryComp.thoughts.filter((t) => t && t.text).slice(-1)
  : [];
```

### 3. Add Cognitive Ledger Extraction

Add a new private method `_extractCognitiveLedger`:

```javascript
/**
 * Extracts cognitive ledger data from the actor entity.
 * Returns null if component is not present.
 *
 * @param {Object} actorData - Actor data from game state
 * @returns {Object|null} Cognitive ledger data or null
 */
_extractCognitiveLedger(componentsMap) {
  const cognitiveLedger = componentsMap?.[COGNITIVE_LEDGER_COMPONENT_ID];
  if (!cognitiveLedger) {
    return null;
  }
  return {
    settled_conclusions: Array.isArray(cognitiveLedger.settled_conclusions)
      ? cognitiveLedger.settled_conclusions
      : [],
    open_questions: Array.isArray(cognitiveLedger.open_questions)
      ? cognitiveLedger.open_questions
      : [],
  };
}
```

### 4. Add to _buildPromptData Return Value

In `_buildPromptData`, call the extraction and formatter:

```javascript
const cognitiveLedger = this._extractCognitiveLedger(componentsMap);
```

Add `cognitiveLedger` to the returned PromptData object.

### 5. Wire `cognitiveLedgerSection` in PromptDataFormatter

In `PromptDataFormatter.formatPromptData()`, add:

```javascript
formattedData.cognitiveLedgerSection =
  this.formatCognitiveLedgerSection(promptData.cognitiveLedger);
```

No changes to `AIPromptContentProvider` dependencies are needed.

---

## Acceptance Criteria

### Tests That Must Pass

1. **New Test File**: `tests/unit/prompting/AIPromptContentProvider.cognitiveLedger.test.js`
   - Test: `_extractCognitiveLedger` returns null when component missing
   - Test: `_extractCognitiveLedger` returns data when component present
   - Test: `_extractCognitiveLedger` handles missing `settled_conclusions`
   - Test: `_extractCognitiveLedger` handles missing `open_questions`
   - Test: `getPromptData` includes `cognitiveLedger` in return
   - Test: `getMoodUpdatePromptData` includes `cognitiveLedger` in return

2. **Updated Tests**: `tests/unit/prompting/AIPromptContentProvider.helpers.test.js`
   - Test: Thoughts array is sliced to max 1 element
   - Test: When 4 thoughts exist, only the last 1 appears in prompt data
   - Test: When 0 thoughts exist, empty array returned
   - Test: When 1 thought exists, that 1 thought returned

3. **Existing Tests**
   - All existing `AIPromptContentProvider` tests pass
- `npm run test:unit -- --testPathPatterns="AIPromptContentProvider|promptDataFormatter" --coverage=false` passes

### Invariants That Must Remain True

1. All existing public method signatures remain unchanged
2. `getPromptData` continues to return all previously existing fields
3. Thoughts storage capacity in component (4) is unaffected
4. Other memory components (notes) extraction is unchanged
5. No changes to constructor's required parameters

---

## Verification Commands

```bash
# Run content provider tests
npm run test:unit -- --testPathPatterns="AIPromptContentProvider|promptDataFormatter" --coverage=false

# Run specific new tests
npm run test:unit -- --testPathPatterns="AIPromptContentProvider.cognitiveLedger" --coverage=false

# Verify thoughts slicing manually
# (would require integration test context)
```

---

## Dependencies

- **Requires**: COGLEDACTPROIMP-001 (component ID constant)
- **Requires**: COGLEDACTPROIMP-003 (formatter method)
- **Pairs with**: COGLEDACTPROIMP-005 (template placeholder), COGLEDACTPROIMP-006 (prompt instructions)

## Status

Completed.

## Outcome

- AIPromptContentProvider now slices short-term thoughts to the latest 1 and includes `cognitiveLedger` in prompt data for both prompt types.
- PromptDataFormatter now emits `cognitiveLedgerSection` from prompt data (ready for the template placeholder in COGLEDACTPROIMP-005).
- Unit tests updated/added to cover ledger extraction, prompt data wiring, and thought slicing.
