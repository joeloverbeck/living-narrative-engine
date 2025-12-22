# LIQSWIBETCONBOD-005: Swim Action Discoverability + Scope Tests

## Goal
Add tests covering action discoverability, connected-body targeting, and secondary location resolution for the swim action.

## File list (expected to touch)
- tests/ (new or updated suites for action discoverability and scope resolution)
- tests/__snapshots__/ (only if snapshot-based expectations are required)

## Out of scope
- Rule outcome tests (handled in a separate ticket).
- Any changes to mod data or rule definitions.
- Engine code changes under src/.

## Acceptance criteria
### Specific tests that must pass
- `npm run test:unit -- --runInBand`
- Any new test files introduced in this ticket

### Invariants that must remain true
- Action appears only when the actor has `liquids-states:in_liquid_body`.
- Targets include only connected liquid bodies and respect directionality.
- Action is hidden when no connections exist.
- Secondary target resolves the connected location based on the selected connected liquid body.
- Custom scope resolvers (if required) are registered via the mod testing guide patterns.
