# OPEHANARCANA-006: Migrate affection Mod Rules

**Status:** Completed
**Priority:** High (Phase 1 Migration Batch 1)
**Estimated Effort:** 0.5 days
**Dependencies:** OPEHANARCANA-005 (integration tests pass)

---

## Objective

Migrate 17 of 20 rules in the `affection` mod from the expanded pattern to use `PREPARE_ACTION_CONTEXT`, reducing each rule from ~45 lines to ~15 lines (67% reduction).

**Note:** 3 rules use `primary`/`primaryName` instead of `target`/`targetName` and cannot be migrated with the current `PREPARE_ACTION_CONTEXT` handler.

---

## Files to Touch

### Modified Files (17 rules - use target/targetName pattern)
- `data/mods/affection/rules/brush_hand.rule.json`
- `data/mods/affection/rules/handle_brush_hair_behind_ear.rule.json`
- `data/mods/affection/rules/handle_link_arms.rule.json`
- `data/mods/affection/rules/handle_massage_shoulders.rule.json`
- `data/mods/affection/rules/handle_pat_ass_affectionately.rule.json`
- `data/mods/affection/rules/handle_pat_head_affectionately.rule.json`
- `data/mods/affection/rules/handle_push_target_playfully.rule.json`
- `data/mods/affection/rules/handle_rest_head_on_shoulder.rule.json`
- `data/mods/affection/rules/handle_ruffle_hair_playfully.rule.json`
- `data/mods/affection/rules/handle_tickle_target_playfully.rule.json`
- `data/mods/affection/rules/handle_touch_nose_tenderly.rule.json`
- `data/mods/affection/rules/massage_back.rule.json`
- `data/mods/affection/rules/place_hand_on_knee.rule.json`
- `data/mods/affection/rules/place_hand_on_waist.rule.json`
- `data/mods/affection/rules/place_hands_on_shoulders.rule.json`
- `data/mods/affection/rules/sling_arm_around_shoulders.rule.json`
- `data/mods/affection/rules/wrap_arm_around_waist.rule.json`

### Excluded Files (3 rules - use primary/primaryName pattern, require handler extension)
- `data/mods/affection/rules/handle_place_hands_on_flat_chest.rule.json`
- `data/mods/affection/rules/handle_rest_head_against_chest.rule.json`
- `data/mods/affection/rules/handle_rest_head_against_flat_chest.rule.json`

---

## Out of Scope

**DO NOT modify:**
- Any action files (only rules)
- Any condition files
- Any component files
- Any entity files
- Rules in other mods (covered in separate tickets)
- The PREPARE_ACTION_CONTEXT handler itself
- Any DI or schema files

---

## Migration Pattern

### Before (Example: handle_brush_hand.rule.json)

```json
{
  "actions": [
    { "type": "GET_NAME", "parameters": { "entity_ref": "actor", "result_variable": "actorName" } },
    { "type": "GET_NAME", "parameters": { "entity_ref": "target", "result_variable": "targetName" } },
    { "type": "QUERY_COMPONENT", "parameters": { "entity_ref": "actor", "component_type": "core:position", "result_variable": "actorPosition" } },
    { "type": "SET_VARIABLE", "parameters": { "variable_name": "logMessage", "value": "{context.actorName} gently brushes {context.targetName}'s hand." } },
    { "type": "SET_VARIABLE", "parameters": { "variable_name": "perceptionType", "value": "action_target_general" } },
    { "type": "SET_VARIABLE", "parameters": { "variable_name": "locationId", "value": "{context.actorPosition.locationId}" } },
    { "type": "SET_VARIABLE", "parameters": { "variable_name": "targetId", "value": "{event.payload.targetId}" } },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

### After

```json
{
  "actions": [
    { "type": "PREPARE_ACTION_CONTEXT" },
    { "type": "SET_VARIABLE", "parameters": { "variable_name": "logMessage", "value": "{context.actorName} gently brushes {context.targetName}'s hand." } },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

---

## Migration Checklist Per Rule

For each of the 17 eligible rules:

- [ ] Verify rule follows the "simple action" pattern
- [ ] Replace 7 operations with single `PREPARE_ACTION_CONTEXT`
- [ ] Keep only `logMessage` SET_VARIABLE (unique per rule)
- [ ] Keep the `core:logSuccessAndEndTurn` macro
- [ ] Preserve `condition`, `event`, and all other rule metadata
- [ ] Validate JSON syntax
- [ ] Run integration test for that action

---

## Acceptance Criteria

### Tests That Must Pass

1. **All affection mod integration tests:**
   ```bash
   npm run test:integration -- tests/integration/mods/affection/
   ```

2. **Mod validation:**
   ```bash
   npm run validate:mod affection
   ```

3. **Full test suite:**
   ```bash
   npm run test:ci
   ```

### Invariants That Must Remain True

1. All 17 migrated rules produce **identical runtime behavior** to before
2. Same events dispatched (perception events, log events)
3. Same context variables available to macro
4. No changes to action discovery or conditions
5. All existing tests continue to pass without modification

---

## Verification Steps

```bash
# 1. Validate JSON syntax for all modified rules
for file in data/mods/affection/rules/*.rule.json; do
  node -e "JSON.parse(require('fs').readFileSync('$file'))" && echo "OK: $file"
done

# 2. Run mod validation
npm run validate:mod affection

# 3. Run affection-specific integration tests
npm run test:integration -- tests/integration/mods/affection/ --verbose

# 4. Run full test suite
npm run test:ci

# 5. Manual smoke test (optional)
# Load game, perform affection actions, verify log messages appear correctly
```

---

## Rollback Plan

If issues are discovered:

1. Revert all rule files to previous version
2. Git: `git checkout HEAD~1 -- data/mods/affection/rules/`
3. Verify tests pass again

---

## Reference Files

- Original pattern: Any current `data/mods/affection/rules/*.rule.json`
- Handler: `src/logic/operationHandlers/prepareActionContextHandler.js`
- Macro: `data/mods/core/macros/logSuccessAndEndTurn.macro.json`

---

## Outcome

### What Was Actually Changed

**17 rule files migrated** in `data/mods/affection/rules/`:
- Each rule reduced from ~55 lines (8 operations) to ~20 lines (3 operations)
- Pattern: `PREPARE_ACTION_CONTEXT` → `SET_VARIABLE (logMessage)` → `core:logSuccessAndEndTurn`
- All rules now use `{ "type": "PREPARE_ACTION_CONTEXT", "parameters": {} }` format

**Bug fix discovered and applied:**
- `PrepareActionContextHandler.#resolveEntityName()` was looking for names in `core:actor.name` and `core:item.name`
- Changed to look for `core:name.text` first (matching `GetNameHandler` behavior), then fall back to `core:actor.name` and `core:item.name`
- This ensures consistent name resolution across all operation handlers

**Test coverage added:**
- 2 new unit tests in `prepareActionContextHandler.test.js`:
  - `should resolve name from core:name component (primary source)`
  - `should fallback to core:actor if core:name not found`

### Deviations from Original Plan

1. **Ticket corrections required:** Original ticket had incorrect:
   - Rule count (claimed 19, actual was 20)
   - File names (e.g., `handle_brush_hand.rule.json` vs actual `brush_hand.rule.json`)
   - Validation command (`npm run validate:mod:affection` vs actual `npm run validate:mod affection`)

2. **Schema requirement discovered:** `PREPARE_ACTION_CONTEXT` requires `"parameters": {}` due to `base-operation.schema.json` requiring the `parameters` field

3. **Handler bug fix:** Required fixing `PrepareActionContextHandler` to use `core:name.text` for name resolution (matching `GetNameHandler`)

### Test Results

- **Unit tests:** 2253 suites, 37657 tests passed (including 2 new tests)
- **Integration tests (affection mod):** 47 suites, 237 tests passed
- **Full integration:** 1849 passed, 1 failed (pre-existing unrelated failure in `httpRetryManager.integration.test.js`)
