# OPEHANARCANA-023: Migrate Remaining Mods Rules

**Status:** Ready
**Priority:** Low (Phase 4 Final Migration)
**Estimated Effort:** 2 days
**Dependencies:** OPEHANARCANA-005 (PREPARE_ACTION_CONTEXT integration tests)

---

## Objective

Migrate all remaining mods from the expanded pattern to use `PREPARE_ACTION_CONTEXT`. This covers mods not addressed in previous tickets, completing the full migration.

---

## Files to Touch

### Modified Files (by mod)

**positioning:**

- `data/mods/positioning/rules/*.rule.json`

**movement:**

- `data/mods/movement/rules/*.rule.json`

**physical-control:**

- `data/mods/physical-control/rules/*.rule.json`

**companionship:**

- `data/mods/companionship/rules/*.rule.json`

**violence:**

- `data/mods/violence/rules/*.rule.json`

**distress:**

- `data/mods/distress/rules/*.rule.json`

**gymnastics:**

- `data/mods/gymnastics/rules/*.rule.json`

**ballet:**

- `data/mods/ballet/rules/*.rule.json`

**music:**

- `data/mods/music/rules/*.rule.json`

**exercise:**

- `data/mods/exercise/rules/*.rule.json`

**patrol:**

- `data/mods/patrol/rules/*.rule.json`

**activity:**

- `data/mods/activity/rules/*.rule.json`

**weapons:**

- `data/mods/weapons/rules/*.rule.json`

**furniture:**

- `data/mods/furniture/rules/*.rule.json`

---

## Out of Scope

**DO NOT modify:**

- Action files (only rules)
- Condition files
- Component files
- Entity files
- Mods already migrated:
  - affection (OPEHANARCANA-006)
  - caressing (OPEHANARCANA-007)
  - kissing (OPEHANARCANA-008)
  - hugging (OPEHANARCANA-015)
  - hand-holding (OPEHANARCANA-016)
  - items (OPEHANARCANA-020)
  - seduction (OPEHANARCANA-021)
  - sex-\* mods (OPEHANARCANA-022)
- Handler implementations
- DI or schema files

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

## Migration Checklist

### Priority 1 (Large mods)

- [ ] positioning
- [ ] movement
- [ ] physical-control
- [ ] violence

### Priority 2 (Medium mods)

- [ ] companionship
- [ ] weapons
- [ ] furniture

### Priority 3 (Small mods)

- [ ] distress
- [ ] gymnastics
- [ ] ballet
- [ ] music
- [ ] exercise
- [ ] patrol
- [ ] activity

---

## Acceptance Criteria

### Tests That Must Pass

1. **Integration tests for each mod:**

   ```bash
   npm run test:integration -- tests/integration/mods/[mod]/
   ```

2. **Full validation:**

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
# 1. Count rules across all remaining mods
for mod in positioning movement physical-control companionship violence distress gymnastics ballet music exercise patrol activity weapons furniture; do
  count=$(ls data/mods/$mod/rules/*.rule.json 2>/dev/null | wc -l)
  if [ "$count" -gt 0 ]; then
    echo "$mod: $count rules"
  fi
done

# 2. Validate all mods
npm run validate

# 3. Run full test suite
npm run test:ci
```

---

## Notes

- Some mods may have no rules or very few rules
- Skip mods with 0 rules to migrate
- Prioritize mods with most rules first for maximum impact
- Consider creating sub-tickets for very large mods

---

## Reference Files

- Handler: `src/logic/operationHandlers/prepareActionContextHandler.js`
- Migration examples: Previous tickets (006, 007, 008)
