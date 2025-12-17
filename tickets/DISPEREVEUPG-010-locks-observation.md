# DISPEREVEUPG-010: Locks & Observation Rules - Perspective Upgrade

**Status:** Ready
**Priority:** Moderate (Priority 3)
**Estimated Effort:** 0.5 days
**Dependencies:** None
**Parent:** DISPEREVEUPG-000

---

## Objective

Upgrade the 4 locks and observation rules to support perspective-aware perception with `actor_description` and `alternate_descriptions`.

---

## Files to Touch

### Modified Files (4 rules)

- `data/mods/locks/rules/handle_lock_connection.rule.json`
- `data/mods/locks/rules/handle_unlock_connection.rule.json`
- `data/mods/observation/rules/handle_examine_item_in_location.rule.json`
- `data/mods/observation/rules/handle_examine_owned_item.rule.json`

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

All four rules involve actor interacting with objects (locks, items). Each DISPATCH_PERCEPTIBLE_EVENT must include:
- `actor_description` (first-person)
- `alternate_descriptions` (auditory, tactile where appropriate)

No `target_description` is needed as objects don't receive perception messages.

### 1. handle_lock_connection.rule.json

**Current:** DISPATCH_PERCEPTIBLE_EVENT for locking

**Upgrade SUCCESS:**
```json
{
  "description_text": "{context.actorName} locks {context.connectionName}.",
  "actor_description": "I lock {context.connectionName}, securing it with a click.",
  "alternate_descriptions": {
    "auditory": "I hear the click of a lock engaging nearby.",
    "tactile": "I sense the vibration of a mechanism locking."
  }
}
```

**Upgrade FAILURE (no key):**
```json
{
  "description_text": "{context.actorName} cannot lock {context.connectionName}. They don't have the key.",
  "actor_description": "I try to lock {context.connectionName}, but I don't have the key.",
  "alternate_descriptions": {
    "auditory": "I hear a frustrated attempt to lock something."
  }
}
```

### 2. handle_unlock_connection.rule.json

**Current:** DISPATCH_PERCEPTIBLE_EVENT for unlocking

**Upgrade SUCCESS:**
```json
{
  "description_text": "{context.actorName} unlocks {context.connectionName}.",
  "actor_description": "I unlock {context.connectionName}, feeling the mechanism release.",
  "alternate_descriptions": {
    "auditory": "I hear the click of a lock disengaging nearby.",
    "tactile": "I sense the vibration of a mechanism unlocking."
  }
}
```

**Upgrade FAILURE (no key):**
```json
{
  "description_text": "{context.actorName} cannot unlock {context.connectionName}. They don't have the key.",
  "actor_description": "I try to unlock {context.connectionName}, but I don't have the key.",
  "alternate_descriptions": {
    "auditory": "I hear a frustrated attempt to unlock something."
  }
}
```

### 3. handle_examine_item_in_location.rule.json

**Current:** DISPATCH_PERCEPTIBLE_EVENT for examining

**Upgrade:**
```json
{
  "description_text": "{context.actorName} examines {context.itemName}.",
  "actor_description": "I examine {context.itemName} closely, noting its details.",
  "alternate_descriptions": {
    "auditory": "I hear someone inspecting something nearby.",
    "tactile": "I sense careful, deliberate handling of an object."
  }
}
```

### 4. handle_examine_owned_item.rule.json

**Current:** DISPATCH_PERCEPTIBLE_EVENT for examining owned item

**Upgrade:**
```json
{
  "description_text": "{context.actorName} examines {context.itemName} from their inventory.",
  "actor_description": "I examine {context.itemName} that I'm carrying, studying it carefully.",
  "alternate_descriptions": {
    "auditory": "I hear someone inspecting an item they're holding.",
    "tactile": "I sense someone carefully examining something in their hands."
  }
}
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **Locks integration tests:**
   ```bash
   NODE_ENV=test npx jest tests/integration/mods/locks/ --no-coverage --silent
   ```

2. **Observation integration tests:**
   ```bash
   NODE_ENV=test npx jest tests/integration/mods/observation/ --no-coverage --silent
   ```

3. **Mod validations:**
   ```bash
   npm run validate:mod:locks
   npm run validate:mod:observation
   ```

4. **Full test suite:**
   ```bash
   npm run test:ci
   ```

### Invariants That Must Remain True

1. All existing locks and observation behavior is preserved
2. Lock/unlock mechanics work correctly (state changes applied)
3. Key requirement validation still occurs
4. Examination mechanics work correctly (item details revealed)
5. Events dispatch with correct payloads
6. No regression in other mods

---

## Verification Steps

```bash
# 1. Validate JSON syntax for all modified rules
node -e "JSON.parse(require('fs').readFileSync('data/mods/locks/rules/handle_lock_connection.rule.json'))" && echo "OK: handle_lock_connection"
node -e "JSON.parse(require('fs').readFileSync('data/mods/locks/rules/handle_unlock_connection.rule.json'))" && echo "OK: handle_unlock_connection"
node -e "JSON.parse(require('fs').readFileSync('data/mods/observation/rules/handle_examine_item_in_location.rule.json'))" && echo "OK: handle_examine_item_in_location"
node -e "JSON.parse(require('fs').readFileSync('data/mods/observation/rules/handle_examine_owned_item.rule.json'))" && echo "OK: handle_examine_owned_item"

# 2. Run mod validations
npm run validate:mod:locks
npm run validate:mod:observation

# 3. Run integration tests
NODE_ENV=test npx jest tests/integration/mods/locks/ --no-coverage --verbose
NODE_ENV=test npx jest tests/integration/mods/observation/ --no-coverage --verbose

# 4. Run full test suite
npm run test:ci
```

---

## Reference Files

- Pattern to follow: `data/mods/items/rules/handle_drink_from.rule.json` (actor_description without target)
- Handler: `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js` (reference only)
- Schema: `data/schemas/operations/dispatchPerceptibleEvent.schema.json` (reference only)
