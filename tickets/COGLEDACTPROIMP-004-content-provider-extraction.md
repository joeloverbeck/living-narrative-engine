# COGLEDACTPROIMP-004: Extract Cognitive Ledger and Slice Thoughts in AIPromptContentProvider

## Summary

Modify `AIPromptContentProvider` to:
1. Extract the cognitive ledger from the actor entity
2. Slice thoughts to show only the LATEST 1 (instead of all)
3. Add `cognitiveLedgerSection` to the returned prompt data

---

## Files to Touch

| File | Action |
|------|--------|
| `src/prompting/AIPromptContentProvider.js` | MODIFY |
| `tests/unit/prompting/AIPromptContentProvider.cognitiveLedger.test.js` | CREATE |
| `tests/unit/prompting/AIPromptContentProvider.promptData.test.js` | MODIFY (update for thoughts slicing) |

---

## Out of Scope

- **DO NOT** modify `characterPromptTemplate.js` (that's COGLEDACTPROIMP-005)
- **DO NOT** modify `corePromptText.json` (that's COGLEDACTPROIMP-006)
- **DO NOT** modify any response processor files
- **DO NOT** modify any files in `src/ai/`
- **DO NOT** modify any files in `src/turns/`
- **DO NOT** modify `promptDataFormatter.js` (done in COGLEDACTPROIMP-003)

---

## Implementation Details

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
const thoughts = shortTermMemory?.thoughts ?? [];

// After
const thoughts = (shortTermMemory?.thoughts ?? []).slice(-1);
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
_extractCognitiveLedger(actorData) {
  const cognitiveLedger = actorData.components?.[COGNITIVE_LEDGER_COMPONENT_ID];
  if (!cognitiveLedger) {
    return null;
  }
  return {
    settled_conclusions: cognitiveLedger.settled_conclusions ?? [],
    open_questions: cognitiveLedger.open_questions ?? [],
  };
}
```

### 4. Add to _buildPromptData Return Value

In `_buildPromptData`, call the extraction and formatter:

```javascript
const cognitiveLedger = this._extractCognitiveLedger(actor);
const cognitiveLedgerSection = this.#promptDataFormatter
  ? this.#promptDataFormatter.formatCognitiveLedgerSection(cognitiveLedger)
  : '';
```

Add `cognitiveLedgerSection` to the returned PromptData object.

### 5. Inject PromptDataFormatter Dependency

Ensure `AIPromptContentProvider` has access to `PromptDataFormatter`. Check if it's already injected; if not, add it as a dependency.

---

## Acceptance Criteria

### Tests That Must Pass

1. **New Test File**: `tests/unit/prompting/AIPromptContentProvider.cognitiveLedger.test.js`
   - Test: `_extractCognitiveLedger` returns null when component missing
   - Test: `_extractCognitiveLedger` returns data when component present
   - Test: `_extractCognitiveLedger` handles missing `settled_conclusions`
   - Test: `_extractCognitiveLedger` handles missing `open_questions`
   - Test: `getPromptData` includes `cognitiveLedgerSection` in return
   - Test: `cognitiveLedgerSection` is empty string when no ledger
   - Test: `cognitiveLedgerSection` is formatted XML when ledger present

2. **Updated Tests**: `tests/unit/prompting/AIPromptContentProvider.promptData.test.js`
   - Test: Thoughts array is sliced to max 1 element
   - Test: When 4 thoughts exist, only the last 1 appears in prompt data
   - Test: When 0 thoughts exist, empty array returned
   - Test: When 1 thought exists, that 1 thought returned

3. **Existing Tests**
   - All existing `AIPromptContentProvider` tests pass
   - `npm run test:unit -- --testPathPattern="AIPromptContentProvider"` passes

### Invariants That Must Remain True

1. All existing public method signatures remain unchanged
2. `getPromptData` continues to return all previously existing fields
3. Thoughts storage capacity in component (4) is unaffected
4. Other memory components (notes) extraction is unchanged
5. No changes to constructor's required parameters beyond what's needed

---

## Verification Commands

```bash
# Run content provider tests
npm run test:unit -- --testPathPattern="AIPromptContentProvider"

# Run specific new tests
npm run test:unit -- --testPathPattern="AIPromptContentProvider.cognitiveLedger"

# Verify thoughts slicing manually
# (would require integration test context)
```

---

## Dependencies

- **Requires**: COGLEDACTPROIMP-001 (component ID constant)
- **Requires**: COGLEDACTPROIMP-003 (formatter method)
