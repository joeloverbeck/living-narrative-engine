# DISPEREVEUPG-009: Items & Writing Rules - Perspective Upgrade

**Status:** Ready
**Priority:** Moderate (Priority 3)
**Estimated Effort:** 0.5 days
**Dependencies:** None
**Parent:** DISPEREVEUPG-000

---

## Objective

Upgrade the 4 items and writing rules to support perspective-aware perception with `actor_description` and `alternate_descriptions`.

---

## Files to Touch

### Modified Files (4 rules)

- `data/mods/items/rules/handle_drink_entirely.rule.json`
- `data/mods/items/rules/handle_read_item.rule.json`
- `data/mods/writing/rules/handle_jot_down_notes.rule.json`
- `data/mods/writing/rules/handle_sign_document.rule.json`

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
- Test files (tests will verify behavior, not be modified)

---

## Implementation Details

### Pattern: Object Interaction (Actor + Object)

All four rules involve actor interacting with objects (drinks, books, documents). Each DISPATCH_PERCEPTIBLE_EVENT must include:
- `actor_description` (first-person)
- `alternate_descriptions` (auditory, tactile, olfactory where appropriate)

No `target_description` is needed as objects don't receive perception messages.

### 1. handle_drink_entirely.rule.json

**Current:** DISPATCH_PERCEPTIBLE_EVENT for drinking (Note: handle_drink_from.rule.json is already upgraded - use as reference)

**Upgrade:**
```json
{
  "description_text": "{context.actorName} drinks all of {context.itemName}.",
  "actor_description": "I drink the rest of {context.itemName}, draining it completely.",
  "alternate_descriptions": {
    "auditory": "I hear someone drinking nearby, finishing a beverage.",
    "olfactory": "I smell the scent of a drink being consumed."
  }
}
```

### 2. handle_read_item.rule.json

**Current:** DISPATCH_PERCEPTIBLE_EVENT for reading

**Upgrade:**
```json
{
  "description_text": "{context.actorName} reads {context.itemName}.",
  "actor_description": "I read {context.itemName}, absorbing its contents.",
  "alternate_descriptions": {
    "auditory": "I hear pages being turned nearby.",
    "tactile": "I sense someone handling a document or book nearby."
  }
}
```

### 3. handle_jot_down_notes.rule.json

**Current:** DISPATCH_PERCEPTIBLE_EVENT for writing

**Upgrade:**
```json
{
  "description_text": "{context.actorName} jots down notes.",
  "actor_description": "I write down my notes, recording my thoughts.",
  "alternate_descriptions": {
    "auditory": "I hear the scratching of writing nearby.",
    "tactile": "I sense deliberate hand movements, as if someone is writing."
  }
}
```

### 4. handle_sign_document.rule.json

**Current:** DISPATCH_PERCEPTIBLE_EVENT for signing

**Upgrade:**
```json
{
  "description_text": "{context.actorName} signs {context.documentName}.",
  "actor_description": "I sign {context.documentName}, putting my mark on it.",
  "alternate_descriptions": {
    "auditory": "I hear the scratch of a signature being written.",
    "tactile": "I sense a quick, deliberate writing motion nearby."
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
