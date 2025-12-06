# OPEHANARCANA-021: Migrate seduction Mod Rules

**Status:** Ready
**Priority:** Medium (Phase 4 Migration)
**Estimated Effort:** 0.5 days
**Dependencies:** OPEHANARCANA-005 (PREPARE_ACTION_CONTEXT integration tests)

---

## Objective

Migrate all rules in the `seduction` mod from the expanded pattern to use `PREPARE_ACTION_CONTEXT`, reducing each rule from ~100 lines to ~15 lines (85% reduction).

---

## Files to Touch

### Modified Files

- All rule files in `data/mods/seduction/rules/*.rule.json`

---

## Out of Scope

**DO NOT modify:**

- Any action files (only rules)
- Any condition files
- Any component files
- Any entity files
- Rules in other mods
- Any handler implementations
- Any DI or schema files

---

## Migration Pattern

### Before (~100 lines per rule)

```json
{
  "actions": [
    // QUERY_COMPONENT (actor core:actor)
    // QUERY_COMPONENT (target core:actor)
    // QUERY_COMPONENT (actor core:position)
    // GET_NAME (actor)
    // GET_NAME (target)
    // SET_VARIABLE (actorName)
    // SET_VARIABLE (targetName)
    // SET_VARIABLE (locationId)
    // SET_VARIABLE (logMessage)
    // macro: core:logSuccessAndEndTurn
  ]
}
```

### After (~15 lines)

```json
{
  "id": "seduction:handle_[action_name]",
  "event": "ACTION_DECIDED",
  "condition": { "$ref": "seduction:event-is-action-[action-name]" },
  "actions": [
    { "type": "PREPARE_ACTION_CONTEXT" },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} [action description] {context.targetName}."
      }
    },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

---

## Migration Checklist

- [ ] List all rules in `data/mods/seduction/rules/`
- [ ] Migrate each rule to use PREPARE_ACTION_CONTEXT
- [ ] Validate JSON syntax for all modified rules
- [ ] Run seduction mod integration tests

---

## Acceptance Criteria

### Tests That Must Pass

1. **All seduction mod integration tests:**

   ```bash
   npm run test:integration -- tests/integration/mods/seduction/
   ```

2. **Mod validation:**

   ```bash
   npm run validate:mod:seduction
   ```

3. **Full test suite:**
   ```bash
   npm run test:ci
   ```

### Invariants That Must Remain True

1. All rules produce **identical runtime behavior** to before
2. Same events dispatched (perception events, log events)
3. All existing tests continue to pass without modification

---

## Verification Steps

```bash
# 1. List all rules to migrate
ls -la data/mods/seduction/rules/

# 2. Validate JSON syntax
for file in data/mods/seduction/rules/*.rule.json; do
  node -e "JSON.parse(require('fs').readFileSync('$file'))" && echo "OK: $file"
done

# 3. Run mod validation
npm run validate:mod:seduction

# 4. Run seduction-specific integration tests
npm run test:integration -- tests/integration/mods/seduction/ --verbose

# 5. Run full test suite
npm run test:ci
```

---

## Reference Files

- Original rules: `data/mods/seduction/rules/*.rule.json`
- Handler: `src/logic/operationHandlers/prepareActionContextHandler.js`
