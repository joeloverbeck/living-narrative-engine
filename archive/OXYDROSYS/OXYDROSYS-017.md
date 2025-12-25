# OXYDROSYS-017: Create oxygen restoration rule

## Status: COMPLETED

## Description

Create the rule that restores oxygen when breathing is possible (currently: when the actor is not submerged).

## Files to Create

- `data/mods/breathing/rules/handle_oxygen_restoration.rule.json`

## Files to Modify

- `data/mods/breathing/mod-manifest.json` - Add rule to `content.rules` array

## Out of Scope

- Depletion rule
- Strangulation checks (no `positioning:being_strangled` component exists yet)
- RESTORE_OXYGEN handler/schema changes

## Assumptions & Constraints

- Respiratory organs use `breathing-states:respiratory_organ` (from `breathing-states`), not a `breathing:*` component.
- No `has_respiratory_organs` condition operator exists; RESTORE_OXYGEN is safe to call and no-ops if no organs exist.

## Acceptance Criteria

1. **Triggers on**: `core:turn_ended` event
2. **Condition**: Entity does NOT have `liquids-states:submerged` (no strangulation gate yet)
3. **Actions**:
   - Calls `RESTORE_OXYGEN` with `restoreFull: true`
   - Removes `breathing:hypoxic` component if present
   - Removes `breathing:unconscious_anoxia` component if present

## Tests That Must Pass

- `npm run validate` - Schema validation
- Integration test: Oxygen restores when not submerged and clears breathing status components

## Invariants

- Instant restoration (Design Decision 5)
- Removes breathing status effects defined in the breathing mod (`breathing:hypoxic`, `breathing:unconscious_anoxia`)

## Outcome

- Added the oxygen restoration rule gated by non-submersion (no strangulation gate available yet).
- Registered the rule in the breathing mod manifest and verified schema validation.
- Added an integration test covering restoration plus clearing hypoxic/anoxia components.
