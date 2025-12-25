# OPEHANNAMCOU-001: Add drinking event IDs to eventIds.js

## Summary

Add centralized constants for drinking-related event IDs to the existing `eventIds.js` file.

## Files to Touch

- `src/constants/eventIds.js`
- `tests/**` (only if required to cover new invariant/edge cases)

## Out of Scope

- DO NOT modify any handler files
- DO NOT add component IDs (separate ticket OPEHANNAMCOU-002)
- DO NOT modify any other files beyond the constants and any tests needed for coverage

## Changes

Add the following exports to `src/constants/eventIds.js`:

```javascript
// Drinking system event IDs
export const LIQUID_CONSUMED_EVENT_ID = 'drinking:liquid_consumed';
export const LIQUID_CONSUMED_ENTIRELY_EVENT_ID = 'drinking:liquid_consumed_entirely';
```

## Acceptance Criteria

### Tests That Must Pass

- `npm run typecheck` passes
- `npx eslint src/constants/eventIds.js` passes

### Invariants

- Existing exports unchanged
- New constants follow naming convention `*_EVENT_ID`
- Values match mod definitions in `data/mods/drinking/events/`:
  - `liquid_consumed.event.json` defines `drinking:liquid_consumed`
  - `liquid_consumed_entirely.event.json` defines `drinking:liquid_consumed_entirely`

## Dependencies

None - this is a foundation ticket.

## Implementation Order

Phase 1: Constants Foundation (can be done in parallel with OPEHANNAMCOU-002 and OPEHANNAMCOU-007)

## Status

Completed

## Outcome

Added drinking event ID exports to `src/constants/eventIds.js`. No tests were added because the change is a pure constant addition; existing unit tests already exercise the handlers that dispatch these events. Updated ticket scope to allow test edits if needed.
