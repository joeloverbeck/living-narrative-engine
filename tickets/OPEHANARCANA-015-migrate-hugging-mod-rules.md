# OPEHANARCANA-015: Migrate hugging Mod Rules

**Status:** Ready
**Priority:** High (Phase 2 Migration)
**Estimated Effort:** 0.5 days
**Dependencies:** OPEHANARCANA-011 (ESTABLISH DI), OPEHANARCANA-014 (BREAK DI)

---

## Objective

Migrate all 4 rules in the `hugging` mod from the expanded pattern to use `ESTABLISH_BIDIRECTIONAL_CLOSENESS` and `BREAK_BIDIRECTIONAL_CLOSENESS`, reducing each rule from ~200 lines to ~25 lines (88% reduction).

---

## Files to Touch

### Modified Files (4 rules)
- `data/mods/hugging/rules/handle_hug_tight.rule.json`
- `data/mods/hugging/rules/handle_release_hug.rule.json`
- `data/mods/hugging/rules/handle_embrace_from_behind.rule.json` (if exists)
- `data/mods/hugging/rules/handle_release_embrace.rule.json` (if exists)

---

## Out of Scope

**DO NOT modify:**
- Any action files (only rules)
- Any condition files
- Any component files
- Any entity files
- Rules in other mods
- The bidirectional closeness handlers themselves
- Any DI or schema files

---

## Migration Pattern

### Before (handle_hug_tight.rule.json - ~207 lines)

```json
{
  "actions": [
    // ~8 operations to query existing hugging state on actor
    // ~8 operations to query existing hugging state on target
    // ~6 IF blocks for third-party cleanup
    // REMOVE_COMPONENT (actor old hugging)
    // REMOVE_COMPONENT (actor being_hugged)
    // REMOVE_COMPONENT (target hugging)
    // REMOVE_COMPONENT (target being_hugged)
    // ADD_COMPONENT (actor hugging)
    // ADD_COMPONENT (target being_hugged)
    // REGENERATE_DESCRIPTION (actor)
    // REGENERATE_DESCRIPTION (target)
    // GET_NAME (actor)
    // GET_NAME (target)
    // SET_VARIABLE (x3)
    // macro: core:logSuccessAndEndTurn
  ]
}
```

### After (~25 lines)

```json
{
  "id": "hugging:handle_hug_tight",
  "event": "ACTION_DECIDED",
  "condition": { "$ref": "hugging:event-is-action-hug-tight" },
  "actions": [
    { "type": "PREPARE_ACTION_CONTEXT" },
    {
      "type": "ESTABLISH_BIDIRECTIONAL_CLOSENESS",
      "parameters": {
        "actor_component_type": "hugging:hugging",
        "target_component_type": "hugging:being_hugged",
        "actor_data": {
          "embraced_entity_id": "{event.payload.targetId}",
          "initiated": true
        },
        "target_data": {
          "hugging_entity_id": "{event.payload.actorId}",
          "consented": true
        },
        "existing_component_types_to_clean": [
          "hugging:hugging",
          "hugging:being_hugged"
        ]
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} hugs {context.targetName} tightly."
      }
    },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

### Release Pattern (handle_release_hug.rule.json)

```json
{
  "id": "hugging:handle_release_hug",
  "event": "ACTION_DECIDED",
  "condition": { "$ref": "hugging:event-is-action-release-hug" },
  "actions": [
    { "type": "PREPARE_ACTION_CONTEXT" },
    {
      "type": "BREAK_BIDIRECTIONAL_CLOSENESS",
      "parameters": {
        "actor_component_type": "hugging:hugging",
        "target_component_type": "hugging:being_hugged"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} releases the hug with {context.targetName}."
      }
    },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

---

## Migration Checklist

- [ ] `handle_hug_tight.rule.json` → ESTABLISH_BIDIRECTIONAL_CLOSENESS
- [ ] `handle_release_hug.rule.json` → BREAK_BIDIRECTIONAL_CLOSENESS
- [ ] `handle_embrace_from_behind.rule.json` → ESTABLISH_BIDIRECTIONAL_CLOSENESS (if exists)
- [ ] `handle_release_embrace.rule.json` → BREAK_BIDIRECTIONAL_CLOSENESS (if exists)
- [ ] Validate JSON syntax for all modified rules
- [ ] Run integration tests for hugging mod

---

## Acceptance Criteria

### Tests That Must Pass

1. **All hugging mod integration tests:**
   ```bash
   npm run test:integration -- tests/integration/mods/hugging/
   ```

2. **Mod validation:**
   ```bash
   npm run validate:mod:hugging
   ```

3. **Full test suite:**
   ```bash
   npm run test:ci
   ```

### Invariants That Must Remain True

1. All 4 rules produce **identical runtime behavior** to before
2. Third-party relationships are properly cleaned up
3. Same events dispatched (perception events, log events)
4. Descriptions regenerated for both entities
5. All existing tests continue to pass without modification

---

## Verification Steps

```bash
# 1. Validate JSON syntax
for file in data/mods/hugging/rules/*.rule.json; do
  node -e "JSON.parse(require('fs').readFileSync('$file'))" && echo "OK: $file"
done

# 2. Run mod validation
npm run validate:mod:hugging

# 3. Run hugging-specific integration tests
npm run test:integration -- tests/integration/mods/hugging/ --verbose

# 4. Run full test suite
npm run test:ci
```

---

## Testing Third-Party Cleanup

Verify the following scenarios work correctly:

1. **A hugs B, then A hugs C** → B should lose `being_hugged` component
2. **A hugs B, then C hugs B** → A should lose `hugging` component
3. **A hugs B, A releases** → Both lose components, descriptions regenerated

---

## Reference Files

- Original rules: `data/mods/hugging/rules/*.rule.json`
- Component definitions: `data/mods/hugging/components/*.component.json`
- Handler: `src/logic/operationHandlers/establishBidirectionalClosenessHandler.js`
