# LIQMOD-004: Dredgers Liquid Body Entities

**Status**: Completed
**Priority**: Medium

## Summary

Add four liquid body entity definitions and instances for the canal segments and flooded approach in the dredgers mod.

## Current State / Assumptions

- The `liquids` mod (components, scope, action, rule) already exists.
- Integration tests for `liquids:enter_liquid_body` already exist under `tests/integration/mods/liquids/`.
- Dredgers does not yet define liquid body entities for the canal segments or flooded approach.

## File List

- `data/mods/dredgers/entities/definitions/*.json` (new liquid body definitions)
- `data/mods/dredgers/entities/instances/*.json` (new instances with `core:position.locationId`)
- `data/mods/dredgers/mod-manifest.json` (register new definitions and instances)

## Out of Scope

- No changes to existing location definition files.
- No edits to liquids mod files.
- No new actions, scopes, conditions, or rules.
- No new or modified tests in this ticket (existing liquids integration tests already cover behavior).

## Acceptance Criteria

### Specific Tests That Must Pass

- `npm run test:integration -- tests/integration/mods/liquids/enter_liquid_body_action_discovery.test.js --runInBand`
- `npm run test:integration -- tests/integration/mods/liquids/enter_liquid_body_action.test.js --runInBand`

### Invariants That Must Remain True

- Existing dredgers entities and locations remain unchanged.
- New entities only add `core:name`, `core:description` (optional), and `liquids:liquid_body` plus position on instances.
- No changes outside `data/mods/dredgers/`.

## Outcome

Added four dredgers liquid body definitions and instances with location placement, and registered them in the dredgers manifest. No test files were added or modified.
