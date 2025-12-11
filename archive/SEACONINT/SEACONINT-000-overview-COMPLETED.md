# SEACONINT-000: Seated Container Interaction - Overview

**Status**: Not Started
**Priority**: HIGH
**Estimated Effort**: 3-4 days total
**Spec Reference**: `specs/seated-container-interaction.md`

## Feature Summary

Implement seated container interaction actions that allow actors sitting on furniture to interact with containers on nearby furniture surfaces. Example: An actor sitting on a stool at a kitchen table should be able to pick up and put down items on that table.

## Problem Being Solved

The existing `containers:take_from_container` and `containers:put_in_container` actions have `positioning:sitting_on` as a **forbidden component**. This prevents seated actors from interacting with ANY containers, which is intentional for unrealistic scenarios (reaching across a room), but creates a UX problem for realistic scenarios (reaching over to a nearby table while seated).

## Solution Overview

1. Create a new `furniture:near_furniture` component to track furniture proximity relationships
2. Create a custom `isOnNearbyFurniture` JSON Logic operator for scope filtering
3. Create a new scope that finds open containers on nearby furniture
4. Create two new actions (`take_from_nearby_surface`, `put_on_nearby_surface`) that REQUIRE sitting
5. Add corresponding conditions and rule handlers
6. Update stool entity instances with the new component

## Ticket Breakdown

| Ticket | Description | Dependencies |
|--------|-------------|--------------|
| SEACONINT-001 | Create `furniture:near_furniture` component schema | None |
| SEACONINT-002 | Create `isOnNearbyFurniture` operator + registration | SEACONINT-001 |
| SEACONINT-003 | Create `open_containers_on_nearby_furniture` scope | SEACONINT-002 |
| SEACONINT-004 | Create `take_from_nearby_surface` action + condition + rule | SEACONINT-003 |
| SEACONINT-005 | Create `put_on_nearby_surface` action + condition + rule | SEACONINT-003 |
| SEACONINT-006 | Update stool entity instances with `near_furniture` | SEACONINT-001 |
| SEACONINT-007 | Update furniture mod manifest | SEACONINT-001 through SEACONINT-005 |
| SEACONINT-008 | Unit tests for `isOnNearbyFurniture` operator | SEACONINT-002 |
| SEACONINT-009 | Integration tests for action discovery + rule execution | SEACONINT-004, SEACONINT-005, SEACONINT-006 |

## Implementation Order

1. SEACONINT-001 (component)
2. SEACONINT-002 (operator)
3. SEACONINT-003 (scope)
4. SEACONINT-004 + SEACONINT-005 (actions) - can be done in parallel
5. SEACONINT-006 (entity updates)
6. SEACONINT-007 (manifest)
7. SEACONINT-008 (unit tests)
8. SEACONINT-009 (integration tests)

## Files Created (Total: 14)

| File | Ticket |
|------|--------|
| `data/mods/furniture/components/near_furniture.component.json` | SEACONINT-001 |
| `src/logic/operators/isOnNearbyFurnitureOperator.js` | SEACONINT-002 |
| `data/mods/furniture/scopes/open_containers_on_nearby_furniture.scope` | SEACONINT-003 |
| `data/mods/furniture/actions/take_from_nearby_surface.action.json` | SEACONINT-004 |
| `data/mods/furniture/conditions/event-is-action-take-from-nearby-surface.condition.json` | SEACONINT-004 |
| `data/mods/furniture/rules/handle_take_from_nearby_surface.rule.json` | SEACONINT-004 |
| `data/mods/furniture/actions/put_on_nearby_surface.action.json` | SEACONINT-005 |
| `data/mods/furniture/conditions/event-is-action-put-on-nearby-surface.condition.json` | SEACONINT-005 |
| `data/mods/furniture/rules/handle_put_on_nearby_surface.rule.json` | SEACONINT-005 |
| `tests/unit/logic/operators/isOnNearbyFurnitureOperator.test.js` | SEACONINT-008 |
| `tests/integration/mods/furniture/takeFromNearbySurfaceActionDiscovery.test.js` | SEACONINT-009 |
| `tests/integration/mods/furniture/putOnNearbySurfaceActionDiscovery.test.js` | SEACONINT-009 |
| `tests/integration/mods/furniture/takeFromNearbySurfaceRuleExecution.test.js` | SEACONINT-009 |
| `tests/integration/mods/furniture/putOnNearbySurfaceRuleExecution.test.js` | SEACONINT-009 |

## Files Modified (Total: 7)

| File | Ticket |
|------|--------|
| `src/logic/jsonLogicCustomOperators.js` | SEACONINT-002 |
| `src/dependencyInjection/tokens/tokens-core.js` | SEACONINT-002 |
| `data/mods/furniture/mod-manifest.json` | SEACONINT-007 |
| `data/mods/fantasy/entities/instances/plain_wooden_stool_1.entity.json` | SEACONINT-006 |
| `data/mods/fantasy/entities/instances/plain_wooden_stool_2.entity.json` | SEACONINT-006 |
| `data/mods/fantasy/entities/instances/plain_wooden_stool_3.entity.json` | SEACONINT-006 |
| `data/mods/fantasy/entities/instances/plain_wooden_stool_4.entity.json` | SEACONINT-006 |

## Global Invariants (Must Remain True)

1. Existing `containers:take_from_container` and `containers:put_in_container` actions continue to work unchanged
2. Standing actors should NOT gain access to the new seated-only actions
3. Seated actors can still NOT access distant containers (original restriction preserved)
4. All existing tests continue to pass
5. Schema validation passes for all new JSON files
6. The furniture mod manifest remains valid JSON

## Success Criteria

- [ ] Actor seated on stool near table can discover `take_from_nearby_surface` action
- [ ] Actor seated on stool near table can discover `put_on_nearby_surface` action
- [ ] Standing actors do NOT see these actions
- [ ] Seated actors near furniture WITHOUT containers do NOT see these actions
- [ ] Seated actors near furniture with CLOSED containers do NOT see these actions
- [ ] Items successfully transfer between inventory and container
- [ ] All unit and integration tests pass
- [ ] `npm run test:ci` passes
- [ ] `npm run validate` passes
