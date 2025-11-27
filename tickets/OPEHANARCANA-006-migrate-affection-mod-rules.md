# OPEHANARCANA-006: Migrate affection Mod Rules

**Status:** Ready
**Priority:** High (Phase 1 Migration Batch 1)
**Estimated Effort:** 0.5 days
**Dependencies:** OPEHANARCANA-005 (integration tests pass)

---

## Objective

Migrate all 19 rules in the `affection` mod from the expanded pattern to use `PREPARE_ACTION_CONTEXT`, reducing each rule from ~45 lines to ~15 lines (67% reduction).

---

## Files to Touch

### Modified Files (19 rules)
- `data/mods/affection/rules/handle_brush_hand.rule.json`
- `data/mods/affection/rules/handle_massage_back.rule.json`
- `data/mods/affection/rules/handle_massage_shoulders.rule.json`
- `data/mods/affection/rules/handle_pat_head.rule.json`
- `data/mods/affection/rules/handle_place_hands_on_shoulders.rule.json`
- `data/mods/affection/rules/handle_ruffle_hair_playfully.rule.json`
- `data/mods/affection/rules/handle_scratch_back.rule.json`
- `data/mods/affection/rules/handle_squeeze_shoulder.rule.json`
- `data/mods/affection/rules/handle_stroke_arm.rule.json`
- `data/mods/affection/rules/handle_stroke_back.rule.json`
- `data/mods/affection/rules/handle_stroke_hair.rule.json`
- `data/mods/affection/rules/handle_tap_shoulder.rule.json`
- `data/mods/affection/rules/handle_tickle_target_playfully.rule.json`
- `data/mods/affection/rules/handle_touch_arm.rule.json`
- `data/mods/affection/rules/handle_touch_cheek.rule.json`
- `data/mods/affection/rules/handle_touch_hand.rule.json`
- `data/mods/affection/rules/handle_trace_fingers_along_arm.rule.json`
- `data/mods/affection/rules/handle_rub_nose_against_cheek.rule.json`
- `data/mods/affection/rules/handle_rub_nose_against_nose.rule.json`

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

For each of the 19 rules:

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
   npm run validate:mod:affection
   ```

3. **Full test suite:**
   ```bash
   npm run test:ci
   ```

### Invariants That Must Remain True

1. All 19 rules produce **identical runtime behavior** to before
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
npm run validate:mod:affection

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
