# OPEHANARCANA-007: Migrate caressing Mod Rules

**Status:** Ready
**Priority:** High (Phase 1 Migration Batch 1)
**Estimated Effort:** 0.25 days
**Dependencies:** OPEHANARCANA-005 (integration tests pass)

---

## Objective

Migrate all 11 rules in the `caressing` mod from the expanded pattern to use `PREPARE_ACTION_CONTEXT`, reducing each rule from ~45 lines to ~15 lines (67% reduction).

---

## Files to Touch

### Modified Files (11 rules)
- `data/mods/caressing/rules/handle_caress_abdomen.rule.json`
- `data/mods/caressing/rules/handle_caress_arm.rule.json`
- `data/mods/caressing/rules/handle_caress_back.rule.json`
- `data/mods/caressing/rules/handle_caress_cheek_softly.rule.json`
- `data/mods/caressing/rules/handle_caress_hair.rule.json`
- `data/mods/caressing/rules/handle_caress_hand.rule.json`
- `data/mods/caressing/rules/handle_caress_hip.rule.json`
- `data/mods/caressing/rules/handle_caress_leg.rule.json`
- `data/mods/caressing/rules/handle_caress_neck.rule.json`
- `data/mods/caressing/rules/handle_caress_shoulder.rule.json`
- `data/mods/caressing/rules/handle_caress_thigh.rule.json`

---

## Out of Scope

**DO NOT modify:**
- Any action files (only rules)
- Any condition files
- Any component files
- Any entity files
- Rules in other mods
- The PREPARE_ACTION_CONTEXT handler itself
- Any DI or schema files

---

## Migration Pattern

### Before (Example: handle_caress_cheek_softly.rule.json)

```json
{
  "actions": [
    { "type": "GET_NAME", "parameters": { "entity_ref": "actor", "result_variable": "actorName" } },
    { "type": "GET_NAME", "parameters": { "entity_ref": "target", "result_variable": "targetName" } },
    { "type": "QUERY_COMPONENT", "parameters": { "entity_ref": "actor", "component_type": "core:position", "result_variable": "actorPosition" } },
    { "type": "SET_VARIABLE", "parameters": { "variable_name": "logMessage", "value": "{context.actorName} softly caresses {context.targetName}'s cheek." } },
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
    { "type": "SET_VARIABLE", "parameters": { "variable_name": "logMessage", "value": "{context.actorName} softly caresses {context.targetName}'s cheek." } },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

---

## Migration Checklist Per Rule

For each of the 11 rules:

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

1. **All caressing mod integration tests:**
   ```bash
   npm run test:integration -- tests/integration/mods/caressing/
   ```

2. **Mod validation:**
   ```bash
   npm run validate:mod:caressing
   ```

3. **Full test suite:**
   ```bash
   npm run test:ci
   ```

### Invariants That Must Remain True

1. All 11 rules produce **identical runtime behavior** to before
2. Same events dispatched (perception events, log events)
3. Same context variables available to macro
4. No changes to action discovery or conditions
5. All existing tests continue to pass without modification

---

## Verification Steps

```bash
# 1. Validate JSON syntax for all modified rules
for file in data/mods/caressing/rules/*.rule.json; do
  node -e "JSON.parse(require('fs').readFileSync('$file'))" && echo "OK: $file"
done

# 2. Run mod validation
npm run validate:mod:caressing

# 3. Run caressing-specific integration tests
npm run test:integration -- tests/integration/mods/caressing/ --verbose

# 4. Run full test suite
npm run test:ci
```

---

## Rollback Plan

If issues are discovered:

1. Revert all rule files to previous version
2. Git: `git checkout HEAD~1 -- data/mods/caressing/rules/`
3. Verify tests pass again

---

## Reference Files

- Original pattern: Any current `data/mods/caressing/rules/*.rule.json`
- Handler: `src/logic/operationHandlers/prepareActionContextHandler.js`
- Macro: `data/mods/core/macros/logSuccessAndEndTurn.macro.json`
