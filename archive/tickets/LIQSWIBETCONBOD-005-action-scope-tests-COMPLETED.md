# LIQSWIBETCONBOD-005: Swim Action Discoverability + Scope Tests

**Status: COMPLETED**

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

---

## Outcome

### What was originally planned
The ticket called for adding tests covering:
1. Action discoverability based on `liquids-states:in_liquid_body` component
2. Connected-body targeting via scopes
3. Secondary location resolution using `contextFrom: "primary"`
4. Connection directionality (A -> B does not imply B -> A)

### What was actually changed
**Modified file:**
- `tests/integration/mods/liquids/swim_to_connected_liquid_body_action_discovery.test.js`

**New test added:**
- `it('respects connection directionality (one-way connections do not reverse)')` - This test verifies that unidirectional connections are properly respected (if liquid body A lists B as connected, but B does not list A, an actor in B cannot swim to A).

### Rationale
The existing test file already covered 13 out of 14 required test cases. The only missing test was the explicit directionality test which validates that connections are not implicitly bidirectional. The new test creates a unidirectional scenario (A -> B only) and verifies:
1. An actor in A can see B as a swim target
2. An actor in B cannot see A as a swim target (because B has no outbound connections to A)

### Test results
All 14 tests pass (6 test suites, 45 total tests in the liquids integration folder):
- Action structure tests (5)
- Scope resolution - connected_liquid_bodies_for_actor (3) - **includes new directionality test**
- Scope resolution - connected_liquid_body_location (1)
- Action discovery tests (5)
