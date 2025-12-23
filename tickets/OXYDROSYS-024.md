# OXYDROSYS-024: Create strangle action and rule

## Description

Create the strangle action and its handling rule.

## Files to Create

- `data/mods/strangling-states/actions/strangle.action.json`
- `data/mods/strangling-states/rules/handle_strangle.rule.json`
- `data/mods/strangling-states/conditions/event-is-action-strangle.condition.json`

## Files to Modify

- `data/mods/strangling-states/mod-manifest.json` - Add action, rule, condition

## Out of Scope

- Release strangle action
- Break free action

## Acceptance Criteria

1. **Action valid**: Requires target, appropriate prerequisites (closeness)
2. **Rule valid**: Adds being_strangled to target, may add "strangling" to actor
3. **Condition**: Checks event is strangle action

## Tests That Must Pass

- `npm run validate` - Schema validation
- Integration test: Strangle action adds component to target

## Invariants

- Follows existing action patterns
- Requires close proximity to target
