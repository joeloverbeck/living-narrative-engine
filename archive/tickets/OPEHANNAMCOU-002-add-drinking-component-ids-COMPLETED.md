# OPEHANNAMCOU-002: Add drinking component IDs to componentIds.js

## Summary

Add centralized constants for drinking-related component IDs to the existing `componentIds.js` file.

## Files to Touch

- `src/constants/componentIds.js`

## Out of Scope

- DO NOT modify any handler files (handlers still hardcode these IDs; tracked elsewhere)
- DO NOT modify any test files (no changes required for this constants-only ticket)
- DO NOT add event IDs (separate ticket OPEHANNAMCOU-001)
- DO NOT add container component IDs (separate ticket OPEHANNAMCOU-007)

## Changes

Add the following exports to `src/constants/componentIds.js`:

```javascript
// Drinking system components
export const DRINKABLE_COMPONENT_ID = 'drinking:drinkable';
export const EMPTY_COMPONENT_ID = 'drinking:empty';
```

## Acceptance Criteria

### Tests That Must Pass

- `npm run typecheck` passes
- `npx eslint src/constants/componentIds.js` passes

### Invariants

- Existing exports unchanged
- New constants follow naming convention `*_COMPONENT_ID`
- Values match mod definitions in `data/mods/drinking/components/`:
  - `drinkable.component.json` defines `drinking:drinkable`
  - `empty.component.json` defines `drinking:empty`

## Dependencies

None - this is a foundation ticket.

## Notes on Current State

- Drinking handlers still declare `drinking:*` IDs inline; this ticket only centralizes constants.

## Implementation Order

Phase 1: Constants Foundation (can be done in parallel with OPEHANNAMCOU-001 and OPEHANNAMCOU-007)

## Status

Completed

## Outcome

Added `DRINKABLE_COMPONENT_ID` and `EMPTY_COMPONENT_ID` to `src/constants/componentIds.js`. Scope stayed limited to constants; handlers and tests were untouched as originally planned.
