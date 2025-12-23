# OXYDROSYS-016: Create oxygen depletion rule

## Description

Create the rule that triggers oxygen depletion when an actor is submerged or strangled.

## Files to Create

- `data/mods/breathing/rules/handle_oxygen_depletion.rule.json`

## Files to Modify

- `data/mods/breathing/mod-manifest.json` - Add rule to `content.rules` array

## Out of Scope

- Oxygen restoration rule
- Hypoxia progression
- Brain damage

## Acceptance Criteria

1. **Triggers on**: `core:turn_ended` event
2. **Condition**: Entity has `liquids-states:submerged` OR `strangling-states:being_strangled`
3. **Action**: Calls `DEPLETE_OXYGEN` operation
4. **Rule ID**: `breathing:handle_oxygen_depletion`

## Tests That Must Pass

- `npm run validate` - Schema validation
- Integration test: Oxygen depletes each turn while submerged

## Invariants

- Does not modify any existing rules
- Depends on components from other mods (liquids-states, strangling-states)
