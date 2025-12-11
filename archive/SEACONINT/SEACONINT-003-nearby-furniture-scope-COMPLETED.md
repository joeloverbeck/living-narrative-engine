# SEACONINT-003: Create open_containers_on_nearby_furniture Scope

**Status**: Completed
**Priority**: HIGH
**Estimated Effort**: 30-45 minutes
**Dependencies**: SEACONINT-002
**Blocks**: SEACONINT-004, SEACONINT-005

## Objective

Create a new scope `furniture:open_containers_on_nearby_furniture` that finds all open containers on furniture that is "near" the furniture the actor is sitting on.

## Files To Create

| File | Purpose |
|------|---------|
| `data/mods/furniture/scopes/open_containers_on_nearby_furniture.scope` | Scope definition |

## Files To Modify

None.

## Out of Scope

- **DO NOT** modify any existing scopes
- **DO NOT** modify the scope DSL engine
- **DO NOT** modify the furniture mod manifest (handled in SEACONINT-007)
- **DO NOT** create any action files (handled in SEACONINT-004, SEACONINT-005)
- **DO NOT** create any tests (covered in SEACONINT-009)

## Implementation Details

Create the scope file at `data/mods/furniture/scopes/open_containers_on_nearby_furniture.scope`:

```
furniture:open_containers_on_nearby_furniture := entities(containers-core:container)[][{"and": [
  {"==": [{"var": "entity.components.containers-core:container.isOpen"}, true]},
  {"==": [
    {"var": "entity.components.core:position.locationId"},
    {"var": "actor.components.core:position.locationId"}
  ]},
  {"isOnNearbyFurniture": [{"var": "entity.id"}]}
]}]
```

## Scope Logic Breakdown

1. **`entities(containers-core:container)`**: Start with all entities that have the `containers-core:container` component
2. **`[][]`**: Iterate and filter with JSON Logic
3. **Filter conditions (AND)**:
   - Container must be open (`isOpen: true`)
   - Container must be in the same location as the actor
   - Container entity ID must pass the `isOnNearbyFurniture` operator check

## Design Notes

- The scope intentionally filters for open containers only - closed containers require the `open_container` action first
- The location check ensures actors can't interact with furniture in different rooms
- The `isOnNearbyFurniture` operator (from SEACONINT-002) does the heavy lifting of checking the furniture proximity chain

## Acceptance Criteria

### Tests That Must Pass

1. `npm run scope:lint` passes (scope DSL syntax is valid)
2. `npm run validate` passes
3. Scope resolves to empty set when:
   - Actor is not sitting
   - Actor is sitting but furniture has no `near_furniture` component
   - Actor is sitting but `nearFurnitureIds` is empty
   - Nearby furniture has no `containers-core:container` component
   - Nearby furniture has container but `isOpen: false`
   - Nearby furniture is in a different location
4. Scope resolves to container(s) when:
   - Actor is sitting on furniture with `near_furniture` component
   - `nearFurnitureIds` contains a furniture ID
   - That furniture has `containers-core:container` with `isOpen: true`
   - That furniture is in the same location as the actor

### Invariants That Must Remain True

1. Existing scopes continue to work unchanged
2. The scope follows the standard scope file format
3. No breaking changes to the scope DSL engine

## Verification Commands

```bash
# Validate scope syntax
npm run scope:lint

# General validation
npm run validate

# Ensure no regressions
npm run test:ci
```

## Related Scopes (For Reference)

- `data/mods/items/scopes/open_containers_at_location.scope` - Similar pattern for non-seated container access
- `data/mods/items/scopes/container_contents.scope` - Used as secondary target scope

---

## Outcome

### What Was Changed

1. **Created** `data/mods/furniture/scopes/open_containers_on_nearby_furniture.scope`
   - Implemented exactly as specified in the ticket
   - Created the `scopes/` directory under furniture mod (did not exist previously)

### Validation Results

- `npm run scope:lint`: 136 scope files valid (including the new one)
- `npm run validate`: PASSED
- Unit tests for `IsOnNearbyFurnitureOperator`: 13/13 passed
- Scope DSL unit tests: 1688 passed
- Scope integration tests: 206 passed
- Full unit test suite: 39,333 passed

### Discrepancies vs Plan

None. The ticket assumptions were accurate:
- The `isOnNearbyFurniture` operator (SEACONINT-002) was already implemented and registered
- The `furniture:near_furniture` component schema was in place
- The scope DSL syntax worked as expected

### Notes

- The scope file will be registered in the furniture mod manifest via SEACONINT-007
- The 2 "unregistered files" warnings during `npm run validate` are expected (new scope + near_furniture component awaiting manifest update)
