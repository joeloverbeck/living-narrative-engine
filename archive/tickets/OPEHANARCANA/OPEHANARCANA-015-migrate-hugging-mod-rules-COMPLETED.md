# OPEHANARCANA-015: Migrate hugging Mod Rules

**Status:** Completed
**Priority:** High (Phase 2 Migration)
**Estimated Effort:** 0.25 days
**Dependencies:** OPEHANARCANA-011 (ESTABLISH DI), OPEHANARCANA-014 (BREAK DI)

---

## Objective

Migrate `handle_hug_tight.rule.json` in the `hugging` mod from the expanded pattern to use `ESTABLISH_BIDIRECTIONAL_CLOSENESS`, reducing the rule from ~208 lines to ~35 lines (83% reduction).

**Scope Reduction Note:** The original ticket planned to migrate all 4 rules using both `ESTABLISH_BIDIRECTIONAL_CLOSENESS` and `BREAK_BIDIRECTIONAL_CLOSENESS`. However, analysis revealed that the release rules (`handle_release_hug`, `handle_release_self_from_hug`, `handle_release_self_from_hug_forceful`) have **conditional removal logic** that preserves unrelated relationships with third parties. The `BREAK_BIDIRECTIONAL_CLOSENESS` handler removes components **unconditionally**, which would break existing test expectations.

---

## Assumption Corrections

| Original Assumption | Reality |
|---------------------|---------|
| Rule files: `handle_embrace_from_behind.rule.json`, `handle_release_embrace.rule.json` | These DO NOT EXIST. Actual files: `handle_release_self_from_hug.rule.json`, `handle_release_self_from_hug_forceful.rule.json` |
| Component namespace: `hugging:hugging`, `hugging:being_hugged` | Actual: `positioning:hugging`, `positioning:being_hugged` (defined in positioning mod) |
| Release rules: Simple unconditional removal | Reality: Conditional removal that preserves unrelated relationships |

---

## Files to Touch

### Modified Files (1 rule)
- `data/mods/hugging/rules/handle_hug_tight.rule.json`

### NOT Modified (behavioral incompatibility)
- `data/mods/hugging/rules/handle_release_hug.rule.json` - requires conditional removal
- `data/mods/hugging/rules/handle_release_self_from_hug.rule.json` - requires conditional removal
- `data/mods/hugging/rules/handle_release_self_from_hug_forceful.rule.json` - requires conditional removal

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
- Release rules (incompatible with BREAK_BIDIRECTIONAL_CLOSENESS)

---

## Migration Pattern

### Before (handle_hug_tight.rule.json - 208 lines)

```json
{
  "actions": [
    // GET_NAME (actor, target)
    // QUERY_COMPONENT (actorPosition)
    // QUERY_COMPONENTS (actor: hugging, being_hugged)
    // QUERY_COMPONENTS (target: hugging, being_hugged)
    // 4x IF blocks for third-party cleanup
    // 4x REMOVE_COMPONENT (actor/target hugging/being_hugged)
    // 2x ADD_COMPONENT (actor hugging, target being_hugged)
    // 4x SET_VARIABLE (logMessage, perceptionType, locationId, targetId)
    // 2x REGENERATE_DESCRIPTION (actor, target)
    // macro: core:logSuccessAndEndTurn
  ]
}
```

### After (~35 lines)

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_hug_tight",
  "comment": "Handles the 'hugging:hug_tight' action.",
  "event_type": "core:attempt_action",
  "condition": { "condition_ref": "hugging:event-is-action-hug-tight" },
  "actions": [
    { "type": "GET_NAME", "parameters": { "entity_ref": "actor", "result_variable": "actorName" } },
    { "type": "GET_NAME", "parameters": { "entity_ref": "target", "result_variable": "targetName" } },
    { "type": "QUERY_COMPONENT", "parameters": { "entity_ref": "actor", "component_type": "core:position", "result_variable": "actorPosition" } },
    {
      "type": "ESTABLISH_BIDIRECTIONAL_CLOSENESS",
      "parameters": {
        "actor_component_type": "positioning:hugging",
        "target_component_type": "positioning:being_hugged",
        "actor_data": { "embraced_entity_id": "{event.payload.targetId}", "initiated": true },
        "target_data": { "hugging_entity_id": "{event.payload.actorId}", "consented": true },
        "existing_component_types_to_clean": ["positioning:hugging", "positioning:being_hugged"]
      }
    },
    { "type": "SET_VARIABLE", "parameters": { "variable_name": "logMessage", "value": "{context.actorName} closes their arms around {context.targetName} tenderly, hugging {context.targetName} tight." } },
    { "type": "SET_VARIABLE", "parameters": { "variable_name": "perceptionType", "value": "action_target_general" } },
    { "type": "SET_VARIABLE", "parameters": { "variable_name": "locationId", "value": "{context.actorPosition.locationId}" } },
    { "type": "SET_VARIABLE", "parameters": { "variable_name": "targetId", "value": "{event.payload.targetId}" } },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

---

## Migration Checklist

- [x] `handle_hug_tight.rule.json` → ESTABLISH_BIDIRECTIONAL_CLOSENESS
- [x] Validate JSON syntax for modified rule
- [x] Run integration tests for hugging mod

### NOT Migrated (documented reason)
- [ ] ~~`handle_release_hug.rule.json`~~ - requires conditional removal logic
- [ ] ~~`handle_release_self_from_hug.rule.json`~~ - requires conditional removal logic
- [ ] ~~`handle_release_self_from_hug_forceful.rule.json`~~ - requires conditional removal logic

---

## Acceptance Criteria

### Tests That Must Pass

1. **All hugging mod integration tests:**
   ```bash
   NODE_ENV=test npm run test:integration -- tests/integration/mods/hugging/
   ```

2. **Full test suite:**
   ```bash
   NODE_ENV=test npm run test:ci
   ```

### Invariants That Must Remain True

1. `handle_hug_tight.rule.json` produces **identical runtime behavior** to before
2. Third-party relationships are properly cleaned up during hug establishment
3. Same events dispatched (perception events, log events)
4. Descriptions regenerated for both entities
5. All existing tests continue to pass without modification

---

## Verification Steps

```bash
# 1. Validate JSON syntax
node -e "JSON.parse(require('fs').readFileSync('data/mods/hugging/rules/handle_hug_tight.rule.json'))"

# 2. Run hugging-specific integration tests
NODE_ENV=test npm run test:integration -- tests/integration/mods/hugging/ --verbose

# 3. Run full test suite
NODE_ENV=test npm run test:ci
```

---

## Testing Third-Party Cleanup

Verify the following scenarios work correctly:

1. **A hugs B, then A hugs C** → B should lose `being_hugged` component
2. **A hugs B, then C hugs B** → A should lose `hugging` component

---

## Reference Files

- Original rule: `data/mods/hugging/rules/handle_hug_tight.rule.json`
- Component definitions: `data/mods/positioning/components/hugging.component.json`, `data/mods/positioning/components/being_hugged.component.json`
- Handler: `src/logic/operationHandlers/establishBidirectionalClosenessHandler.js`

---

## Why Release Rules Cannot Be Migrated

The release rules have conditional logic like:

```json
{
  "type": "IF",
  "parameters": {
    "condition": {
      "and": [
        { "var": "context.actorHuggingComponent" },
        { "==": [{ "var": "context.actorHuggingComponent.embraced_entity_id" }, { "var": "event.payload.targetId" }] }
      ]
    },
    "then_actions": [
      { "type": "REMOVE_COMPONENT", "parameters": { "entity_ref": "actor", "component_type": "positioning:hugging" } }
    ]
  }
}
```

This ensures that if actor is hugging **someone else**, their hugging component is preserved.

The `BREAK_BIDIRECTIONAL_CLOSENESS` handler unconditionally removes all specified components, which would break test:
- `"leaves unrelated embrace data untouched when the actor references a different partner"`

To migrate release rules, the handler would need a new `match_data` parameter for conditional removal - a separate enhancement ticket.

---

## Outcome

**Completion Date:** 2025-12-03

### Planned vs Actual

| Aspect | Original Plan | Actual Outcome |
|--------|---------------|----------------|
| Rules migrated | 4 rules | 1 rule (`handle_hug_tight.rule.json`) |
| Handlers used | ESTABLISH + BREAK | ESTABLISH only |
| Line reduction | ~88% per rule | 65% (208 → 73 lines) |
| Tests modified | None expected | None needed |

### Summary

Successfully migrated `handle_hug_tight.rule.json` to use `ESTABLISH_BIDIRECTIONAL_CLOSENESS`.

The release rules (`handle_release_hug`, `handle_release_self_from_hug`, `handle_release_self_from_hug_forceful`) were **not migrated** because they contain conditional removal logic that preserves unrelated third-party relationships. The `BREAK_BIDIRECTIONAL_CLOSENESS` handler removes components unconditionally, which would break existing test expectations.

### Test Results

- **All 34 hugging integration tests pass** ✅
- **JSON validation passes** ✅
- No new tests required

### Future Work

To migrate the release rules, a new enhancement ticket would be needed to add conditional removal support (`match_data` parameter) to the `BREAK_BIDIRECTIONAL_CLOSENESS` handler.
