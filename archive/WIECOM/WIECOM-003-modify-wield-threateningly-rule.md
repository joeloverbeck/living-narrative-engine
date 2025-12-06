# WIECOM-003: Modify Wield Threateningly Rule

## Summary

Update the `handle_wield_threateningly.rule.json` to add the `positioning:wielding` component to the actor and regenerate their description.

## Dependencies

- WIECOM-001 must be completed (component definition must exist)
- WIECOM-002 must be completed (component must be registered in manifest)

## Files to Touch

| File                                                                           | Action | Description                                           |
| ------------------------------------------------------------------------------ | ------ | ----------------------------------------------------- |
| `data/mods/weapons/rules/handle_wield_threateningly.rule.json`                 | MODIFY | Add component management and description regeneration |
| `data/mods/weapons/mod-manifest.json`                                          | MODIFY | Add positioning dependency for wielding component     |
| `tests/integration/mods/weapons/wieldThreateninglyRuleValidation.test.js`      | MODIFY | Update action count expectation from 8 to 11          |
| `tests/integration/mods/weapons/wieldingComponentWorkflow.integration.test.js` | CREATE | Integration tests for wielding component addition     |

## Out of Scope

- **DO NOT** modify any component files
- **DO NOT** modify any manifest files
- **DO NOT** modify the action definition (`wield_threateningly.action.json`)
- **DO NOT** modify any source code files
- **DO NOT** add stop-wielding or weapon-dropping logic
- **DO NOT** modify any condition files
- **DO NOT** change existing operations (GET_NAME, QUERY_COMPONENT, SET_VARIABLE) beyond their original purpose

## Test Impact Note

Existing test `wieldThreateninglyRuleValidation.test.js` expects exactly 8 actions (line 28). After adding 3 new operations, the rule will have 11 actions. **This test MUST be updated** as part of implementation to reflect the new action count.

## Implementation Details

Add three new operations after the existing `SET_VARIABLE` for `targetId` (line 56-58) and before the macro call (line 60-62):

### Operations to Add

1. **QUERY_COMPONENT** - Check if actor already has wielding component
2. **IF** - Conditionally append to existing array or create new component
3. **REGENERATE_DESCRIPTION** - Update actor description

### Current Rule Structure (simplified)

```json
{
  "actions": [
    { "type": "GET_NAME", "parameters": { "entity_ref": "actor", ... } },
    { "type": "GET_NAME", "parameters": { "entity_ref": "target", ... } },
    { "type": "QUERY_COMPONENT", "parameters": { "component_type": "core:position", ... } },
    { "type": "SET_VARIABLE", "parameters": { "variable_name": "logMessage", ... } },
    { "type": "SET_VARIABLE", "parameters": { "variable_name": "perceptionType", ... } },
    { "type": "SET_VARIABLE", "parameters": { "variable_name": "locationId", ... } },
    { "type": "SET_VARIABLE", "parameters": { "variable_name": "targetId", ... } },
    // <-- INSERT NEW OPERATIONS HERE
    { "comment": "Log success and end turn", "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

### New Operations to Insert

```json
{
  "type": "QUERY_COMPONENT",
  "comment": "Check if actor already has wielding component",
  "parameters": {
    "entity_ref": "actor",
    "component_type": "positioning:wielding",
    "result_variable": "existingWielding",
    "missing_value": null
  }
},
{
  "type": "IF",
  "comment": "Add to existing array or create new component",
  "parameters": {
    "condition": { "var": "context.existingWielding" },
    "then_actions": [
      {
        "type": "MODIFY_ARRAY_FIELD",
        "comment": "Append weapon to existing wielded_item_ids array",
        "parameters": {
          "entity_ref": "actor",
          "component_type": "positioning:wielding",
          "field": "wielded_item_ids",
          "mode": "push_unique",
          "value": "{event.payload.targetId}"
        }
      }
    ],
    "else_actions": [
      {
        "type": "ADD_COMPONENT",
        "comment": "Create new wielding component with weapon in array",
        "parameters": {
          "entity_ref": "actor",
          "component_type": "positioning:wielding",
          "value": {
            "wielded_item_ids": ["{event.payload.targetId}"]
          }
        }
      }
    ]
  }
},
{
  "type": "REGENERATE_DESCRIPTION",
  "comment": "Update actor description to include wielding activity",
  "parameters": { "entity_ref": "actor" }
}
```

## Acceptance Criteria

### Specific Tests That Must Pass

After WIECOM-007 creates integration tests:

- First wield: Actor has no component → wielding sword → Component exists with `['sword-id']`
- Second wield: Actor has `['sword-id']` → wield dagger → Component has `['sword-id', 'dagger-id']`
- Duplicate wield: Actor has `['sword-id']` → wield sword again → Component still `['sword-id']` (no duplicate due to `push_unique`)
- Description regenerated: `REGENERATE_DESCRIPTION` is called after component manipulation

### Invariants That Must Remain True

1. Rule remains valid JSON
2. Rule schema validation passes (`rule.schema.json`)
3. Existing operations (GET_NAME, SET_VARIABLE, macro) are NOT modified
4. `condition_ref` remains unchanged
5. Rule continues to work if wielding component doesn't exist (creates it)
6. Rule continues to work if wielding component already exists (appends)
7. `push_unique` mode prevents duplicate weapon IDs

### Validation Commands

```bash
# Verify JSON syntax
node -e "JSON.parse(require('fs').readFileSync('data/mods/weapons/rules/handle_wield_threateningly.rule.json'))"

# Full validation
npm run validate
```

## Reference Files

Study these for operation syntax:

- `data/mods/deference/rules/kneel_before.rule.json` - ADD_COMPONENT pattern
- `data/mods/positioning/rules/handle_sit_down.rule.json` - QUERY_COMPONENT and IF patterns
- `data/mods/clothing/rules/handle_remove_clothing.rule.json` - MODIFY_ARRAY_FIELD pattern (if exists)

## Diff Size Estimate

The diff should add approximately 35-45 lines (the three new operations with proper formatting).

## Outcome

**Status**: ✅ COMPLETED

**Implementation Date**: 2025-11-25

### Changes Made

1. **Rule File Modified**: `data/mods/weapons/rules/handle_wield_threateningly.rule.json`
   - Added QUERY_COMPONENT to check for existing wielding component
   - Added IF operation with then_actions (MODIFY_ARRAY_FIELD with push_unique) and else_actions (ADD_COMPONENT)
   - Added REGENERATE_DESCRIPTION operation
   - Rule now has 11 actions (previously 8)

2. **Test File Updated**: `tests/integration/mods/weapons/wieldThreateninglyRuleValidation.test.js`
   - Updated action count expectation from 8 to 11

3. **Integration Tests Created**: `tests/integration/mods/weapons/wieldingComponentWorkflow.integration.test.js`
   - 10 tests covering: first wield, second wield, duplicate prevention, description regeneration, rule structure validation

4. **Test Infrastructure Fix**: `tests/common/mods/ModTestHandlerFactory.js`
   - Added `weapons` to category mappings with `createHandlersWithPerceptionLogging`
   - This provides ADD_COMPONENT, MODIFY_ARRAY_FIELD, and REGENERATE_DESCRIPTION handlers

### Notes

- The Out of Scope list in the ticket incorrectly stated "DO NOT modify any manifest files" but the manifest was already modified by WIECOM-002 which added the positioning dependency
- The test infrastructure needed a fix because `weapons` mod was not mapped to a handler factory that includes ADD_COMPONENT - this was an infrastructure gap, not a rule issue

### Validation

```bash
npm run validate  # ✅ PASSED
NODE_ENV=test npx jest tests/integration/mods/weapons/ --no-coverage --silent  # 81 tests passed
```
