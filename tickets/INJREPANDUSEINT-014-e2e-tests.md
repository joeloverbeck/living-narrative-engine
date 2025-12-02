# INJREPANDUSEINT-014: E2E Tests

## Description

Create E2E tests for UI behavior in browser environment.

## File List

| File | Action |
|------|--------|
| `tests/e2e/injuryDisplay.e2e.test.js` | CREATE |

## Out of Scope

- Integration tests (INJREPANDUSEINT-013)
- Performance benchmarks
- Accessibility audit (separate ticket if needed)

## Acceptance Criteria

### Tests That Must Pass

- `npm run test:e2e` passes

### Invariants

- Tests cover scenarios from spec section 9.3:

  **Injury Panel Behavior**:
  - Panel appears in left pane when game loads
  - Panel shows "Healthy" state for undamaged character
  - Panel updates when damage is applied
  - Health bar changes color based on overall health
  - Individual body part injuries are listed
  - Effect badges (bleeding, burning, etc.) appear correctly
  - Dying countdown appears with urgent styling

  **Damage Messages**:
  - Damage messages appear in chat/message area
  - Messages show attacker, target, and body part
  - Messages styled based on severity
  - Multiple rapid damage events are batched correctly
  - Death message appears distinctly styled

  **Death Sequence**:
  - Dying state shows countdown in panel
  - Countdown decrements each turn
  - Death event triggers final death message
  - Panel updates to show dead state
  - Appropriate visual feedback for death

  **Accessibility**:
  - ARIA attributes present on panel
  - Screen reader can announce injury updates
  - Color contrast meets WCAG AA standards
  - Focus management works correctly

## Dependencies

- INJREPANDUSEINT-013 (Integration Tests)

## Reference

See `specs/injury-reporting-and-user-interface.md` section 9.3 for E2E test scenarios.
