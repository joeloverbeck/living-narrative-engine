# OPEHANARCANA-022: Migrate sex-\* Mods Rules (Batch)

**Status:** Ready
**Priority:** Medium (Phase 4 Migration)
**Estimated Effort:** 3 days
**Dependencies:** OPEHANARCANA-005 (PREPARE_ACTION_CONTEXT integration tests)

---

## Objective

Migrate all rules in the sex-related mods from the expanded pattern to use `PREPARE_ACTION_CONTEXT`. This is a batch migration covering ~100+ rules across multiple mods, reducing each from ~100 lines to ~15 lines (85% reduction).

---

## Files to Touch

### Modified Files (by mod)

**sex-core:**

- `data/mods/sex-core/rules/*.rule.json`

**sex-breastplay:**

- `data/mods/sex-breastplay/rules/*.rule.json`

**sex-dry-intimacy:**

- `data/mods/sex-dry-intimacy/rules/*.rule.json`

**sex-penile-manual:**

- `data/mods/sex-penile-manual/rules/*.rule.json`

**sex-penile-oral:**

- `data/mods/sex-penile-oral/rules/*.rule.json`

**sex-physical-control:**

- `data/mods/sex-physical-control/rules/*.rule.json`

**sex-vaginal-penetration:**

- `data/mods/sex-vaginal-penetration/rules/*.rule.json`

**sex-anal-penetration:**

- `data/mods/sex-anal-penetration/rules/*.rule.json`

---

## Out of Scope

**DO NOT modify:**

- Any action files (only rules)
- Any condition files
- Any component files
- Any entity files
- Rules in non-sex mods
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
  "id": "[mod]:handle_[action_name]",
  "event": "ACTION_DECIDED",
  "condition": { "$ref": "[mod]:event-is-action-[action-name]" },
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

## Migration Checklist (by mod)

### sex-core

- [ ] List all rules
- [ ] Migrate to PREPARE_ACTION_CONTEXT
- [ ] Validate JSON syntax
- [ ] Run tests

### sex-breastplay

- [ ] List all rules
- [ ] Migrate to PREPARE_ACTION_CONTEXT
- [ ] Validate JSON syntax
- [ ] Run tests

### sex-dry-intimacy

- [ ] List all rules
- [ ] Migrate to PREPARE_ACTION_CONTEXT
- [ ] Validate JSON syntax
- [ ] Run tests

### sex-penile-manual

- [ ] List all rules
- [ ] Migrate to PREPARE_ACTION_CONTEXT
- [ ] Validate JSON syntax
- [ ] Run tests

### sex-penile-oral

- [ ] List all rules
- [ ] Migrate to PREPARE_ACTION_CONTEXT
- [ ] Validate JSON syntax
- [ ] Run tests

### sex-physical-control

- [ ] List all rules
- [ ] Migrate to PREPARE_ACTION_CONTEXT
- [ ] Validate JSON syntax
- [ ] Run tests

### sex-vaginal-penetration

- [ ] List all rules
- [ ] Migrate to PREPARE_ACTION_CONTEXT
- [ ] Validate JSON syntax
- [ ] Run tests

### sex-anal-penetration

- [ ] List all rules
- [ ] Migrate to PREPARE_ACTION_CONTEXT
- [ ] Validate JSON syntax
- [ ] Run tests

---

## Acceptance Criteria

### Tests That Must Pass

1. **All sex-\* mod integration tests:**

   ```bash
   npm run test:integration -- tests/integration/mods/sex-core/
   npm run test:integration -- tests/integration/mods/sex-breastplay/
   npm run test:integration -- tests/integration/mods/sex-dry-intimacy/
   npm run test:integration -- tests/integration/mods/sex-penile-manual/
   npm run test:integration -- tests/integration/mods/sex-penile-oral/
   npm run test:integration -- tests/integration/mods/sex-physical-control/
   npm run test:integration -- tests/integration/mods/sex-vaginal-penetration/
   npm run test:integration -- tests/integration/mods/sex-anal-penetration/
   ```

2. **Mod validation for each:**

   ```bash
   npm run validate
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
# 1. Count rules to migrate
for mod in sex-core sex-breastplay sex-dry-intimacy sex-penile-manual sex-penile-oral sex-physical-control sex-vaginal-penetration sex-anal-penetration; do
  echo "=== $mod ==="
  ls data/mods/$mod/rules/*.rule.json 2>/dev/null | wc -l
done

# 2. Validate JSON syntax for a mod
for file in data/mods/sex-core/rules/*.rule.json; do
  node -e "JSON.parse(require('fs').readFileSync('$file'))" && echo "OK: $file"
done

# 3. Run full validation
npm run validate

# 4. Run full test suite
npm run test:ci
```

---

## Suggested Migration Order

1. **sex-core** - Foundation rules, likely shared patterns
2. **sex-breastplay** - Smaller mod, good for practice
3. **sex-dry-intimacy** - Related to breastplay
4. **sex-penile-manual** - Hand-related actions
5. **sex-penile-oral** - Oral actions
6. **sex-physical-control** - Control/dominance actions
7. **sex-vaginal-penetration** - Penetration rules
8. **sex-anal-penetration** - Similar to vaginal

---

## Notes

- This is a large batch migration
- Can be split into sub-tickets if needed
- Consider doing one mod per session to manage risk
- Always run tests after each mod migration

---

## Reference Files

- Handler: `src/logic/operationHandlers/prepareActionContextHandler.js`
- Test pattern: `tests/integration/mods/affection/` (migrated in OPEHANARCANA-006)
