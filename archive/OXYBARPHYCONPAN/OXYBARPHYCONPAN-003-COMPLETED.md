# OXYBARPHYCONPAN-003: Wire Oxygen Bar UI + Styles in Injury Status Panel

## Summary

Render the oxygen bar inside the existing InjuryStatusPanel using the already-implemented OxygenAggregationService, and add the missing CSS styles. The bar should follow the health bar pattern, use the oxygen severity classes from the spec, and stay hidden when no respiratory organs are present.

## Status

Completed

## Assumptions Reassessment (Updated)

- Oxygen aggregation **already exists** at `src/anatomy/services/oxygenAggregationService.js` with unit tests in `tests/unit/anatomy/services/oxygenAggregationService.test.js`.
- InjuryStatusPanel **does not currently render** an oxygen bar; no `oxygen-*` DOM elements exist.
- The injury status stylesheet **does not include** oxygen bar styles.
- There are **no existing UI tests** covering oxygen bar rendering in `tests/unit/domUI/injuryStatusPanel.test.js`.

## File List

### Files to Modify

- `src/domUI/injuryStatusPanel.js` - Render oxygen bar with severity classes and accessibility label
- `src/dependencyInjection/registrations/uiRegistrations.js` - Inject OxygenAggregationService into InjuryStatusPanel
- `css/components/_injury-status-panel.css` - Add oxygen bar styles
- `tests/unit/domUI/injuryStatusPanel.test.js` - Add/adjust unit tests for oxygen bar rendering

### Files to Read (Reference Only - DO NOT MODIFY)

- `specs/oxygen-bar-physical-condition-panel.md`

## Out of Scope

- **DO NOT** modify `src/anatomy/services/oxygenAggregationService.js`
- **DO NOT** add new HTML files or edit `game.html` (bar is created in JS)
- **DO NOT** add new CSS files
- **DO NOT** change existing health bar styles or severity classes
- **DO NOT** add new events or subscription logic for oxygen handlers (TURN_STARTED only)

## Implementation Details

### UI Rendering

- Add OxygenAggregationService as a required dependency of InjuryStatusPanel.
- In `updateForActor`, aggregate oxygen alongside injuries; if oxygen aggregation fails, log the error and continue rendering injuries without an oxygen bar.
- Render the oxygen bar **below the health bar** in all states (healthy/injured/dying/dead) **when** a summary is returned by OxygenAggregationService.
- If no respiratory organs are found (service returns `null`), **do not render** the oxygen bar.
- Include an `aria-label` on the oxygen bar wrapper: `Oxygen level: X%`.
- Add an `O2` label with subscript (use markup, not Unicode literals).

### Oxygen Severity Class Mapping

- `oxygen-full`: 80-100%
- `oxygen-low`: 40-79%
- `oxygen-critical`: 1-39%
- `oxygen-depleted`: 0%

### CSS Additions

Add the oxygen bar styles after the existing health bar styles in `css/components/_injury-status-panel.css` (see spec section "CSS Additions" for base rules and animation requirements). Ensure styles:
- Reuse spacing/border-radius variables where applicable
- Mirror health bar dimensions
- Use opacity-only animation for the depleted state

## Acceptance Criteria

1. Oxygen bar renders below the health bar when oxygen aggregation returns a summary.
2. Oxygen bar is hidden when oxygen aggregation returns `null` (no respiratory organs).
3. Severity classes map to the required thresholds and colors.
4. Oxygen bar wrapper includes `aria-label="Oxygen level: X%"`.
5. Existing health bar behavior and styles remain unchanged.
6. Unit tests pass for InjuryStatusPanel updates.

## Tests That Must Pass

- `npm run test:unit -- --runInBand tests/unit/domUI/injuryStatusPanel.test.js`

## Estimated Diff Size

- `src/domUI/injuryStatusPanel.js`: +80-120 lines
- `css/components/_injury-status-panel.css`: +80-90 lines
- `src/dependencyInjection/registrations/uiRegistrations.js`: +1 line
- `tests/unit/domUI/injuryStatusPanel.test.js`: +60-100 lines

## Outcome

- Added oxygen bar rendering in InjuryStatusPanel using OxygenAggregationService; kept TURN_STARTED-only updates.
- Added oxygen bar styles to `_injury-status-panel.css` matching the spec thresholds.
- Extended InjuryStatusPanel unit tests to cover oxygen rendering, thresholds, and accessibility label.
- No HTML edits; OxygenAggregationService and its tests were left unchanged.
