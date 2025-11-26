# UNWITEACT-000: Unwield Item Action - Overview

## Summary

Implement the `weapons:unwield_item` action, the inverse of `weapons:wield_threateningly`. This action allows an actor to stop wielding an item and free up their grabbing appendages. Additionally, fix the existing `handle_wield_threateningly.rule.json` to properly integrate with the grabbing appendage system by adding the missing `LOCK_GRABBING` operation.

## Goals

1. **Create `unwield_item` action**: Complete action/rule/condition/scope implementation
2. **Fix `wield_threateningly` rule**: Add missing `LOCK_GRABBING` operation for appendage tracking
3. **Ensure appendage consistency**: Wielding locks appendages, unwielding unlocks them
4. **Full test coverage**: Action discovery and rule execution tests for both new and fixed functionality

## Non-Goals

- Modifying the `positioning:wielding` component schema
- Modifying the `anatomy:requires_grabbing` component schema
- Changing the grabbing appendage system itself
- Any changes to other actions or rules beyond the scope of wielding/unwielding

## Problem Statement

Currently, the `wield_threateningly` action:
1. Adds items to the `positioning:wielding` component
2. **Does NOT lock grabbing appendages** via `LOCK_GRABBING`

This creates an inconsistency where wielded items don't properly occupy the actor's hands/appendages. The new `unwield_item` action must use `UNLOCK_GRABBING` to release appendages, and the existing `wield_threateningly` action must be fixed to use `LOCK_GRABBING`.

## Ticket Index

| Ticket | Phase | Description | Dependencies |
|--------|-------|-------------|--------------|
| UNWITEACT-001 | 1 | Create `wielded_items.scope` file | None |
| UNWITEACT-002 | 1 | Create `event-is-action-unwield-item.condition.json` | None |
| UNWITEACT-003 | 2 | Create `unwield_item.action.json` | UNWITEACT-001 |
| UNWITEACT-004 | 2 | Create `handle_unwield_item.rule.json` | UNWITEACT-002 |
| UNWITEACT-005 | 3 | Fix `handle_wield_threateningly.rule.json` to add `LOCK_GRABBING` | None |
| UNWITEACT-006 | 4 | Create action discovery tests for `unwield_item` | UNWITEACT-003 |
| UNWITEACT-007 | 4 | Create rule execution tests for `unwield_item` | UNWITEACT-004 |
| UNWITEACT-008 | 4 | Add/update tests for `wield_threateningly` LOCK_GRABBING | UNWITEACT-005 |

## Execution Order

```
Phase 1 (Foundation - can be parallel)
├── UNWITEACT-001 (scope file)
└── UNWITEACT-002 (condition file)
         │
Phase 2 (Action & Rule)
├── UNWITEACT-003 (action file) ──depends on──► UNWITEACT-001
└── UNWITEACT-004 (rule file) ──depends on──► UNWITEACT-002
         │
Phase 3 (Bug Fix - independent)
└── UNWITEACT-005 (wield fix)
         │
Phase 4 (Tests - depends on Phases 2 & 3)
├── UNWITEACT-006 (discovery tests) ──depends on──► UNWITEACT-003
├── UNWITEACT-007 (rule tests) ──depends on──► UNWITEACT-004
└── UNWITEACT-008 (wield fix tests) ──depends on──► UNWITEACT-005
```

## Files Created by This Work

| File | Ticket |
|------|--------|
| `data/mods/weapons/scopes/wielded_items.scope` | UNWITEACT-001 |
| `data/mods/weapons/conditions/event-is-action-unwield-item.condition.json` | UNWITEACT-002 |
| `data/mods/weapons/actions/unwield_item.action.json` | UNWITEACT-003 |
| `data/mods/weapons/rules/handle_unwield_item.rule.json` | UNWITEACT-004 |
| `tests/integration/mods/weapons/unwield_item_action_discovery.test.js` | UNWITEACT-006 |
| `tests/integration/mods/weapons/unwield_item_rule_execution.test.js` | UNWITEACT-007 |

## Files Modified by This Work

| File | Ticket |
|------|--------|
| `data/mods/weapons/rules/handle_wield_threateningly.rule.json` | UNWITEACT-005 |
| `tests/integration/mods/weapons/wield_threateningly_action.test.js` (or new file) | UNWITEACT-008 |

## Validation Commands

Run after each ticket completion:

```bash
npm run validate           # Schema and mod validation
npm run test:ci            # Full test suite
npm run test:integration -- tests/integration/mods/weapons/  # Weapons-specific tests
```

## Rollback Strategy

Each phase can be rolled back independently:
1. **Scope/Condition files**: Delete the new files
2. **Action/Rule files**: Delete the new files, revert manifest
3. **Wield fix**: `git checkout data/mods/weapons/rules/handle_wield_threateningly.rule.json`
4. **Tests**: Delete new test files, revert modified test files

Complete rollback: `git reset --hard <pre-implementation-commit>`

## Reference Document

Full specification: `specs/unwield-item-action.md`
