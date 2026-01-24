# COGLEDACTPROIMP-005: Add cognitiveLedgerSection Placeholder to Prompt Template

Status: Completed

## Summary

Add the `{cognitiveLedgerSection}` placeholder to `CHARACTER_PROMPT_TEMPLATE` after `<perception_log>` and before `{thoughtsVoiceGuidance}`. Cognitive ledger formatting/extraction already exists; this ticket only wires the template and adds coverage at the prompt generation level.

## Assumptions Rechecked (Corrected)

- `formatCognitiveLedgerSection()` already exists in `src/prompting/promptDataFormatter.js`.
- `AIPromptContentProvider` already supplies `cognitiveLedger` in prompt data and limits thoughts to 1.
- The cognitive ledger component schema and ID constants already exist.
- The remaining missing piece for prompt output is the template placeholder insertion and prompt-generation integration coverage.

---

## Files to Touch

| File | Action |
|------|--------|
| `src/prompting/templates/characterPromptTemplate.js` | MODIFY |
| `tests/integration/prompting/cognitiveLedgerPromptGeneration.integration.test.js` | CREATE |

---

## Out of Scope

- **DO NOT** modify `MOOD_UPDATE_PROMPT_TEMPLATE` (cognitive ledger is action-phase only)
- **DO NOT** modify any other template placeholders
- **DO NOT** modify `corePromptText.json` (that's COGLEDACTPROIMP-006)
- **DO NOT** modify any response processor files
- **DO NOT** modify any files in `src/ai/`
- **DO NOT** modify any files in `src/turns/`
- **DO NOT** modify `promptBuilder.js` (uses substitution, should work automatically)

---

## Implementation Details

### Modify CHARACTER_PROMPT_TEMPLATE

**File**: `src/prompting/templates/characterPromptTemplate.js`

Change the template to add `{cognitiveLedgerSection}` after `</perception_log>` and before `{thoughtsVoiceGuidance}`:

```javascript
// Before:
</perception_log>

{thoughtsVoiceGuidance}

// After:
</perception_log>

{cognitiveLedgerSection}

{thoughtsVoiceGuidance}
```

The full modified section should look like:

```javascript
{perceptionLogVoiceGuidance}

<perception_log>
{perceptionLogContent}
</perception_log>

{cognitiveLedgerSection}

{thoughtsVoiceGuidance}

{thoughtsSection}
```

### Update JSDoc Version Comment

Update the version comment to reflect this change:

```javascript
/**
 * @file Character prompt template for AI character responses
 * @description Defines the standard structure for character AI prompts
 * @version 2.1 - Added cognitive ledger section (COGLEDACTPROIMP-005)
 */
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **New Integration Test**: `tests/integration/prompting/cognitiveLedgerPromptGeneration.integration.test.js`
   - Test: Generated prompt contains `<cognitive_ledger>` when component present
   - Test: Generated prompt does NOT contain `<cognitive_ledger>` when component absent
   - Test: `<cognitive_ledger>` appears after `</perception_log>`
   - Test: `<cognitive_ledger>` appears before thoughts section
   - Test: Full prompt generates without errors when cognitive ledger present
   - Test: Full prompt generates without errors when cognitive ledger absent

2. **Existing Tests**
   - `tests/integration/prompting/promptBuilder.test.js` passes (expected to be unaffected)
   - `npm run test:integration -- --testPathPatterns="prompt" --coverage=false` passes

### Invariants That Must Remain True

1. `MOOD_UPDATE_PROMPT_TEMPLATE` remains unchanged
2. All existing placeholders remain in their current positions
3. Template can still substitute all existing variables
4. Empty `{cognitiveLedgerSection}` (empty string) produces valid prompt
5. Export structure remains unchanged

---

## Verification Commands

```bash
# Run prompt integration tests
npm run test:integration -- --testPathPatterns="prompt" --coverage=false

# Run new integration tests
npm run test:integration -- --testPathPatterns="cognitiveLedgerPromptGeneration" --coverage=false

# Verify template structure
node -e "const t = require('./src/prompting/templates/characterPromptTemplate.js'); console.log(t.CHARACTER_PROMPT_TEMPLATE.includes('{cognitiveLedgerSection}'))"
```

---

## Dependencies

- **Requires**: COGLEDACTPROIMP-003 (formatter returns string for substitution) - already satisfied in current codebase
- **Requires**: COGLEDACTPROIMP-004 (content provider adds cognitiveLedgerSection to prompt data) - already satisfied in current codebase

---

## Outcome

- Added `{cognitiveLedgerSection}` placement and version bump in the character prompt template as planned.
- Added a prompt-generation integration test for cognitive ledger presence, absence, and placement as planned.
- Updated prompt assembly integration expectations to match the existing single-thought display rule (not originally called out in this ticket).
