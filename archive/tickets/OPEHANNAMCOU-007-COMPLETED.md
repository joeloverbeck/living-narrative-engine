# OPEHANNAMCOU-007: Add container component IDs to componentIds.js

## Summary

Add missing centralized constants for container-related and inventory-related component IDs to the existing `componentIds.js` file. `LIQUID_CONTAINER_COMPONENT_ID` is already defined, so this ticket covers the remaining cross-mod components used alongside the drinking handlers.

## Files to Touch

- `src/constants/componentIds.js`

## Out of Scope

- DO NOT modify any handler files
- DO NOT modify any test files
- DO NOT add drinking-specific components (already done in OPEHANNAMCOU-002)
- DO NOT add event IDs (separate ticket OPEHANNAMCOU-001)

## Changes

Add the following exports to `src/constants/componentIds.js` (excluding the already-present `LIQUID_CONTAINER_COMPONENT_ID`):

```javascript
// Container system components
export const CONTAINER_COMPONENT_ID = 'containers-core:container';
export const OPENABLE_COMPONENT_ID = 'items-core:openable';

// Inventory components
export const INVENTORY_COMPONENT_ID = 'inventory:inventory';
export const WEIGHT_COMPONENT_ID = 'core:weight';
```

## Acceptance Criteria

### Tests That Must Pass

- `npm run typecheck` passes
- `npx eslint src/constants/componentIds.js` passes

### Invariants

- Existing exports unchanged (including `LIQUID_CONTAINER_COMPONENT_ID`)
- New constants follow naming convention `*_COMPONENT_ID`
- Values match mod definitions:
  - `containers-core:liquid_container` from containers-core mod
  - `containers-core:container` from containers-core mod
  - `items-core:openable` from items-core mod
  - `inventory:inventory` from inventory mod
  - `core:weight` from core mod

## Dependencies

None - this is a foundation ticket.

## Implementation Order

Phase 1: Constants Foundation (can be done in parallel with OPEHANNAMCOU-001 and OPEHANNAMCOU-002)

## Notes

These components are used across multiple handlers and mods. Centralizing them prevents the namespace mismatch problem that occurred with `items:drinkable` vs `drinking:drinkable`.

## Status

Completed.

## Outcome

Added missing container/inventory component ID constants to `src/constants/componentIds.js`; confirmed `LIQUID_CONTAINER_COMPONENT_ID` already existed so it was not duplicated. No handler or test changes were required.
