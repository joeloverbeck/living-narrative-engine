# LIQMOD-002: Liquids Scope and Enter Action

**Status**: Completed
**Priority**: High

## Summary

Add the liquid-body scope plus the `liquids:enter_liquid_body` action and its event-is-action condition. Wire them into the liquids mod manifest and cover discovery via integration tests.

## Assumptions (Updated)

- `data/mods/liquids/` already exists with `liquids:liquid_body` and `liquids-states:in_liquid_body` components plus a base `mod-manifest.json`.
- No liquids rules or dredgers liquid entities are being added in this ticket (tracked elsewhere per spec).

## File List

- `data/mods/liquids/mod-manifest.json`
- `data/mods/liquids/scopes/liquid_bodies_at_location.scope`
- `data/mods/liquids/actions/enter_liquid_body.action.json`
- `data/mods/liquids/conditions/event-is-action-enter-liquid-body.condition.json`
- `tests/integration/mods/liquids/enter_liquid_body_action_discovery.test.js`

## Out of Scope

- No rule implementation.
- No dredgers entities or instances.
- No changes to existing actions or shared forbidden-component lists.
- No color-scheme documentation updates in this ticket.

## Acceptance Criteria

### Specific Tests That Must Pass

- `npm run test:integration -- tests/integration/mods/liquids/enter_liquid_body_action_discovery.test.js --runInBand`

### Invariants That Must Remain True

- Scope DSL matches the `items_at_location` pattern and uses actor/location matching only.
- Forbidden component list mirrors `sit_down` plus `liquids-states:in_liquid_body`.
- No changes to existing mods outside `data/mods/liquids/`.

## Outcome

- Implemented the liquids scope/action/condition plus manifest wiring and discovery coverage.
- Added integration tests for action discoverability and scope resolution; no rule or entity work completed in this ticket.
