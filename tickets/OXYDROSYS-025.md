# OXYDROSYS-025: Create release and break free actions

## Description

Create actions for releasing strangle hold and breaking free from strangulation.

## Files to Create

- `data/mods/strangling-states/actions/release_strangle.action.json`
- `data/mods/strangling-states/actions/break_free_from_strangle.action.json`
- `data/mods/strangling-states/rules/handle_release_strangle.rule.json`
- `data/mods/strangling-states/rules/handle_break_free_from_strangle.rule.json`
- `data/mods/strangling-states/conditions/event-is-action-release-strangle.condition.json`
- `data/mods/strangling-states/conditions/event-is-action-break-free-from-strangle.condition.json`

## Files to Modify

- `data/mods/strangling-states/mod-manifest.json` - Add all new content

## Out of Scope

- Skill checks for breaking free
- Strength-based mechanics

## Acceptance Criteria

1. **Release action**: Removes being_strangled from target, removes strangling from actor
2. **Break free action**: Self-targeted, removes being_strangled from self
3. **Prerequisites**: Release requires actor is strangling, break free requires being strangled

## Tests That Must Pass

- `npm run validate` - Schema validation
- Integration tests for both actions

## Invariants

- Both actions remove being_strangled component
- Oxygen restoration triggers automatically on next turn (via existing rules)
