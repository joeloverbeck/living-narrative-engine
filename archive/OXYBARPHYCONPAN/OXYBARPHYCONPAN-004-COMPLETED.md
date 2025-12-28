# OXYBARPHYCONPAN-004: Extend InjuryStatusPanel to Display Oxygen Bar

## Summary

Verify the existing `InjuryStatusPanel` oxygen bar implementation against `specs/oxygen-bar-physical-condition-panel.md`, align test expectations, and document the actual integration points.

## Reassessment (Assumptions Updated)

- The oxygen bar is already implemented in `src/domUI/injuryStatusPanel.js`, including severity thresholds, aria-labels, and O<sub>2</sub> label.
- `OxygenAggregationService` is already registered in `src/dependencyInjection/registrations/uiRegistrations.js`.
- Oxygen bar tests already live in `tests/unit/domUI/injuryStatusPanel.test.js`; no new test file is required.

## Prerequisites

- **OXYBARPHYCONPAN-001** must be completed (OxygenAggregationService exists)
- **OXYBARPHYCONPAN-002** must be completed (Service is registered in DI)
- **OXYBARPHYCONPAN-003** must be completed (CSS styles exist)

## File List

### Files to Modify

- None (implementation already present; see reassessment)

### Files to Create

- None (tests already exist in `tests/unit/domUI/injuryStatusPanel.test.js`)

### Files to Read (Reference Only - DO NOT MODIFY)

- `src/anatomy/services/oxygenAggregationService.js` - Service interface reference
- `css/components/_injury-status-panel.css` - CSS class names reference
- `specs/oxygen-bar-physical-condition-panel.md` - Specification reference

## Out of Scope

- **DO NOT** modify `OxygenAggregationService` - that's already complete
- **DO NOT** modify CSS files - that's already complete
- **DO NOT** modify component schemas
- **DO NOT** modify operation handlers
- **DO NOT** add new event types
- **DO NOT** modify other UI components

## Implementation Details

### Step 1: Confirm Constructor Dependency

Already implemented in `src/domUI/injuryStatusPanel.js` with validation.

### Step 2: Confirm Private Field

Already implemented in `src/domUI/injuryStatusPanel.js`.

### Step 3: Confirm Oxygen Bar Creation Method

Already implemented in `src/domUI/injuryStatusPanel.js`, including aria-label and O<sub>2</sub> label.

### Step 4: Confirm Severity Class Method

Already implemented in `src/domUI/injuryStatusPanel.js` with thresholds matching the spec.

### Step 5: Confirm Render Methods

Already implemented; oxygen bar renders after the health bar and before narrative across all render paths.

### Step 6: Confirm UI Registrations

Already registered in `src/dependencyInjection/registrations/uiRegistrations.js`.

## Acceptance Criteria

### Tests That Must Pass

Existing oxygen bar coverage in `tests/unit/domUI/injuryStatusPanel.test.js`:

**T-2.1 DOM structure tests:**
1. `should create oxygen bar wrapper with correct classes`
2. `should create oxygen bar fill with correct width percentage`
3. `should display correct percentage text`
4. `should include aria-label for accessibility`
5. `should include O₂ label element`

**T-2.2 Severity class tests:**
1. `should apply oxygen-full class at 100%`
2. `should apply oxygen-full class at 90%`
3. `should apply oxygen-full class at 80%`
4. `should apply oxygen-low class at 79%`
5. `should apply oxygen-low class at 50%`
6. `should apply oxygen-low class at 40%`
7. `should apply oxygen-critical class at 39%`
8. `should apply oxygen-critical class at 20%`
9. `should apply oxygen-critical class at 1%`
10. `should apply oxygen-depleted class at 0%`

**T-2.3 Conditional display tests:**
1. `should hide oxygen bar when actor has no respiratory organs`
2. `should show oxygen bar when actor has respiratory organs`
3. `should not render oxygen bar when oxygenAggregationService returns null`

**Existing tests must continue to pass:**
- All existing tests in `tests/unit/domUI/injuryStatusPanel.test.js`

### Invariants That Must Remain True

1. Health bar rendering remains unchanged
2. Oxygen bar appears below health bar, above narrative
3. Oxygen bar is only shown when actor has respiratory organs
4. Accessibility attributes are present (`aria-label`)
5. No breaking changes to existing API
6. Dying and dead states still render correctly
7. Turn-started event still triggers updates
8. All render methods consistently handle oxygen bar

## Estimated Diff Size

- Ticket-only documentation updates

## Status

Completed

## Outcome

Oxygen bar functionality and tests were already present in `src/domUI/injuryStatusPanel.js`, `src/dependencyInjection/registrations/uiRegistrations.js`, and `tests/unit/domUI/injuryStatusPanel.test.js`, so the plan shifted from adding new code/tests to validating existing behavior and updating documentation to reflect actual scope.
