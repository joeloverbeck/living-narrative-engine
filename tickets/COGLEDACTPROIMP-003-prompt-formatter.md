# COGLEDACTPROIMP-003: Add formatCognitiveLedgerSection to PromptDataFormatter

## Summary

Add the `formatCognitiveLedgerSection()` method to `PromptDataFormatter` that formats the cognitive ledger data into XML for the prompt. Returns empty string when component is missing/null.

---

## Files to Touch

| File | Action |
|------|--------|
| `src/prompting/promptDataFormatter.js` | MODIFY (add 1 method) |
| `tests/unit/prompting/promptDataFormatter.cognitiveLedger.test.js` | CREATE |

---

## Out of Scope

- **DO NOT** modify `AIPromptContentProvider.js` (that's COGLEDACTPROIMP-004)
- **DO NOT** modify `characterPromptTemplate.js` (that's COGLEDACTPROIMP-005)
- **DO NOT** modify any response processor files
- **DO NOT** modify `corePromptText.json`
- **DO NOT** modify any files in `src/ai/`
- **DO NOT** modify any files in `src/turns/`
- **DO NOT** call the new method from anywhere yet

---

## Implementation Details

### Add Method to PromptDataFormatter

**File**: `src/prompting/promptDataFormatter.js`

Add the following method to the `PromptDataFormatter` class:

```javascript
/**
 * Formats the cognitive ledger section for the prompt.
 * Returns empty string if ledger is null/undefined (actor has no component).
 *
 * @param {Object|null|undefined} cognitiveLedger - The cognitive ledger data
 * @param {string[]} [cognitiveLedger.settled_conclusions] - Settled conclusions
 * @param {string[]} [cognitiveLedger.open_questions] - Open questions
 * @returns {string} Formatted XML section or empty string
 */
formatCognitiveLedgerSection(cognitiveLedger) {
  if (!cognitiveLedger) {
    return '';
  }

  const settled = cognitiveLedger.settled_conclusions || [];
  const open = cognitiveLedger.open_questions || [];

  // If both arrays are empty, still show the structure with [None yet] placeholders
  const settledList = settled.length > 0
    ? settled.map(item => `- ${item}`).join('\n')
    : '- [None yet]';

  const openList = open.length > 0
    ? open.map(item => `- ${item}`).join('\n')
    : '- [None yet]';

  return `<cognitive_ledger>
SETTLED CONCLUSIONS (treat as already integrated; do not re-argue unless NEW evidence appears):
${settledList}

OPEN QUESTIONS (allowed to think about now):
${openList}

NO RE-DERIVATION RULE (HARD):
- THOUGHTS may reference a settled conclusion only as a short tag.
- If you feel compelled to re-derive a settled point, convert that impulse into an in-character loop-break and move on.
</cognitive_ledger>`;
}
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **New Test File**: `tests/unit/prompting/promptDataFormatter.cognitiveLedger.test.js`
   - Test: Returns empty string when `cognitiveLedger` is `null`
   - Test: Returns empty string when `cognitiveLedger` is `undefined`
   - Test: Returns XML with "[None yet]" placeholders when both arrays are empty
   - Test: Returns XML with populated settled_conclusions list
   - Test: Returns XML with populated open_questions list
   - Test: Returns XML with both arrays populated
   - Test: Handles missing `settled_conclusions` property (treats as empty array)
   - Test: Handles missing `open_questions` property (treats as empty array)
   - Test: Output contains `<cognitive_ledger>` opening tag
   - Test: Output contains `</cognitive_ledger>` closing tag
   - Test: Output contains "NO RE-DERIVATION RULE (HARD):" section
   - Test: Each item is prefixed with "- " (dash space)

2. **Existing Tests**
   - `tests/unit/prompting/promptDataFormatter.test.js` passes unchanged
   - `npm run test:unit -- --testPathPattern="promptDataFormatter"` passes

### Invariants That Must Remain True

1. All existing `PromptDataFormatter` methods remain unchanged
2. No changes to method signatures of existing methods
3. Constructor signature remains unchanged
4. Existing tests pass without modification

---

## Verification Commands

```bash
# Run formatter tests
npm run test:unit -- --testPathPattern="promptDataFormatter"

# Run specific new tests
npm run test:unit -- --testPathPattern="promptDataFormatter.cognitiveLedger"

# Verify method exists
node -e "const F = require('./src/prompting/promptDataFormatter.js').default; const f = new F({info:()=>{}}); console.log(typeof f.formatCognitiveLedgerSection)"
```
