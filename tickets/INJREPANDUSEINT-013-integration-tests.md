# INJREPANDUSEINT-013: Integration Tests

## Description

Create comprehensive integration tests for the full injury reporting and death system.

## File List

| File | Action |
|------|--------|
| `tests/integration/anatomy/injuryReportingFlow.integration.test.js` | CREATE |
| `tests/integration/anatomy/deathSystem.integration.test.js` | CREATE |

## Out of Scope

- E2E browser tests (INJREPANDUSEINT-014)
- Performance testing
- Unit tests (covered in individual tickets)

## Acceptance Criteria

### Tests That Must Pass

- `npm run test:integration` passes
- All new integration test files pass

### Invariants

- `injuryReportingFlow.integration.test.js` covers:
  - Damage application updates injury summary correctly
  - Multiple body parts can be injured simultaneously
  - Effect application (bleeding, burning, poisoned, fractured) updates summary
  - Injury aggregation calculates weighted health correctly
  - Narrative formatting produces expected first-person descriptions
  - UI panel updates reflect injury changes (via event dispatch verification)

- `deathSystem.integration.test.js` covers:
  - Damage → propagation → death flow:
    - Torso damage propagates to heart with correct probability
    - Heart destruction triggers immediate death event
    - Death event payload contains correct information
  - Vital organ destruction scenarios:
    - Brain destruction (inside head) causes immediate death
    - Heart destruction causes immediate death
    - Spine destruction causes immediate death
  - Dying countdown:
    - Low overall health (< 10%) triggers dying state
    - `anatomy:entity_dying` event dispatched with correct turns
    - `processDyingTurn()` decrements counter correctly
    - Counter reaching 0 triggers death
  - Stabilization:
    - Stabilization action removes dying state
    - `anatomy:entity_stabilized` event dispatched
  - LLM prompt integration:
    - Healthy character has null healthState
    - Injured character has populated healthState
    - XML builder produces correct physical_condition section

## Dependencies

- INJREPANDUSEINT-001 through INJREPANDUSEINT-012 (all implementation tickets)

## Reference

See `specs/injury-reporting-and-user-interface.md` section 9.2 for integration test scenarios.
