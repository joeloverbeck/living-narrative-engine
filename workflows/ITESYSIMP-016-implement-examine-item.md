# ITESYSIMP-016: Implement Examine Item Action

**Phase:** 4 - Advanced Features  
**Priority:** Medium  
**Estimated Effort:** 1.5 hours

## Goal

Ensure the `items:examine_item` action provides a compelling narrative description when a player inspects an object in their inventory or at their current location.

## Current Implementation Snapshot (2025-02)

The core implementation already exists and differs from the original assumptions of this ticket:

- `data/mods/items/actions/examine_item.action.json` is present and defines the action, including its scope (`items:examinable_items`) and required components (`items:item`, `core:description`). It uses a simple `template` string instead of the older `formatTemplate`/`generateCombinations` pattern.
- `data/mods/items/scopes/examinable_items.scope` is already defined as the union of `items:actor_inventory_items` and `items:items_at_location`, relying on the action's `required_components` gate to ensure targets have `core:description` data.
- `data/mods/items/conditions/event-is-action-examine-item.condition.json` exists and matches the action id.
- `data/mods/items/rules/handle_examine_item.rule.json` handles the action entirely with existing generic operations (`GET_NAME`, `QUERY_COMPONENT`, `DISPATCH_PERCEPTIBLE_EVENT`, `SET_VARIABLE`, `DISPATCH_EVENT`, `END_TURN`). There is no bespoke `ExamineItemHandler` class.
- No dedicated `items:item_examined` event file is needed because the rule already dispatches a perceptible event for observers and pushes a UI success message.
- The DI container does **not** register a specific handler for `EXAMINE_ITEM`; the flow stays inside the rule/operation system.
- Integration tests cover both the action definition and rule execution (`tests/integration/mods/items/examineItemActionDiscovery.test.js`, `tests/integration/mods/items/examineItemRuleExecution.test.js`). Additional discovery tests exercise the action catalogue.

## Differences from the Original Plan

| Original assumption | Actual state | Notes |
| --- | --- | --- |
| A bespoke `ExamineItemHandler` class would be created and wired into the DI container. | No handler exists; the rule pipeline composes existing operations to fetch descriptions and broadcast results. | The current architecture favors declarative rule composition over bespoke handlers for simple read-only flows. |
| The scope would filter on `core:description` inside JSON logic. | Scope is a union; filtering happens through action `required_components`. | This keeps the scope reusable elsewhere while still guaranteeing descriptions at execution time. |
| A new `items:item_examined` event definition was required. | No standalone event file; `DISPATCH_PERCEPTIBLE_EVENT` suffices. | Observability is achieved through perception logs and UI event dispatches. |
| Examine should be a "free" action that does not end the actor's turn. | Current rule explicitly invokes `END_TURN` with `success: true`. | Needs a product decision: keep as turn-ending (current behavior) or adjust rule if free actions are desired. |

## Outstanding Questions / Follow-up Work

- [ ] Confirm with design whether examining an item should consume the actor's turn. If not, remove or gate the `END_TURN` action in `handle_examine_item.rule.json`.
- [ ] Decide whether the perceptible event should include richer contextual data (e.g., send full description only to the actor vs. everyone present) and update the rule if requirements change.
- [ ] Keep integration tests aligned with any future rule changes (tests currently expect the action catalogue entry and perception log behavior already in place).

## Validation Checklist (Updated)

- [x] Action, scope, and condition assets exist and reference each other correctly.
- [x] Rule retrieves the description text and surfaces it via a perceptible event/UI message.
- [ ] Turn handling confirmed with design (pending decision above).
- [x] Integration tests cover action discovery and rule execution.

## Dependencies

- ITESYSIMP-001: Mod structure must exist. *(fulfilled)*
- ITESYSIMP-006: Scope definitions for inventory/location items. *(fulfilled through shared scopes)*
- Core mod for `core:description` component. *(fulfilled)*

## Next Steps

If the remaining open question about turn consumption is resolved, update the rule accordingly and adjust integration tests if needed. Afterwards continue with ITESYSIMP-017 (put in container action).
