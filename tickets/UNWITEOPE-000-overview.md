# UNWITEOPE-000: Overview - Unwield Item Operation

## Summary

This ticket series implements the `UNWIELD_ITEM` operation handler, which encapsulates all logic for stopping wielding an item. This includes releasing grabbing appendages and cleaning up the wielding component.

## Problem Statement

When dropping a wielded item via `drop_item.action.json`, the system currently:
- Removes the item from inventory
- Sets the item's position to the actor's location

However, it does NOT:
- Remove the item from `wielded_item_ids` in `positioning:wielding` component
- Unlock the grabbing appendages holding the item
- Clean up the wielding component if it becomes empty
- Regenerate the actor's description

This leaves the actor in an inconsistent state where they appear to still be wielding a dropped item.

## Solution

Create a new `UNWIELD_ITEM` operation handler that:
1. Encapsulates all unwielding logic in a single, reusable operation
2. Is idempotent - safe to call even if item is not currently wielded
3. Can be used by both `handle_unwield_item.rule.json` and `handle_drop_item.rule.json`
4. Eliminates code duplication between rules

## Ticket Breakdown

| Ticket | Title | Description |
|--------|-------|-------------|
| UNWITEOPE-001 | Schema Creation | Create operation schema and add reference |
| UNWITEOPE-002 | Handler Implementation | Create UnwieldItemHandler class |
| UNWITEOPE-003 | DI Registration | Token, factory, interpreter mapping, whitelist |
| UNWITEOPE-004 | Unit Tests | Handler unit test coverage |
| UNWITEOPE-005 | Drop Item Rule Update | Add UNWIELD_ITEM to handle_drop_item.rule.json |
| UNWITEOPE-006 | Unwield Item Rule Update | Simplify handle_unwield_item.rule.json |
| UNWITEOPE-007 | Integration Tests | End-to-end operation tests |

## Dependency Graph

```
UNWITEOPE-001 (Schema)
      |
      v
UNWITEOPE-002 (Handler)
      |
      v
UNWITEOPE-003 (DI Registration)
      |
      +--> UNWITEOPE-004 (Unit Tests)
      |
      +--> UNWITEOPE-005 (Drop Rule) ---+
      |                                  |
      +--> UNWITEOPE-006 (Unwield Rule) -+--> UNWITEOPE-007 (Integration Tests)
```

## Files Created (Total)

| File | Purpose |
|------|---------|
| `data/schemas/operations/unwieldItem.schema.json` | Operation schema |
| `src/logic/operationHandlers/unwieldItemHandler.js` | Handler implementation |
| `tests/unit/logic/operationHandlers/unwieldItemHandler.test.js` | Unit tests |
| `tests/integration/mods/items/unwieldItemOperation.test.js` | Integration tests |

## Files Modified (Total)

| File | Change |
|------|--------|
| `data/schemas/operation.schema.json` | Add schema $ref |
| `src/dependencyInjection/tokens/tokens-core.js` | Add token |
| `src/dependencyInjection/registrations/operationHandlerRegistrations.js` | Add factory |
| `src/dependencyInjection/registrations/interpreterRegistrations.js` | Add mapping |
| `src/utils/preValidationUtils.js` | Add to whitelist |
| `data/mods/items/rules/handle_drop_item.rule.json` | Add UNWIELD_ITEM call |
| `data/mods/items/rules/handle_unwield_item.rule.json` | Simplify using new operation |

## Success Criteria

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] `npm run validate` passes
- [ ] `npm run test:ci` passes
- [ ] Dropping a wielded item properly unwields it
- [ ] Unwielding an item properly releases grabbing appendages
- [ ] Operation is idempotent (safe to call when item not wielded)

## Reference Specification

See `specs/unwield-item-operation.md` for complete technical specification.
