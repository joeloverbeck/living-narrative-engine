# LIQMOD-006: Liquids Integration Tests

**Status**: Completed
**Priority**: High

## Summary

Validate existing integration tests for enter-liquid-body discoverability and rule behavior using existing mod test fixtures.

## File List

- `tests/integration/mods/liquids/enter_liquid_body_action_discovery.test.js`
- `tests/integration/mods/liquids/enter_liquid_body_action.test.js`

## Out of Scope

- No changes to liquids mod data files.
- No changes to dredgers entities or locations.
- No updates to docs or color schemes.
- No refactors outside `tests/integration/mods/liquids/`, except ticket/spec archival after completion.

## Acceptance Criteria

### Specific Tests That Must Pass

- `npm run test:integration -- tests/integration/mods/liquids/enter_liquid_body_action_discovery.test.js --runInBand`
- `npm run test:integration -- tests/integration/mods/liquids/enter_liquid_body_action.test.js --runInBand`

### Invariants That Must Remain True

- Tests use `ModTestFixture`/`ModActionTestFixture` and `ModEntityBuilder` patterns.
- No reliance on full-suite coverage thresholds for these focused runs.
- No changes outside `tests/integration/mods/liquids/`, except ticket/spec archival after completion.

## Outcome

- Planned: add integration tests for liquids action discovery and execution.
- Actual: tests already existed and passed; no code changes were required beyond ticket/spec archival.
