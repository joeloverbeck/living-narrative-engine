# OXYDROSYS-016: Create oxygen depletion rule

## Status: COMPLETED

## Description

Create the rule that triggers oxygen depletion when an actor is submerged or strangled.

## Notes/Assumptions

- Respiratory organs use `breathing-states:respiratory_organ` (from the breathing-states mod).
- `DEPLETE_OXYGEN` already dispatches `breathing-states:oxygen_depleted`; this rule just invokes the operation.
- No strangling component exists yet (the brainstorm references `positioning:being_strangled`, but that mod/component is not present). This ticket will only wire submerged depletion until a strangling state is defined.

## Files to Create

- `data/mods/breathing/rules/handle_oxygen_depletion.rule.json`

## Files to Modify

- `data/mods/breathing/mod-manifest.json` - Add rule to `content.rules` array

## Out of Scope

- Oxygen restoration rule
- Hypoxia progression
- Brain damage
- Strangulation trigger (blocked on missing strangling component)

## Acceptance Criteria

1. **Triggers on**: `core:turn_ended` event
2. **Condition**: Entity has `liquids-states:submerged`
3. **Action**: Calls `DEPLETE_OXYGEN` operation
4. **Rule ID**: `breathing:handle_oxygen_depletion`

## Tests That Must Pass

- `npm run validate` - Schema validation
- Integration test: Oxygen depletes each turn while submerged

## Invariants

- Does not modify any existing rules
- Depends on components from other mods (liquids-states)

## Outcome

- Implemented the submerged-only oxygen depletion rule and registered it in the breathing mod manifest.
- Added the breathing mod dependency on liquids-states to reflect the rule's component usage.
- Added an integration test covering turn-end depletion while submerged; strangling remains deferred until a component exists.
