# DISPEREVEUPG-009: Items & Writing Rules - Perspective Upgrade

**Status:** ✅ Completed
**Completed:** 2025-12-18
**Priority:** Moderate (Priority 3)
**Estimated Effort:** 1 day (revised from 0.5 days due to test updates)
**Dependencies:** None
**Parent:** DISPEREVEUPG-000

---

## Objective

Upgrade the 4 items and writing rules to support perspective-aware perception with `actor_description` and `alternate_descriptions`.

---

## Pre-Implementation Findings

**Codebase Analysis (discovered during implementation):**

1. **handle_drink_entirely.rule.json** and **handle_read_item.rule.json** use a **dual-dispatch pattern** (two separate DISPATCH_PERCEPTIBLE_EVENT operations with `excludedActorIds`/`recipientIds`), not single-dispatch as originally assumed.

2. **Existing tests explicitly validate the dual-dispatch pattern** and will require updates to validate the new single-dispatch pattern.

3. **handle_jot_down_notes.rule.json** and **handle_sign_document.rule.json** match original assumptions (single-dispatch, just need perspective fields added).

---

## Files to Touch

### Modified Files (4 rules)

- `data/mods/items/rules/handle_drink_entirely.rule.json`
- `data/mods/items/rules/handle_read_item.rule.json`
- `data/mods/writing/rules/handle_jot_down_notes.rule.json`
- `data/mods/writing/rules/handle_sign_document.rule.json`

### Modified Test Files (4 tests - ADDED TO SCOPE)

- `tests/integration/mods/items/drinkEntirelyRuleExecution.test.js`
- `tests/integration/mods/items/readItemRuleExecution.test.js`
- `tests/integration/mods/writing/jotDownNotesRuleExecution.test.js`
- `tests/integration/mods/writing/signDocumentRuleExecution.test.js`

---

## Out of Scope

**DO NOT modify:**

- Any action files in these mods
- Any condition files in these mods
- Any component files
- Any entity files
- Rules in other mods
- Handler code (`src/logic/operationHandlers/`)
- Schema files (`data/schemas/`)
- Reference implementations (`handle_drink_from.rule.json`, `handle_corrupting_gaze.rule.json`)

---

## Implementation Details

### Pattern: Object Interaction (Actor + Object)

All four rules involve actor interacting with objects (drinks, books, documents). Each DISPATCH_PERCEPTIBLE_EVENT must include:
- `actor_description` (first-person)
- `alternate_descriptions` (auditory, tactile, olfactory where appropriate)
- `log_entry: true` for proper logging

No `target_description` is needed as objects don't receive perception messages.

### 1. handle_drink_entirely.rule.json

**Current State (discovered):** Uses dual-dispatch pattern with TWO DISPATCH_PERCEPTIBLE_EVENT operations:
- First event excludes actor via `excludedActorIds` (public message without flavor)
- Second event targets actor via `recipientIds` (private message with flavor)

**Required Change:** Convert to single-dispatch pattern (like reference `handle_drink_from.rule.json`):
- Remove second DISPATCH_PERCEPTIBLE_EVENT
- Add `actor_description` with first-person + flavorText
- Add `alternate_descriptions` with auditory entry
- Remove `excludedActorIds` from contextual_data
- Add `log_entry: true`

**Target Structure:**
```json
{
  "description_text": "{context.actorName} drinks entirely from {context.containerName}, emptying it.",
  "actor_description": "I drink entirely from {context.containerName}, draining it completely. {context.drinkResult.flavorText}",
  "log_entry": true,
  "alternate_descriptions": {
    "auditory": "I hear someone drinking nearby, finishing a beverage."
  }
}
```

### 2. handle_read_item.rule.json

**Current State (discovered):** Uses dual-dispatch pattern with TWO DISPATCH_PERCEPTIBLE_EVENT operations:
- First event excludes actor via `excludedActorIds` (public message without content)
- Second event targets actor via `recipientIds` (private message with readable text)

**Required Change:** Convert to single-dispatch pattern:
- Remove second DISPATCH_PERCEPTIBLE_EVENT
- Add `actor_description` with first-person + readable text content
- Add `alternate_descriptions` with auditory/tactile entries
- Remove `excludedActorIds` from contextual_data
- Add `log_entry: true`

**Target Structure:**
```json
{
  "description_text": "{context.actorName} reads {context.itemName}.",
  "actor_description": "I read {context.itemName}. It says: {context.itemReadable.text}",
  "log_entry": true,
  "alternate_descriptions": {
    "auditory": "I hear pages being turned nearby.",
    "tactile": "I sense someone handling a document or book nearby."
  }
}
```

### 3. handle_jot_down_notes.rule.json

**Current State:** Single DISPATCH_PERCEPTIBLE_EVENT (matches original assumption)

**Required Change:** Add perspective-aware fields:
- Add `actor_description` with first-person confirmation
- Add `alternate_descriptions` with auditory entry
- Add `log_entry: true`

**Target Structure:**
```json
{
  "description_text": "{context.actionMessage}",
  "actor_description": "I jot down notes on {context.notebookName} using {context.utensilName}.",
  "log_entry": true,
  "alternate_descriptions": {
    "auditory": "I hear the scratching of writing nearby."
  }
}
```

### 4. handle_sign_document.rule.json

**Current State:** Single DISPATCH_PERCEPTIBLE_EVENT (matches original assumption)

**Required Change:** Add perspective-aware fields:
- Add `actor_description` with first-person confirmation
- Add `alternate_descriptions` with auditory entry
- Add `log_entry: true`

**Target Structure:**
```json
{
  "description_text": "{context.actionMessage}",
  "actor_description": "I sign {context.documentName} using {context.utensilName}.",
  "log_entry": true,
  "alternate_descriptions": {
    "auditory": "I hear the scratch of a signature being written."
  }
}
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **Items integration tests:**
   ```bash
   NODE_ENV=test npx jest tests/integration/mods/items/ --no-coverage --silent
   ```

2. **Writing integration tests:**
   ```bash
   NODE_ENV=test npx jest tests/integration/mods/writing/ --no-coverage --silent
   ```

3. **Mod validations:**
   ```bash
   npm run validate:mod:items
   npm run validate:mod:writing
   ```

4. **Full test suite:**
   ```bash
   npm run test:ci
   ```

### Invariants That Must Remain True

1. All existing items and writing behavior is preserved
2. Drinking mechanics work correctly (container emptied, effects applied)
3. Reading mechanics work correctly (content revealed if applicable)
4. Writing mechanics work correctly (notes saved, documents signed)
5. Events dispatch with correct payloads
6. No regression in other mods

---

## Verification Steps

```bash
# 1. Validate JSON syntax for all modified rules
node -e "JSON.parse(require('fs').readFileSync('data/mods/items/rules/handle_drink_entirely.rule.json'))" && echo "OK: handle_drink_entirely"
node -e "JSON.parse(require('fs').readFileSync('data/mods/items/rules/handle_read_item.rule.json'))" && echo "OK: handle_read_item"
node -e "JSON.parse(require('fs').readFileSync('data/mods/writing/rules/handle_jot_down_notes.rule.json'))" && echo "OK: handle_jot_down_notes"
node -e "JSON.parse(require('fs').readFileSync('data/mods/writing/rules/handle_sign_document.rule.json'))" && echo "OK: handle_sign_document"

# 2. Run mod validations
npm run validate:mod:items
npm run validate:mod:writing

# 3. Run integration tests
NODE_ENV=test npx jest tests/integration/mods/items/ --no-coverage --verbose
NODE_ENV=test npx jest tests/integration/mods/writing/ --no-coverage --verbose

# 4. Run full test suite
npm run test:ci
```

---

## Reference Files

- Pattern to follow: `data/mods/items/rules/handle_drink_from.rule.json` (already upgraded - use as reference)
- Handler: `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js` (reference only)
- Schema: `data/schemas/operations/dispatchPerceptibleEvent.schema.json` (reference only)

---

## Completion Summary

**Completed:** 2025-12-18

### Changes Made

**Rule Files Modified (4):**
- `data/mods/items/rules/handle_drink_entirely.rule.json` - Converted from dual-dispatch to single-dispatch
- `data/mods/items/rules/handle_read_item.rule.json` - Converted from dual-dispatch to single-dispatch
- `data/mods/writing/rules/handle_jot_down_notes.rule.json` - Added perspective fields
- `data/mods/writing/rules/handle_sign_document.rule.json` - Added perspective fields

**Test Files Updated (4):**
- `tests/integration/mods/items/drinkEntirelyRuleExecution.test.js`
- `tests/integration/mods/items/readItemRuleExecution.test.js`
- `tests/integration/mods/writing/jotDownNotesRuleExecution.test.js`
- `tests/integration/mods/writing/signDocumentRuleExecution.test.js`

### Validation Results

- ✅ JSON syntax validation: All 4 rule files passed
- ✅ Mod validation: 0 violations across 63 mods
- ✅ Test results: 36 tests passed

### Key Implementation Discovery

The `actor_description`, `alternate_descriptions`, and `log_entry` fields are **NOT exposed in the dispatched event payload**. They are used internally by the log handler. The observable behavior in tests is:
- `contextualData.skipRuleLogging: true` when `log_entry: true` is configured

Tests were updated to validate observable behavior rather than checking for non-existent payload fields.
