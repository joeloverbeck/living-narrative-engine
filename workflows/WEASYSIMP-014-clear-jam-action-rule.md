# WEASYSIMP-014: Create Clear Jam Action and Rule

**Phase:** Weapons Mod Core
**Timeline:** 0.5 days
**Status:** Not Started
**Dependencies:** WEASYSIMP-010
**Priority:** P1

## Overview

Create `weapons:clear_jam` action and rule for clearing weapon jams.

## Files to Create

1. Action: `clear_jam.action.json` (spec lines 703-730)
2. Condition: `event-is-action-clear-jam.condition.json`
3. Rule: `handle_clear_jam.rule.json` (spec lines 1867-1958)

Rule operations: QUERY_COMPONENT (jam data), REMOVE_COMPONENT (jammed), IF (certain jam types) MODIFY_COMPONENT (unchambered), DISPATCH_EVENT, END_TURN

## Acceptance Criteria

- [ ] 3 files created
- [ ] Action requires jammed weapons scope
- [ ] Rule removes jam component
- [ ] Handles different jam types
- [ ] Validates

## Related Tickets

- **Depends On:** WEASYSIMP-010, WEASYSIMP-016
