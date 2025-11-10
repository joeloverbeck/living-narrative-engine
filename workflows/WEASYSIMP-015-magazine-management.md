# WEASYSIMP-015: Create Magazine Management Actions and Rules

**Phase:** Weapons Mod Core
**Timeline:** 1 day
**Status:** Not Started
**Dependencies:** WEASYSIMP-009
**Priority:** P1

## Overview

Create `eject_magazine` and `insert_magazine` actions and rules for managing detachable magazines.

## Files to Create

### Eject Magazine
1. Action: `eject_magazine.action.json` (spec lines 741-768)
2. Condition: `event-is-action-eject-magazine.condition.json`
3. Rule: `handle_eject_magazine.rule.json`

Operations: CREATE_ENTITY (magazine in inventory), MODIFY_COMPONENT (magazineInserted=false), DISPATCH_EVENT

### Insert Magazine
1. Action: `insert_magazine.action.json` (spec lines 780-812)
2. Condition: `event-is-action-insert-magazine.condition.json`
3. Rule: `handle_insert_magazine.rule.json`

Operations: REMOVE_ENTITY (magazine from inventory), MODIFY_COMPONENT (transfer ammo), MODIFY_COMPONENT (magazineInserted=true), DISPATCH_EVENT

## Acceptance Criteria

- [ ] 6 files created (2 actions, 2 conditions, 2 rules)
- [ ] Eject creates magazine entity
- [ ] Insert removes magazine entity
- [ ] Ammo transferred correctly
- [ ] Validates

## Related Tickets

- **Depends On:** WEASYSIMP-009, WEASYSIMP-016
