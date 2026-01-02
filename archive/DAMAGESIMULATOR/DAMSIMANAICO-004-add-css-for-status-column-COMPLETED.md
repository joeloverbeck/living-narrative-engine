# DAMSIMANAICO-004: Add CSS Styling for Status Column

## Summary

Add CSS styling for the Status column in the HITS TO DESTROY table rendered by `DamageAnalyticsPanel`. The status cell already renders with `ds-status-cell` and uses the shared `ds-part-effects`/`ds-effect` classes from `statusEffectUtils`; this ticket scopes the table-specific CSS overrides to keep icons centered and compact.

## Prerequisites

- DAMSIMANAICO-003 is already implemented in this repo (Status column exists in `src/domUI/damage-simulator/DamageAnalyticsPanel.js`). If that column is missing, stop and reconcile first.

## Files to Touch

- `css/damage-simulator.css` (MODIFY)

## Out of Scope

- DO NOT modify any JavaScript files unless the HTML markup does not match the CSS selectors described below
- DO NOT change existing CSS class definitions for `.ds-effect`, `.ds-effect-bleeding`, etc.
- DO NOT change `.ds-hits-table` base styling

## Implementation Details

### Add to css/damage-simulator.css

Add after the existing `.ds-hits-table` styles (around the hits table block in `css/damage-simulator.css`):

```css
/* Status Column in Hits Table */
.ds-status-cell {
  text-align: center;
  min-width: 60px;
}

.ds-status-cell .ds-part-effects {
  display: inline-flex;
  justify-content: center;
  gap: 2px;
}

.ds-status-cell .ds-effect {
  font-size: 12px;
}
```

## CSS Class Details

### .ds-status-cell

- Applied to the `<td>` element containing status effects
- Centers content horizontally
- Sets minimum width to prevent column collapse

### .ds-status-cell .ds-part-effects

- Scoped override for the effects container within table cells
- Uses inline-flex instead of flex for inline table context
- Centers icons within the cell
- Reduces gap from default (4px in cards) to 2px for table density

### .ds-status-cell .ds-effect

- Scoped override for effect icons within table cells
- Reduces font size from default (14px in cards) to 12px for table density

## Acceptance Criteria

### Visual Requirements

1. Status column icons must be horizontally centered in their cell
2. Multiple icons must be grouped together with small gap
3. Icons must be visually smaller than in the Anatomy panel cards
4. Column must maintain minimum width even when empty
5. Existing effect animations (burning pulse) must still work

### Tests That Must Pass

- `npm run test:single -- tests/unit/domUI/damage-simulator/DamageAnalyticsPanel.test.js`

### Invariants

- Existing `.ds-part-effects` styling for Anatomy cards must NOT change
- Existing `.ds-effect` base styling must NOT change
- Existing `.ds-effect-*` effect-specific styling must NOT change
- The `.ds-effect-burning` pulse animation must still work

## Verification Steps

1. Load damage-simulator.html
2. Load an entity
3. Verify Status column header is visible
4. Verify "—" is centered when no effects present
5. Apply damage until effects trigger
6. Verify effect icons are:
   - Centered in the cell
   - Smaller than in Anatomy section
   - Grouped tightly together
   - Hoverable with tooltip visible
7. Verify burning animation still pulses
8. Verify Anatomy section effect icons are unchanged
9. Run the unit test for the damage analytics panel

## Definition of Done

1. CSS rules added to damage-simulator.css
2. Status column icons are centered
3. Icons are appropriately sized for table context
4. No changes to existing effect styling
5. Manual visual verification completed or explicitly deferred in Outcome
6. Relevant unit tests pass

## Status

Completed

## Outcome

- Planned: add scoped CSS for the status column in the hits table.
- Actual: added scoped CSS rules in `css/damage-simulator.css` and ran the focused unit test; manual browser verification was not performed.
