# OPEHANARCANA-016: Migrate hand-holding Mod Rules

**Status:** Ready
**Priority:** High (Phase 2 Migration)
**Estimated Effort:** 0.5 days
**Dependencies:** OPEHANARCANA-011 (ESTABLISH DI), OPEHANARCANA-014 (BREAK DI)

---

## Objective

Migrate all rules in the `hand-holding` mod from the expanded pattern to use `ESTABLISH_BIDIRECTIONAL_CLOSENESS` and `BREAK_BIDIRECTIONAL_CLOSENESS`, reducing each rule from ~200 lines to ~25 lines (88% reduction).

---

## Files to Touch

### Modified Files (~8 rules estimated)

- `data/mods/hand-holding/rules/handle_hold_hand.rule.json`
- `data/mods/hand-holding/rules/handle_release_hand.rule.json`
- `data/mods/hand-holding/rules/handle_interlock_fingers.rule.json` (if exists)
- `data/mods/hand-holding/rules/handle_squeeze_hand.rule.json` (if exists)
- Additional hand-holding related rules

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

### Before (handle_hold_hand.rule.json - ~209 lines)

```json
{
  "actions": [
    // ~8 operations to query existing hand-holding state on actor
    // ~8 operations to query existing hand-holding state on target
    // ~6 IF blocks for third-party cleanup
    // REMOVE_COMPONENT (actor holding_hand)
    // REMOVE_COMPONENT (actor hand_held)
    // REMOVE_COMPONENT (target holding_hand)
    // REMOVE_COMPONENT (target hand_held)
    // ADD_COMPONENT (actor holding_hand)
    // ADD_COMPONENT (target hand_held)
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
  "id": "hand-holding:handle_hold_hand",
  "event": "ACTION_DECIDED",
  "condition": { "$ref": "hand-holding:event-is-action-hold-hand" },
  "actions": [
    { "type": "PREPARE_ACTION_CONTEXT" },
    {
      "type": "ESTABLISH_BIDIRECTIONAL_CLOSENESS",
      "parameters": {
        "actor_component_type": "hand-holding:holding_hand",
        "target_component_type": "hand-holding:hand_held",
        "actor_data": {
          "holding_hand_of": "{event.payload.targetId}",
          "initiated": true
        },
        "target_data": {
          "hand_held_by": "{event.payload.actorId}",
          "consented": true
        },
        "existing_component_types_to_clean": [
          "hand-holding:holding_hand",
          "hand-holding:hand_held"
        ]
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} takes {context.targetName}'s hand."
      }
    },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

### Release Pattern (handle_release_hand.rule.json)

```json
{
  "id": "hand-holding:handle_release_hand",
  "event": "ACTION_DECIDED",
  "condition": { "$ref": "hand-holding:event-is-action-release-hand" },
  "actions": [
    { "type": "PREPARE_ACTION_CONTEXT" },
    {
      "type": "BREAK_BIDIRECTIONAL_CLOSENESS",
      "parameters": {
        "actor_component_type": "hand-holding:holding_hand",
        "target_component_type": "hand-holding:hand_held"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} lets go of {context.targetName}'s hand."
      }
    },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

---

## Migration Checklist

- [ ] List all rules in `data/mods/hand-holding/rules/`
- [ ] Identify which rules use ESTABLISH pattern vs BREAK pattern
- [ ] Migrate each rule to appropriate new handler
- [ ] Validate JSON syntax for all modified rules
- [ ] Run integration tests for hand-holding mod

---

## Acceptance Criteria

### Tests That Must Pass

1. **All hand-holding mod integration tests:**

   ```bash
   npm run test:integration -- tests/integration/mods/hand-holding/
   ```

2. **Mod validation:**

   ```bash
   npm run validate:mod:hand-holding
   ```

3. **Full test suite:**
   ```bash
   npm run test:ci
   ```

### Invariants That Must Remain True

1. All rules produce **identical runtime behavior** to before
2. Third-party relationships are properly cleaned up
3. Same events dispatched (perception events, log events)
4. Descriptions regenerated for both entities
5. All existing tests continue to pass without modification

---

## Verification Steps

```bash
# 1. List all rules to migrate
ls -la data/mods/hand-holding/rules/

# 2. Validate JSON syntax
for file in data/mods/hand-holding/rules/*.rule.json; do
  node -e "JSON.parse(require('fs').readFileSync('$file'))" && echo "OK: $file"
done

# 3. Run mod validation
npm run validate:mod:hand-holding

# 4. Run hand-holding-specific integration tests
npm run test:integration -- tests/integration/mods/hand-holding/ --verbose

# 5. Run full test suite
npm run test:ci
```

---

## Testing Third-Party Cleanup

Verify the following scenarios work correctly:

1. **A holds B's hand, then A holds C's hand** → B should lose `hand_held` component
2. **A holds B's hand, then C holds B's hand** → A should lose `holding_hand` component
3. **A holds B's hand, A releases** → Both lose components, descriptions regenerated

---

## Reference Files

- Original rules: `data/mods/hand-holding/rules/*.rule.json`
- Component definitions: `data/mods/hand-holding/components/*.component.json`
- Handler: `src/logic/operationHandlers/establishBidirectionalClosenessHandler.js`
