# LIQSWIBETCONBOD-001: Liquid Body Connections Data Model

**Status**: Completed

## Summary
Add connected liquid body metadata to the liquids component schema and populate dredgers liquid body definitions with the connection graph from `specs/liquid_swim_between_connected_bodies_spec.md`.

## Current State / Assumptions
- `liquids:liquid_body` is currently a marker component with no data fields.
- Dredgers liquid body definitions exist and are referenced by instances; only definitions should be updated.
- No actions, rules, scopes, skills, or engine code are introduced in this ticket.

## File List
- `data/mods/liquids/components/liquid_body.component.json`
- `data/mods/dredgers/entities/definitions/canal_run_segment_a_liquid_body.entity.json`
- `data/mods/dredgers/entities/definitions/canal_run_segment_b_liquid_body.entity.json`
- `data/mods/dredgers/entities/definitions/canal_run_segment_c_liquid_body.entity.json`
- `data/mods/dredgers/entities/definitions/flooded_approach_liquid_body.entity.json`

## Out of Scope
- Any new actions, rules, scopes, conditions, or skills.
- Any code changes under `src/`.
- New or modified tests beyond running validation.

## Acceptance Criteria
### Specific Tests That Must Pass
- `npm run validate`

### Invariants That Must Remain True
- Existing liquid body entities remain valid and loadable by the mod system.
- No changes to entity instance overrides (only definitions updated).
- No new required fields on `liquids:liquid_body` (connections are optional with a default of `[]`).

## Outcome
Added optional connection metadata to `liquids:liquid_body` and connected the four dredgers liquid bodies per the spec. Actual work matched the plan: only schema + definition updates, with no additional actions, rules, scopes, skills, manifests, or tests.
