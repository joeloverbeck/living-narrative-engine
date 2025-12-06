# THRITEATTAR-008: Create Throw Item at Target Rule Definition

## Summary

Create the rule that handles the `throw_item_at_target` action. The rule processes the action attempt, resolves the outcome using skills, and delegates to appropriate macros based on the outcome (CRITICAL_SUCCESS, SUCCESS, FAILURE, FUMBLE).

## Files to Create

| File                                                           | Purpose           |
| -------------------------------------------------------------- | ----------------- |
| `data/mods/ranged/rules/handle_throw_item_at_target.rule.json` | Main rule handler |

## Implementation Details

### handle_throw_item_at_target.rule.json

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_throw_item_at_target",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "ranged:event-is-action-throw-item-at-target"
  },
  "actions": [
    {
      "type": "GET_NAME",
      "parameters": { "entity_ref": "actor", "result_variable": "actorName" }
    },
    {
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "secondary",
        "result_variable": "targetName"
      }
    },
    {
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "primary",
        "result_variable": "throwableName"
      }
    },
    {
      "type": "QUERY_COMPONENT",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "core:position",
        "result_variable": "actorPosition"
      }
    },
    {
      "type": "GET_DAMAGE_CAPABILITIES",
      "comment": "Gets damage capabilities if present, otherwise calculates blunt damage from weight",
      "parameters": {
        "entity_ref": "primary",
        "output_variable": "throwableDamage"
      }
    },
    {
      "type": "RESOLVE_OUTCOME",
      "parameters": {
        "actor_skill_component": "skills:ranged_skill",
        "target_skill_component": "skills:defense_skill",
        "actor_skill_default": 10,
        "target_skill_default": 0,
        "formula": "ratio",
        "result_variable": "attackResult"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "locationId",
        "value": "{context.actorPosition.locationId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "perceptionType",
        "value": "action_target_general"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "targetId",
        "value": "{event.payload.secondaryId}"
      }
    },
    {
      "type": "IF",
      "comment": "Handle CRITICAL_SUCCESS outcome",
      "parameters": {
        "condition": {
          "==": [{ "var": "context.attackResult.outcome" }, "CRITICAL_SUCCESS"]
        },
        "then_actions": [{ "macro": "ranged:handleThrowCritical" }]
      }
    },
    {
      "type": "IF",
      "comment": "Handle SUCCESS outcome",
      "parameters": {
        "condition": {
          "==": [{ "var": "context.attackResult.outcome" }, "SUCCESS"]
        },
        "then_actions": [{ "macro": "ranged:handleThrowHit" }]
      }
    },
    {
      "type": "IF",
      "comment": "Handle FUMBLE outcome",
      "parameters": {
        "condition": {
          "==": [{ "var": "context.attackResult.outcome" }, "FUMBLE"]
        },
        "then_actions": [{ "macro": "ranged:handleThrowFumble" }]
      }
    },
    {
      "type": "IF",
      "comment": "Handle FAILURE outcome",
      "parameters": {
        "condition": {
          "==": [{ "var": "context.attackResult.outcome" }, "FAILURE"]
        },
        "then_actions": [{ "macro": "ranged:handleThrowMiss" }]
      }
    }
  ]
}
```

### Rule Flow

1. **Name Resolution**: Get names of actor, target, and throwable item
2. **Position Query**: Get actor's position to know the location
3. **Damage Calculation**: Use `GET_DAMAGE_CAPABILITIES` to get damage data
4. **Outcome Resolution**: Use `RESOLVE_OUTCOME` to determine success/failure
5. **Context Variables**: Set up variables needed by macros
6. **Outcome Branching**: Call appropriate macro based on outcome

### Key Operations Used

| Operation                 | Purpose                                |
| ------------------------- | -------------------------------------- |
| `GET_NAME`                | Get display names for narrative text   |
| `QUERY_COMPONENT`         | Get actor's position component         |
| `GET_DAMAGE_CAPABILITIES` | Calculate damage from weapon or weight |
| `RESOLVE_OUTCOME`         | Determine outcome using skill contest  |
| `SET_VARIABLE`            | Set up context variables for macros    |
| `IF`                      | Branch to appropriate outcome macro    |

## Out of Scope

- **DO NOT** modify any existing rules
- **DO NOT** create the macros (THRITEATTAR-009)
- **DO NOT** create the condition (THRITEATTAR-004)
- **DO NOT** modify operation handlers
- **DO NOT** create test files (THRITEATTAR-012)

## Acceptance Criteria

### Tests That Must Pass

1. `npm run validate` completes without errors
2. Rule JSON passes schema validation against `rule.schema.json`
3. Rule is valid JSON (parseable without errors)
4. All referenced operations exist in pre-validation whitelist

### Invariants That Must Remain True

1. All existing rules continue to function correctly
2. Rule ID `handle_throw_item_at_target` is unique across all mods
3. Referenced condition exists: `ranged:event-is-action-throw-item-at-target`
4. Referenced macros will exist: `ranged:handleThrowCritical`, `ranged:handleThrowHit`, `ranged:handleThrowMiss`, `ranged:handleThrowFumble`
5. All operation types used are registered

## Validation Commands

```bash
# Verify JSON is valid
node -e "JSON.parse(require('fs').readFileSync('data/mods/ranged/rules/handle_throw_item_at_target.rule.json'))"

# Run project validation
npm run validate
```

## Reference Files

For understanding rule patterns:

- `data/mods/weapons/rules/handle_swing_at_target.rule.json` - Similar combat rule

## Dependencies

- THRITEATTAR-001 (mod structure must exist)
- THRITEATTAR-004 (condition must exist)
- THRITEATTAR-007 (all operations must be registered)

## Blocks

- THRITEATTAR-012 (integration tests verify rule execution)

## Note on Macro References

The rule references four macros that will be created in THRITEATTAR-009. The rule can be created first, but the game will not fully function until the macros exist.

## Outcome

- Created `data/mods/ranged/rules/handle_throw_item_at_target.rule.json` exactly as specified.
- Added `ranged` to `data/game.json` to ensure the mod is recognized by the engine and validation tools.
- Verified JSON validity and schema compliance using `npm run validate:strict`.
- Verified that reference macros and operations are allowed (though macros do not exist yet, validation passes as they are string references).
